import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';

const answer = {
  questionVersion: 1,
  answer: {
    secondCount: 10,
    thirdCount: 500,
    winningCount: 515,
    winningRate: 51.5,
    totalAmount: 3200,
    reason: '我的课堂答案',
  },
};
function fixture(t: TestContext) {
  const store = new Store(':memory:'),
    app = createApp({ store, teacherPassword: 'student-test-fixed-teacher-password' });
  t.after(() => store.close());
  return { store, app };
}
test('student number is required, group is optional, and login needs no password', async (t) => {
  const { app, store } = fixture(t),
    student = request.agent(app);
  for (const body of [{}, { studentNumber: '' }, { studentNumber: '  ' }, { studentNumber: 3 }])
    await student.post('/api/student/session').send(body).expect(400);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM students').get()!.n, 0);
  const first = await student
    .post('/api/student/session')
    .send({ studentNumber: '003' })
    .expect(200);
  assert.equal(first.body.student.groupName, '');
  assert.equal(first.body.student.studentNumber, '003');
  assert.match(first.headers['set-cookie'][0], /HttpOnly/);
  assert.match(first.headers['set-cookie'][0], /SameSite=Strict/);
  const again = await student
    .post('/api/student/session')
    .send({ groupName: ' ', studentNumber: ' 003 ' })
    .expect(200);
  assert.equal(again.body.student.id, first.body.student.id);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM students').get()!.n, 1);
  await student.post('/api/questions/red-packet/submissions').send(answer).expect(201);
  assert.equal(store.records({ questionId: 'red-packet', search: '未分组' }).total, 1);
});
test('anonymous clients cannot submit, list student work or read receipt details', async (t) => {
  const { app } = fixture(t);
  await request(app).get('/api/student/session').expect(401);
  await request(app).get('/api/student/submissions').expect(401);
  await request(app)
    .get(`/api/receipts/${'a'.repeat(32)}`)
    .expect(401);
  await request(app).post('/api/questions/red-packet/submissions').send(answer).expect(401);
});
test('submissions use the signed login identity; another identity cannot read their results', async (t) => {
  const { app, store } = fixture(t),
    first = request.agent(app),
    other = request.agent(app);
  const signed = await first
    .post('/api/student/session')
    .send({ groupName: '甲组', studentNumber: '01' })
    .expect(200);
  const second = await other
    .post('/api/student/session')
    .send({ groupName: '乙组', studentNumber: '01' })
    .expect(200);
  const result = await first
    .post('/api/questions/red-packet/submissions')
    .send({
      ...answer,
      identity: { groupName: '伪造组', studentNumber: '99' },
      studentId: signed.body.student.id,
    })
    .expect(201);
  assert.deepEqual(result.body.identity, { groupName: '甲组', studentNumber: '01' });
  assert.equal(result.body.grading, undefined);
  await other.get(`/api/receipts/${result.body.receipt}`).expect(404);
  const own = await first.get('/api/student/submissions').expect(200);
  assert.equal(own.body.length, 1);
  assert.equal(own.body[0].reviewStatus, 'pending');
  assert.equal(own.body[0].grading, undefined);
  const theirs = await other.get('/api/student/submissions').expect(200);
  assert.equal(theirs.body.length, 0);
  await other
    .post('/api/questions/red-packet/submissions')
    .send({ ...answer, studentId: signed.body.student.id })
    .expect(409);
  assert.notEqual(signed.body.student.id, second.body.student.id);
  assert.equal(store.stats('red-packet').studentCount, 1);
});
test('logout ends the student session; logging in again from another browser restores prior review state', async (t) => {
  const { app, store } = fixture(t),
    first = request.agent(app);
  const identity = { groupName: '找回组', studentNumber: '02' };
  const profile = await first.post('/api/student/session').send(identity).expect(200);
  const submitted = await first
    .post('/api/questions/red-packet/submissions')
    .send(answer)
    .expect(201);
  const saved = store.receipt(submitted.body.receipt);
  store.review(saved.id, { status: 'returned', feedback: '补充理由', reviewVersion: 0 });
  await first.delete('/api/student/session').expect(200);
  await first.get('/api/student/submissions').expect(401);
  const fresh = request.agent(app),
    restored = await fresh.post('/api/student/session').send(identity).expect(200);
  assert.equal(restored.body.student.id, profile.body.student.id);
  const work = await fresh.get('/api/student/submissions?questionId=red-packet').expect(200);
  assert.equal(work.body.length, 1);
  assert.equal(work.body[0].reviewStatus, 'returned');
  assert.equal(work.body[0].canResubmit, true);
  assert.equal(work.body[0].feedback, '补充理由');
  await fresh
    .post('/api/questions/red-packet/submissions')
    .send({ ...answer, previousReceipt: submitted.body.receipt })
    .expect(201);
});
test('student sessions cannot grant teacher permissions and cookie tampering is rejected', async (t) => {
  const { app } = fixture(t),
    student = request.agent(app);
  const logged = await student
    .post('/api/student/session')
    .send({ studentNumber: '01' })
    .expect(200);
  await student.get('/api/teacher/questions').expect(401);
  await student
    .patch('/api/teacher/submissions/1/review')
    .send({ status: 'approved', reviewVersion: 0 })
    .expect(401);
  const cookie = logged.headers['set-cookie'][0].split(';')[0];
  await request(app)
    .get('/api/student/session')
    .set('Cookie', cookie + 'corrupt')
    .expect(401);
  await request(app)
    .get('/api/teacher/questions')
    .set('Cookie', cookie.replace('zhike_student=', 'zhike_teacher='))
    .expect(401);
});
