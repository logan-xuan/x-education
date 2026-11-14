import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { identitySchema } from '../shared/model.js';
import { AppError } from './errors.js';
import type { Store } from './store.js';

const COOKIE = 'zhike_student';
const LIFETIME = 7 * 24 * 60 * 60 * 1000;
export function studentAuth(secret: string, store: Store) {
  const key = createHmac('sha256', secret).update('zhike-student-session-v1').digest();
  const sign = (payload: string) => createHmac('sha256', key).update(payload).digest('hex');
  const cookieOptions = (req: Request) => ({
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: req.secure,
    path: '/api',
  });
  const establish: RequestHandler = (req, res) => {
    const student = store.loginStudent(identitySchema.parse(req.body));
    const payload = `${Date.now() + LIFETIME}.${student.id}.${randomBytes(12).toString('hex')}`;
    res.cookie(COOKIE, `${payload}.${sign(payload)}`, { ...cookieOptions(req), maxAge: LIFETIME });
    res.json({ student });
  };
  const requireStudent: RequestHandler = (req, res, next) => {
    const cookie = (req.headers.cookie || '')
      .split(';')
      .find((c) => c.trim().startsWith(`${COOKIE}=`))
      ?.trim()
      .slice(COOKIE.length + 1);
    if (cookie && cookie.length <= 256) {
      const parts = cookie.split('.');
      if (
        parts.length === 4 &&
        /^\d+$/.test(parts[0]) &&
        /^[a-f0-9-]{36}$/.test(parts[1]) &&
        /^[a-f0-9]{64}$/.test(parts[3])
      ) {
        const expires = Number(parts[0]);
        const expected = Buffer.from(sign(parts.slice(0, 3).join('.')), 'hex'),
          provided = Buffer.from(parts[3], 'hex');
        if (
          expires > Date.now() &&
          expires <= Date.now() + LIFETIME + 1000 &&
          provided.length === expected.length &&
          timingSafeEqual(expected, provided)
        ) {
          const student = store.student(parts[1]);
          if (student) {
            res.locals.student = student;
            next();
            return;
          }
        }
      }
    }
    next(new AppError(401, '请先输入小组名和编号登录学生端'));
  };
  const clear = (req: Request, res: Response) => {
    res.clearCookie(COOKIE, cookieOptions(req));
    res.json({ ok: true });
  };
  return { establish, requireStudent, clear };
}
