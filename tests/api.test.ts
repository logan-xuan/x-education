import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';
import { defaultQuestion, type SubmissionInput } from '../shared/model.js';

const password = 'test-fixed-teacher-secret-2026';
const good: SubmissionInput = {
  questionVersion: 1,
  identity: { groupName: '灵感组', studentNumber: '03' },
  answer: {
    secondCount: 10,
    thirdCount: 500,
    winningCount: 515,
    winningRate: 51.5,
    totalAmount: 3200,
    reason: '同时满足预算与中奖率',
  },
};
const bad: SubmissionInput = {
  ...good,
  answer: {
    secondCount: 20,
    thirdCount: 450,
    winningCount: 475,
    winningRate: 47.5,
    totalAmount: 3150,
    reason: '还需要增加中奖券',
  },
};
async function fixture(t: TestContext) {
  const store = new Store(':memory:'),
    app = createApp({ store, teacherPassword: password });
  t.after(() => store.close());
  const teacher = request.agent(app),
    student = request.agent(app);
  await student.post('/api/student/session').send(good.identity).expect(200);
  const authorize = () =>
    teacher.post('/api/teacher/session').set('Authorization', `Bearer ${password}`).expect(200);
  return { store, app, teacher, student, authorize };
}
test('student submits and can revisit only the unguessable receipt; grading is server-owned', async (t) => {
  const { student, app } = await fixture(t);
  const response = await student
    .post('/api/questions/red-packet/submissions')
    .send({ ...good, grading: { isCorrect: false } })
    .expect(201);
  assert.equal(response.body.grading, undefined);
  assert.equal(response.body.reviewStatus, 'pending');
  assert.equal(response.body.id, undefined);
  assert.match(response.body.receipt, /^[\w-]{32}$/);
  await student.get(`/api/receipts/${response.body.receipt}`).expect(200);
  await student.get('/api/receipts/1').expect(404);
  await student
    .post('/api/student/session')
    .send({ ...good.identity, studentNumber: '04' })
    .expect(200);
  const wrong = await student
    .post('/api/questions/red-packet/submissions')
    .send({
      ...bad,
      identity: { ...bad.identity, studentNumber: '04' },
      grading: { isCorrect: true },
    })
    .expect(201);
  assert.equal(wrong.body.grading, undefined);
  assert.equal(wrong.body.reviewStatus, 'pending');
});
test('all teacher data and mutations require a valid server-side session', async (t) => {
  const { student, app } = await fixture(t);
  for (const path of [
    '/questions',
    '/questions/red-packet',
    '/submissions?questionId=red-packet',
    '/submissions/1',
    '/session',
  ])
    await student.get(`/api/teacher${path}`).expect(401);
  await student.post('/api/teacher/questions').send(defaultQuestion).expect(401);
  await student
    .put('/api/teacher/questions/red-packet')
    .send({ ...defaultQuestion, version: 1 })
    .expect(401);
  await student
    .patch('/api/teacher/questions/red-packet/status')
    .send({ status: 'closed', version: 1 })
    .expect(401);
  await student
    .patch('/api/teacher/submissions/1/review')
    .send({ feedback: '伪造评语' })
    .expect(401);
  await student
    .get('/api/teacher/questions')
    .set('Cookie', 'zhike_teacher=9999999999999.forged.forged')
    .expect(401);
});
test('the fixed teacher key establishes an HttpOnly session and logout removes access', async (t) => {
  const { student, teacher, app } = await fixture(t);
  await student
    .post('/api/teacher/session')
    .set('Authorization', 'Bearer incorrect-key')
    .expect(401);
  const response = await teacher
    .post('/api/teacher/session')
    .set('Authorization', `Bearer ${password}`)
    .expect(200);
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(password));
  await teacher.get('/api/teacher/questions').expect(200);
  await teacher.delete('/api/teacher/session').expect(200);
  await teacher.get('/api/teacher/questions').expect(401);
});
test('cross-site writes are rejected and bad key guesses are throttled', async (t) => {
  const { student, app } = await fixture(t);
  await student
    .post('/api/teacher/session')
    .set('Origin', 'https://other.example')
    .set('Authorization', `Bearer ${password}`)
    .expect(403);
  for (let i = 0; i < 10; i++)
    await student.post('/api/teacher/session').set('Authorization', 'Bearer wrong').expect(401);
  await student.post('/api/teacher/session').set('Authorization', 'Bearer wrong').expect(429);
});
test('malformed submissions are rejected without persisting a record', async (t) => {
  const { student, app, store } = await fixture(t);
  for (const value of [-1, 1.5, '10', null])
    await student
      .post('/api/questions/red-packet/submissions')
      .send({ ...good, answer: { ...good.answer, secondCount: value } })
      .expect(400);
  await student
    .post('/api/student/session')
    .send({ groupName: ' ', studentNumber: ' ' })
    .expect(400);
  assert.equal(store.stats('red-packet').submissionCount, 0);
});
test('latest-only filtering happens before correctness filtering and preserves full history', async (t) => {
  const { student, app, teacher, authorize } = await fixture(t);
  await authorize();
  const first = await student.post('/api/questions/red-packet/submissions').send(good).expect(201);
  const before = await teacher.get('/api/teacher/submissions?questionId=red-packet').expect(200);
  await teacher
    .patch(`/api/teacher/submissions/${before.body.items[0].id}/review`)
    .send({ status: 'returned', feedback: '请继续思考', reviewVersion: 0 })
    .expect(200);
  await student
    .post('/api/questions/red-packet/submissions')
    .send({ ...bad, previousReceipt: first.body.receipt })
    .expect(201);
  const latest = await teacher.get('/api/teacher/submissions?questionId=red-packet').expect(200);
  assert.equal(latest.body.items.length, 1);
  assert.equal(latest.body.items[0].grading.isCorrect, false);
  assert.deepEqual(latest.body.stats, {
    studentCount: 1,
    submissionCount: 2,
    pendingCount: 1,
    approvedCount: 0,
    returnedCount: 0,
  });
  const correct = await teacher
    .get('/api/teacher/submissions?questionId=red-packet&result=correct')
    .expect(200);
  assert.equal(correct.body.total, 0);
  const all = await teacher
    .get('/api/teacher/submissions?questionId=red-packet&latest=false&pageSize=1')
    .expect(200);
  assert.equal(all.body.total, 2);
  assert.equal(all.body.items.length, 1);
  const history = await teacher.get(`/api/teacher/submissions/${all.body.items[0].id}`).expect(200);
  assert.equal(history.body.history.length, 2);
  const literal = await teacher
    .get('/api/teacher/submissions')
    .query({ questionId: 'red-packet', search: "%' OR 1=1 --" })
    .expect(200);
  assert.equal(literal.body.total, 0);
});
test('feedback is saved per attempt and visible on its student receipt', async (t) => {
  const { student, app, teacher, authorize } = await fixture(t);
  await authorize();
  const submitted = await student
    .post('/api/questions/red-packet/submissions')
    .send(good)
    .expect(201);
  const records = await teacher.get('/api/teacher/submissions?questionId=red-packet').expect(200);
  await teacher
    .patch(`/api/teacher/submissions/${records.body.items[0].id}/review`)
    .send({ status: 'approved', feedback: '思路很清晰，继续加油。', reviewVersion: 0 })
    .expect(200);
  const receiptResponse = await student.get(`/api/receipts/${submitted.body.receipt}`).expect(200);
  assert.equal(receiptResponse.body.feedback, '思路很清晰，继续加油。');
});
test('editing and closing protect against stale versions and preserve historical rules', async (t) => {
  const { student, app, teacher, authorize } = await fixture(t);
  await authorize();
  const submitted = await student
    .post('/api/questions/red-packet/submissions')
    .send(good)
    .expect(201);
  const changed = {
    ...defaultQuestion,
    rules: { ...defaultQuestion.rules, budget: 3300 },
    version: 1,
  };
  await teacher.put('/api/teacher/questions/red-packet').send(changed).expect(200);
  await teacher.put('/api/teacher/questions/red-packet').send(changed).expect(409);
  await student.post('/api/questions/red-packet/submissions').send(good).expect(409);
  const historical = await student.get(`/api/receipts/${submitted.body.receipt}`).expect(200);
  assert.equal(historical.body.question.rules.budget, 3200);
  assert.equal(historical.body.grading, undefined);
  assert.equal(historical.body.reviewStatus, 'pending');
  await teacher
    .patch('/api/teacher/questions/red-packet/status')
    .send({ status: 'closed', version: 2 })
    .expect(200);
  await student.get('/api/questions/red-packet').expect(200);
  await student
    .post('/api/questions/red-packet/submissions')
    .send({ ...good, questionVersion: 3 })
    .expect(409);
});
test('drafts remain private until published and impossible parameters cannot be saved', async (t) => {
  const { student, app, teacher, authorize } = await fixture(t);
  await authorize();
  const draft = await teacher
    .post('/api/teacher/questions')
    .send({ ...defaultQuestion, status: 'draft' })
    .expect(201);
  await student.get(`/api/questions/${draft.body.id}`).expect(404);
  await student.post(`/api/questions/${draft.body.id}/submissions`).send(good).expect(404);
  await teacher
    .patch(`/api/teacher/questions/${draft.body.id}/status`)
    .send({ status: 'published', version: 1 })
    .expect(200);
  await student.get(`/api/questions/${draft.body.id}`).expect(200);
  await teacher
    .post('/api/teacher/questions')
    .send({ ...defaultQuestion, rules: { ...defaultQuestion.rules, budget: 100 } })
    .expect(400);
});
