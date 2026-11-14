import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.js';
import { DatabaseSync } from 'node:sqlite';
import { defaultQuestion } from '../shared/model.js';
import { grade } from '../server/grading.js';

test('SQLite submissions, feedback and question state survive closing and reopening the database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zhike-persistence-')),
    path = join(directory, 'classroom.sqlite');
  let store = new Store(path);
  try {
    const submission = store.submit('red-packet', {
      questionVersion: 1,
      identity: { groupName: '持久化组', studentNumber: '01' },
      answer: {
        secondCount: 0,
        thirdCount: 495,
        winningCount: 500,
        winningRate: 50,
        totalAmount: 2975,
        reason: '保留部分预算',
      },
    });
    store.review(submission.id, { status: 'approved', feedback: '正确', reviewVersion: 0 });
    const question = store.question('red-packet');
    store.updateQuestion(question.id, { ...question, status: 'closed' }, question.version);
    store.close();
    store = new Store(path);
    assert.equal(store.questions().length, 1);
    assert.equal(store.question('red-packet').status, 'closed');
    assert.equal(store.receipt(submission.receipt).feedback, '正确');
    assert.equal(store.receipt(submission.receipt).reviewStatus, 'approved');
    assert.ok(store.receipt(submission.receipt).reviewedAt);
    assert.equal(store.receipt(submission.receipt).question.status, 'published');
    assert.equal(store.receipt(submission.receipt).grading.isCorrect, true);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('existing pre-review databases retain answers and internal feedback while migrating to pending review', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zhike-legacy-')),
    path = join(directory, 'legacy.sqlite');
  const legacy = new DatabaseSync(path);
  const now = new Date().toISOString();
  const answer = {
    secondCount: 10,
    thirdCount: 500,
    winningCount: 515,
    winningRate: 51.5,
    totalAmount: 3200,
    reason: '旧记录的设计理由',
  };
  const question = {
    ...defaultQuestion,
    id: 'red-packet',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  legacy.exec(`CREATE TABLE questions (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, rules TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, receipt TEXT UNIQUE NOT NULL, question_id TEXT NOT NULL REFERENCES questions(id), group_name TEXT NOT NULL, student_number TEXT NOT NULL, answer TEXT NOT NULL, question_snapshot TEXT NOT NULL, grading TEXT NOT NULL, is_correct INTEGER NOT NULL, feedback TEXT NOT NULL DEFAULT '', feedback_updated_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);`);
  legacy
    .prepare('INSERT INTO questions VALUES (?,?,?,?,?,?,?,?)')
    .run(
      question.id,
      question.title,
      question.description,
      JSON.stringify(question.rules),
      question.status,
      1,
      now,
      now,
    );
  legacy
    .prepare(
      'INSERT INTO submissions (receipt,question_id,group_name,student_number,answer,question_snapshot,grading,is_correct,feedback,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      'a'.repeat(32),
      question.id,
      '旧组',
      '01',
      JSON.stringify(answer),
      JSON.stringify(question),
      JSON.stringify(grade(answer, question.rules)),
      1,
      '原有老师评语',
      now,
    );
  legacy.prepare('INSERT INTO migrations VALUES (?,?)').run('initial-question', now);
  legacy.close();
  let store = new Store(path);
  try {
    const submission = store.receipt('a'.repeat(32));
    assert.equal(submission.reviewStatus, 'pending');
    assert.equal(submission.reviewVersion, 0);
    assert.equal(submission.reviewedAt, null);
    assert.equal(submission.answer.reason, answer.reason);
    assert.equal(submission.feedback, '原有老师评语');
    assert.equal(submission.grading.isCorrect, true);
    const student = store.loginStudent({ groupName: '旧组', studentNumber: '01' });
    assert.equal(store.studentSubmissions(student)[0].receipt, submission.receipt);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM students').get()!.n, 1);
    store.close();
    store = new Store(path);
    assert.equal(store.student(student.id)!.studentNumber, '01');
    assert.equal(store.questions().length, 1);
    assert.equal(store.stats(question.id).submissionCount, 1);
    assert.equal(store.stats(question.id).pendingCount, 1);
  } finally {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
