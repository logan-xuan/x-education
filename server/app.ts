import express, { Router, type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z, ZodError } from 'zod';
import {
  questionInputSchema,
  submissionInputSchema,
  reviewInputSchema,
  type PublicSubmission,
  type Submission,
} from '../shared/model.js';
import { Store } from './store.js';
import { AppError } from './errors.js';
import { teacherAuth } from './auth.js';

export interface AppOptions {
  store: Store;
  teacherPassword: string;
  clientDir?: string;
  appOrigin?: string;
  trustProxy?: boolean;
}
const idSchema = z.coerce.number().int().positive();
const versionSchema = z.number().int().positive();
const filterSchema = z.object({
  questionId: z.string().min(1).max(100),
  search: z.string().trim().max(60).default(''),
  result: z.enum(['all', 'correct', 'incorrect']).default('all'),
  reviewStatus: z.enum(['all', 'pending', 'approved', 'returned']).default('all'),
  latest: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
function publicSubmission(s: Submission, store: Store): PublicSubmission {
  const latest = store.latestSubmission(s.questionId, s.identity)!;
  const isLatest = latest.id === s.id;
  const questionOpen = store.question(s.questionId).status === 'published';
  return {
    receipt: s.receipt, questionId: s.questionId, question: s.question,
    identity: s.identity, answer: s.answer, reviewStatus: s.reviewStatus,
    reviewedAt: s.reviewedAt, createdAt: s.createdAt,
    feedback: s.reviewStatus === 'pending' ? '' : s.feedback,
    isLatest, latestReceipt: latest.receipt, questionOpen,
    canResubmit: isLatest && s.reviewStatus === 'returned' && questionOpen,
  };
}

export function createApp(options: AppOptions) {
  const app = express(),
    { store } = options;
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.set({
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    next();
  });
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin')) {
      const expected = options.appOrigin || `${req.protocol}://${req.get('host')}`;
      if (req.get('origin') !== expected)
        return next(new AppError(403, '不允许跨站提交，请通过本站页面操作'));
    }
    next();
  });
  app.use(express.json({ limit: '24kb' }));
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/questions/current', (_req, res) => {
    res.json(store.currentQuestion());
  });
  app.get('/api/questions/:id', (req, res) => {
    const question = store.question(req.params.id);
    if (question.status === 'draft') throw new AppError(404, '这道题目尚未发布');
    res.json(question);
  });
  app.post('/api/questions/:id/submissions', (req, res) => {
    const input = submissionInputSchema.parse(req.body);
    const question = store.question(req.params.id);
    if (question.status === 'draft') throw new AppError(404, '这道题目尚未发布');
    res.status(201).json(publicSubmission(store.submit(question.id, input), store));
  });
  app.get('/api/receipts/:receipt', (req, res) => {
    if (!/^[A-Za-z0-9_-]{32}$/.test(req.params.receipt))
      throw new AppError(404, '未找到这份提交，请检查结果链接');
    res.json(publicSubmission(store.receipt(req.params.receipt), store));
  });

  const teacher = Router(),
    auth = teacherAuth(options.teacherPassword);
  teacher.post('/session', auth.establish);
  teacher.use(auth.requireTeacher);
  teacher.get('/session', (_req, res) => {
    res.json({ ok: true });
  });
  teacher.delete('/session', auth.clear);
  teacher.get('/questions', (_req, res) => {
    res.json(store.questions());
  });
  teacher.get('/questions/:id', (req, res) => {
    res.json(store.question(req.params.id as string));
  });
  teacher.post('/questions', (req, res) => {
    res.status(201).json(store.createQuestion(questionInputSchema.parse(req.body)));
  });
  teacher.put('/questions/:id', (req, res) => {
    res.json(
      store.updateQuestion(
        req.params.id as string,
        questionInputSchema.parse(req.body),
        versionSchema.parse(req.body.version),
      ),
    );
  });
  teacher.patch('/questions/:id/status', (req, res) => {
    const input = z
      .object({ status: z.enum(['draft', 'published', 'closed']), version: versionSchema })
      .parse(req.body);
    const question = store.question(req.params.id as string);
    res.json(
      store.updateQuestion(question.id, { ...question, status: input.status }, input.version),
    );
  });
  teacher.get('/submissions', (req, res) => {
    res.json(store.records(filterSchema.parse(req.query)));
  });
  teacher.get('/submissions/:id', (req, res) => {
    const id = idSchema.parse(req.params.id);
    const submission = store.submission(id), history = store.history(id);
    res.json({ submission, history, canReview: history[0].id === id && submission.reviewStatus === 'pending' });
  });
  teacher.patch('/submissions/:id/review', (req, res) => {
    res.json(store.review(idSchema.parse(req.params.id), reviewInputSchema.parse(req.body)));
  });
  app.use('/api/teacher', teacher);
  app.use('/api', (_req, _res, next) => {
    next(new AppError(404, '接口不存在'));
  });

  const clientDir = options.clientDir;
  if (clientDir && existsSync(resolve(clientDir, 'index.html'))) {
    app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(resolve(clientDir, 'index.html'));
    });
  }
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      res
        .status(400)
        .json({ message: `输入不符合要求：${error.issues.map((i) => i.message).join('；')}` });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    if (error.type === 'entity.parse.failed') {
      res.status(400).json({ message: '请求内容不是有效的 JSON' });
      return;
    }
    if (error.type === 'entity.too.large') {
      res.status(413).json({ message: '提交内容过长，请精简后重试' });
      return;
    }
    console.error('Request failed:', error instanceof Error ? error.message : 'unknown');
    res.status(500).json({ message: '服务暂时不可用，请稍后重试' });
  };
  app.use(errors);
  return app;
}
