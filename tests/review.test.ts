import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';
import type { SubmissionInput } from '../shared/model.js';

const password = 'review-workflow-fixed-teacher-secret';
const input: SubmissionInput = {
  questionVersion: 1,
  identity: { groupName: '审核组', studentNumber: '01' },
  answer: { secondCount: 10, thirdCount: 500, winningCount: 515, winningRate: 51.5, totalAmount: 3200, reason: '我自己的方案。' },
};
function fixture(t: TestContext) {
  const store = new Store(':memory:'), app = createApp({ store, teacherPassword: password });
  t.after(() => store.close());
  const teacher = request.agent(app);
  const authorize = () => teacher.post('/api/teacher/session').set('Authorization', `Bearer ${password}`).expect(200);
  const submit = (body = input) => request(app).post('/api/questions/red-packet/submissions').send(body);
  return { store, app, teacher, authorize, submit };
}
function noAutomaticResults(body: Record<string, unknown>) {
  for (const key of ['grading', 'isCorrect', 'schemeValid', 'calculationCorrect', 'computed', 'checks', 'reviewVersion', 'id']) assert.equal(key in body, false, `student response exposes ${key}`);
}
test('student responses stay pending and omit all automatic results, including when the caller is a teacher', async t => {
  const { store, teacher, authorize, submit, app } = fixture(t); await authorize();
  const response = await submit({ ...input, ...{ reviewStatus: 'approved' } }).expect(201);
  noAutomaticResults(response.body);
  assert.equal(response.body.reviewStatus, 'pending'); assert.equal(response.body.canResubmit, false);
  const saved = store.receipt(response.body.receipt);
  assert.equal(saved.grading.isCorrect, true);
  store.db.prepare('UPDATE submissions SET feedback=? WHERE id=?').run('内部未发布意见', saved.id);
  for (const agent of [request(app), teacher]) {
    const result = await agent.get(`/api/receipts/${saved.receipt}`).expect(200);
    noAutomaticResults(result.body); assert.equal(result.body.feedback, '');
  }
  const internal = await teacher.get(`/api/teacher/submissions/${saved.id}`).expect(200);
  assert.equal(internal.body.submission.grading.isCorrect, true);
});
test('pending submissions cannot be repeated and only teachers can review', async t => {
  const { submit, store, app } = fixture(t);
  const response = await submit().expect(201), saved = store.receipt(response.body.receipt);
  await submit().expect(409);
  await request(app).patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'approved', reviewVersion: 0 }).expect(401);
  assert.equal(store.stats('red-packet').submissionCount, 1);
  assert.equal(store.submission(saved.id).reviewStatus, 'pending');
});
test('the teacher decision overrides automatic reference and approved answers cannot be resubmitted', async t => {
  const { submit, store, teacher, authorize, app } = fixture(t); await authorize();
  const response = await submit({ ...input, answer: { ...input.answer, thirdCount: 450 } }).expect(201);
  const saved = store.receipt(response.body.receipt); assert.equal(saved.grading.isCorrect, false);
  await teacher.patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'approved', feedback: '已确认思考过程，通过本次审核。', reviewVersion: 0 }).expect(200);
  const result = await request(app).get(`/api/receipts/${saved.receipt}`).expect(200);
  assert.equal(result.body.reviewStatus, 'approved'); assert.equal(result.body.canResubmit, false);
  assert.ok(result.body.reviewedAt); noAutomaticResults(result.body);
  await submit({ ...input, previousReceipt: saved.receipt }).expect(409);
  assert.equal(store.stats('red-packet').approvedCount, 1);
});
test('a return requires feedback and the matching latest receipt; resubmission becomes a new pending record', async t => {
  const { submit, store, teacher, authorize, app } = fixture(t); await authorize();
  const first = await submit().expect(201), saved = store.receipt(first.body.receipt);
  await teacher.patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'returned', feedback: ' ', reviewVersion: 0 }).expect(400);
  assert.equal(store.submission(saved.id).reviewStatus, 'pending');
  await teacher.patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'returned', feedback: '请更详细地说明设计理由。', reviewVersion: 0 }).expect(200);
  const returned = await request(app).get(`/api/receipts/${saved.receipt}`).expect(200);
  assert.equal(returned.body.canResubmit, true); assert.match(returned.body.feedback, /设计理由/);
  noAutomaticResults(returned.body);
  await submit().expect(409);
  await submit({ ...input, previousReceipt: 'x'.repeat(32) }).expect(409);
  await submit({ ...input, identity: { ...input.identity, studentNumber: '别人的编号' }, previousReceipt: saved.receipt }).expect(409);
  const second = await submit({ ...input, previousReceipt: saved.receipt, answer: { ...input.answer, reason: '补充后的完整思考过程。' } }).expect(201);
  assert.equal(second.body.reviewStatus, 'pending'); noAutomaticResults(second.body);
  assert.notEqual(second.body.receipt, saved.receipt);
  const old = await request(app).get(`/api/receipts/${saved.receipt}`).expect(200);
  assert.equal(old.body.isLatest, false); assert.equal(old.body.canResubmit, false); assert.equal(old.body.latestReceipt, second.body.receipt);
  await submit({ ...input, previousReceipt: saved.receipt }).expect(409);
  await teacher.patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'approved', reviewVersion: 1 }).expect(409);
  const latest = store.receipt(second.body.receipt);
  assert.equal(store.history(latest.id).length, 2);
  assert.deepEqual(store.stats('red-packet'), { studentCount: 1, submissionCount: 2, pendingCount: 1, approvedCount: 0, returnedCount: 0 });
  const filter = await teacher.get('/api/teacher/submissions?questionId=red-packet&reviewStatus=returned').expect(200);
  assert.equal(filter.body.total, 0);
  const history = await teacher.get('/api/teacher/submissions?questionId=red-packet&reviewStatus=returned&latest=false').expect(200);
  assert.equal(history.body.total, 1);
});
test('duplicate submissions and concurrent reviews cannot create conflicting decisions', async t => {
  const { submit, store, teacher, authorize } = fixture(t); await authorize();
  const submitted = await Promise.all([submit(), submit()]);
  assert.deepEqual(submitted.map(r => r.status).sort(), [201, 409]);
  const saved = store.receipt(submitted.find(r => r.status === 201)!.body.receipt);
  const decisions = await Promise.all([
    teacher.patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'approved', reviewVersion: 0 }),
    teacher.patch(`/api/teacher/submissions/${saved.id}/review`).send({ status: 'returned', feedback: '请补充理由', reviewVersion: 0 }),
  ]);
  assert.deepEqual(decisions.map(r => r.status).sort(), [200, 409]);
  assert.equal(store.submission(saved.id).reviewVersion, 1);
});
test('returned work respects question closure and current question versions', async t => {
  const { submit, store, app } = fixture(t);
  const response = await submit().expect(201), saved = store.receipt(response.body.receipt);
  store.review(saved.id, { status: 'returned', feedback: '请修改理由', reviewVersion: 0 });
  let question = store.question('red-packet');
  question = store.updateQuestion(question.id, { ...question, status: 'closed' }, question.version);
  const closed = await request(app).get(`/api/receipts/${saved.receipt}`).expect(200);
  assert.equal(closed.body.canResubmit, false); assert.equal(closed.body.questionOpen, false);
  await submit({ ...input, previousReceipt: saved.receipt, questionVersion: question.version }).expect(409);
  question = store.updateQuestion(question.id, { ...question, status: 'published' }, question.version);
  await submit({ ...input, previousReceipt: saved.receipt }).expect(409);
  await submit({ ...input, previousReceipt: saved.receipt, questionVersion: question.version }).expect(201);
});
