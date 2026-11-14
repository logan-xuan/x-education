import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  defaultQuestion,
  type Question,
  type QuestionInput,
  type QuestionSummary,
  type Identity,
  type ReviewInput,
  type RecordFilters,
  type RecordsResponse,
  type Stats,
  type Submission,
  type SubmissionInput,
  type StudentProfile,
} from '../shared/model.js';
import { grade } from './grading.js';
import { AppError } from './errors.js';

type Row = Record<string, unknown>;
const latestCte = `WITH ranked AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY question_id, group_name, student_number ORDER BY id DESC) AS rank FROM submissions WHERE question_id = ?)`;
export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
        rules TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('draft','published','closed')),
        version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, receipt TEXT UNIQUE NOT NULL,
        question_id TEXT NOT NULL REFERENCES questions(id), group_name TEXT NOT NULL,
        student_number TEXT NOT NULL, answer TEXT NOT NULL, question_snapshot TEXT NOT NULL,
        grading TEXT NOT NULL, is_correct INTEGER NOT NULL CHECK(is_correct IN (0,1)),
        feedback TEXT NOT NULL DEFAULT '', feedback_updated_at TEXT, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_submissions_identity ON submissions(question_id, group_name, student_number, id DESC);
      CREATE INDEX IF NOT EXISTS idx_submissions_question ON submissions(question_id, id DESC);
      CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    `);
    if (!this.db.prepare('SELECT id FROM migrations WHERE id = ?').get('initial-question')) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.createQuestion(defaultQuestion, 'red-packet');
        this.db
          .prepare('INSERT INTO migrations VALUES (?, ?)')
          .run('initial-question', new Date().toISOString());
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
    if (!this.db.prepare('SELECT id FROM migrations WHERE id = ?').get('teacher-review-v1')) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`
          ALTER TABLE submissions ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'
            CHECK(review_status IN ('pending','approved','returned'));
          ALTER TABLE submissions ADD COLUMN review_version INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE submissions ADD COLUMN reviewed_at TEXT;
          CREATE INDEX idx_submissions_review ON submissions(question_id, review_status, id DESC);
        `);
        this.db
          .prepare('INSERT INTO migrations VALUES (?, ?)')
          .run('teacher-review-v1', new Date().toISOString());
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
    if (!this.db.prepare('SELECT id FROM migrations WHERE id=?').get('student-login-v1')) {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        this.db.exec(`CREATE TABLE students (
          id TEXT PRIMARY KEY, group_name TEXT NOT NULL DEFAULT '', student_number TEXT NOT NULL,
          created_at TEXT NOT NULL, last_login_at TEXT NOT NULL,
          UNIQUE(group_name, student_number)
        )`);
        const insert = this.db.prepare('INSERT INTO students VALUES (?,?,?,?,?)');
        for (const row of this.db
          .prepare(
            'SELECT group_name, student_number, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM submissions GROUP BY group_name,student_number',
          )
          .all()) {
          insert.run(
            randomUUID(),
            String(row.group_name),
            String(row.student_number),
            String(row.first_at),
            String(row.last_at),
          );
        }
        this.db
          .prepare('INSERT INTO migrations VALUES (?,?)')
          .run('student-login-v1', new Date().toISOString());
        this.db.exec('COMMIT');
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    }
  }
  close() {
    this.db.close();
  }
  student(id: string): StudentProfile | null {
    const row = this.db.prepare('SELECT * FROM students WHERE id=?').get(id);
    return row
      ? {
          id: String(row.id),
          groupName: String(row.group_name),
          studentNumber: String(row.student_number),
          createdAt: String(row.created_at),
          lastLoginAt: String(row.last_login_at),
        }
      : null;
  }
  loginStudent(identity: Identity): StudentProfile {
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO students VALUES (?,?,?,?,?) ON CONFLICT(group_name,student_number) DO UPDATE SET last_login_at=excluded.last_login_at',
      )
      .run(randomUUID(), identity.groupName, identity.studentNumber, now, now);
    const row = this.db
      .prepare('SELECT id FROM students WHERE group_name=? AND student_number=?')
      .get(identity.groupName, identity.studentNumber)!;
    return this.student(String(row.id))!;
  }
  studentSubmissions(identity: Identity, questionId?: string): Submission[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY id DESC) AS rank FROM submissions WHERE group_name=? AND student_number=?${questionId ? ' AND question_id=?' : ''}) WHERE rank=1 ORDER BY id DESC`,
      )
      .all(identity.groupName, identity.studentNumber, ...(questionId ? [questionId] : []));
    return rows.map((row) => this.submissionRow(row));
  }
  private questionRow(row: Row): Question {
    return {
      id: String(row.id),
      title: String(row.title),
      description: String(row.description),
      rules: JSON.parse(String(row.rules)),
      status: row.status as Question['status'],
      version: Number(row.version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
  private submissionRow(row: Row): Submission {
    return {
      id: Number(row.id),
      receipt: String(row.receipt),
      questionId: String(row.question_id),
      question: JSON.parse(String(row.question_snapshot)),
      identity: { groupName: String(row.group_name), studentNumber: String(row.student_number) },
      answer: JSON.parse(String(row.answer)),
      grading: JSON.parse(String(row.grading)),
      reviewStatus: row.review_status as Submission['reviewStatus'],
      reviewVersion: Number(row.review_version),
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
      feedback: String(row.feedback),
      feedbackUpdatedAt: row.feedback_updated_at ? String(row.feedback_updated_at) : null,
      createdAt: String(row.created_at),
    };
  }
  question(id: string): Question {
    const row = this.db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    if (!row) throw new AppError(404, '这道题目不存在');
    return this.questionRow(row);
  }
  currentQuestion(): Question | null {
    const row = this.db
      .prepare(
        "SELECT * FROM questions WHERE status != 'draft' ORDER BY CASE WHEN status='published' THEN 0 ELSE 1 END, created_at DESC, rowid DESC LIMIT 1",
      )
      .get();
    return row ? this.questionRow(row) : null;
  }
  questions(): QuestionSummary[] {
    return this.db
      .prepare('SELECT * FROM questions ORDER BY created_at DESC, rowid DESC')
      .all()
      .map((row) => {
        const question = this.questionRow(row),
          stats = this.stats(question.id);
        return {
          ...question,
          studentCount: stats.studentCount,
          submissionCount: stats.submissionCount,
        };
      });
  }
  createQuestion(input: QuestionInput, id: string = randomUUID()): Question {
    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO questions (id, title, description, rules, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(id, input.title, input.description, JSON.stringify(input.rules), input.status, now, now);
    return this.question(id);
  }
  updateQuestion(id: string, input: QuestionInput, version: number): Question {
    this.question(id);
    const result = this.db
      .prepare(
        'UPDATE questions SET title=?, description=?, rules=?, status=?, version=version+1, updated_at=? WHERE id=? AND version=?',
      )
      .run(
        input.title,
        input.description,
        JSON.stringify(input.rules),
        input.status,
        new Date().toISOString(),
        id,
        version,
      );
    if (!result.changes) throw new AppError(409, '题目已被其他页面修改，请刷新后再试');
    return this.question(id);
  }
  submit(questionId: string, input: SubmissionInput): Submission {
    // Read rules, check the version and write the snapshot as one transaction.
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const question = this.question(questionId);
      if (question.status !== 'published')
        throw new AppError(
          409,
          question.status === 'draft' ? '题目尚未发布' : '本题已结束收集，无法提交新答案',
        );
      if (question.version !== input.questionVersion)
        throw new AppError(409, '老师已更新题目，请重新载入题目后检查答案再提交');
      const previous = this.latestSubmission(questionId, input.identity);
      if (previous) {
        if (previous.reviewStatus === 'pending')
          throw new AppError(409, '该组名和编号已有待审核提交，请等待老师审核');
        if (previous.reviewStatus === 'approved')
          throw new AppError(409, '该组名和编号的答案已通过审核，无需再次提交');
        if (input.previousReceipt !== previous.receipt)
          throw new AppError(409, '请从老师退回的提交状态页进入重答');
      } else if (input.previousReceipt) {
        throw new AppError(409, '重答入口与当前组名或编号不匹配，请通过原提交状态页重答');
      }
      const grading = grade(input.answer, question.rules),
        receipt = randomBytes(24).toString('base64url');
      const result = this.db
        .prepare(
          'INSERT INTO submissions (receipt, question_id, group_name, student_number, answer, question_snapshot, grading, is_correct, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          receipt,
          questionId,
          input.identity.groupName,
          input.identity.studentNumber,
          JSON.stringify(input.answer),
          JSON.stringify(question),
          JSON.stringify(grading),
          Number(grading.isCorrect),
          new Date().toISOString(),
        );
      const submission = this.submission(Number(result.lastInsertRowid));
      this.db.exec('COMMIT');
      return submission;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  receipt(receipt: string): Submission {
    const row = this.db.prepare('SELECT * FROM submissions WHERE receipt=?').get(receipt);
    if (!row) throw new AppError(404, '未找到这份提交，请检查结果链接');
    return this.submissionRow(row);
  }
  submission(id: number): Submission {
    const row = this.db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
    if (!row) throw new AppError(404, '提交记录不存在');
    return this.submissionRow(row);
  }
  history(id: number): Submission[] {
    const s = this.submission(id);
    return this.db
      .prepare(
        'SELECT * FROM submissions WHERE question_id=? AND group_name=? AND student_number=? ORDER BY id DESC',
      )
      .all(s.questionId, s.identity.groupName, s.identity.studentNumber)
      .map((row) => this.submissionRow(row));
  }
  latestSubmission(questionId: string, identity: Identity): Submission | null {
    const row = this.db
      .prepare(
        'SELECT * FROM submissions WHERE question_id=? AND group_name=? AND student_number=? ORDER BY id DESC LIMIT 1',
      )
      .get(questionId, identity.groupName, identity.studentNumber);
    return row ? this.submissionRow(row) : null;
  }
  review(id: number, input: ReviewInput): Submission {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const submission = this.submission(id);
      if (this.latestSubmission(submission.questionId, submission.identity)!.id !== id) {
        throw new AppError(409, '这是历史提交，请审核该学生的最新一次答案');
      }
      if (
        submission.reviewStatus !== 'pending' ||
        submission.reviewVersion !== input.reviewVersion
      ) {
        throw new AppError(409, '这份答案已被审核，请刷新后查看最新状态');
      }
      const now = new Date().toISOString();
      this.db
        .prepare(
          'UPDATE submissions SET review_status=?, review_version=review_version+1, reviewed_at=?, feedback=?, feedback_updated_at=? WHERE id=?',
        )
        .run(input.status, now, input.feedback, now, id);
      const result = this.submission(id);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  stats(questionId: string): Stats {
    const row = this.db
      .prepare(
        `${latestCte} SELECT COUNT(*) AS students,
          COALESCE(SUM(review_status='pending'),0) AS pending,
          COALESCE(SUM(review_status='approved'),0) AS approved,
          COALESCE(SUM(review_status='returned'),0) AS returned,
          (SELECT COUNT(*) FROM submissions WHERE question_id=?) AS attempts FROM ranked WHERE rank=1`,
      )
      .get(questionId, questionId)!;
    const studentCount = Number(row.students);
    return {
      studentCount,
      submissionCount: Number(row.attempts),
      pendingCount: Number(row.pending),
      approvedCount: Number(row.approved),
      returnedCount: Number(row.returned),
    };
  }
  records(filters: RecordFilters): RecordsResponse {
    this.question(filters.questionId);
    const clauses = [filters.latest === false ? '1=1' : 'rank=1'];
    const params: SQLInputValue[] = [filters.questionId];
    if (filters.search) {
      clauses.push(
        "(instr(lower(COALESCE(NULLIF(group_name,''),'未分组')),lower(?)) > 0 OR instr(lower(student_number),lower(?)) > 0)",
      );
      params.push(filters.search, filters.search);
    }
    if (filters.result && filters.result !== 'all') {
      clauses.push('is_correct=?');
      params.push(Number(filters.result === 'correct'));
    }
    if (filters.reviewStatus && filters.reviewStatus !== 'all') {
      clauses.push('review_status=?');
      params.push(filters.reviewStatus);
    }
    const where = clauses.join(' AND '),
      page = filters.page || 1,
      pageSize = filters.pageSize || 20;
    const total = Number(
      this.db
        .prepare(`${latestCte} SELECT COUNT(*) AS count FROM ranked WHERE ${where}`)
        .get(...params)!.count,
    );
    const rows = this.db
      .prepare(`${latestCte} SELECT * FROM ranked WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize);
    return {
      items: rows.map((row) => this.submissionRow(row)),
      total,
      page,
      pageSize,
      stats: this.stats(filters.questionId),
    };
  }
}
