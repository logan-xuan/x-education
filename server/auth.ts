import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { AppError } from './errors.js';

const COOKIE = 'zhike_teacher';
const LIFETIME = 8 * 60 * 60 * 1000;
export function teacherAuth(password: string) {
  const passwordHash = createHash('sha256').update(password).digest();
  const sessionKey = createHmac('sha256', password).update('zhike-teacher-session-v1').digest();
  const failures = new Map<string, { count: number; expires: number }>();
  const sign = (payload: string) => createHmac('sha256', sessionKey).update(payload).digest('hex');
  const cookieOptions = (req: Request) => ({
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: req.secure,
    path: '/api/teacher',
  });
  function validSession(req: Request) {
    const cookie = (req.headers.cookie || '')
      .split(';')
      .find((c) => c.trim().startsWith(`${COOKIE}=`))
      ?.trim()
      .slice(COOKIE.length + 1);
    if (!cookie || cookie.length > 256) return false;
    const parts = cookie.split('.');
    if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[2]))
      return false;
    const expires = Number(parts[0]),
      expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`), 'hex'),
      provided = Buffer.from(parts[2], 'hex');
    return (
      expires > Date.now() &&
      expires <= Date.now() + LIFETIME + 1000 &&
      provided.length === expected.length &&
      timingSafeEqual(expected, provided)
    );
  }
  const requireTeacher: RequestHandler = (req, _res, next) => {
    if (!validSession(req)) return next(new AppError(401, '请使用老师专属管理链接进入后台'));
    next();
  };
  const establish: RequestHandler = (req, res, next) => {
    const ip = req.ip || 'local',
      now = Date.now();
    for (const [key, entry] of failures) if (entry.expires < now) failures.delete(key);
    const entry = failures.get(ip);
    if (entry && entry.count >= 10) {
      res.setHeader('Retry-After', Math.ceil((entry.expires - now) / 1000));
      return next(new AppError(429, '管理密码验证过于频繁，请稍后再试'));
    }
    const supplied = req.get('authorization')?.replace(/^Bearer /, '') || '';
    const hash = createHash('sha256').update(supplied).digest();
    if (!timingSafeEqual(passwordHash, hash)) {
      if (failures.size > 10_000) failures.delete(failures.keys().next().value!);
      failures.set(ip, {
        count: (entry?.count || 0) + 1,
        expires: entry?.expires || now + 15 * 60 * 1000,
      });
      return next(new AppError(401, '管理链接中的密码无效，请向老师确认最新链接'));
    }
    failures.delete(ip);
    const payload = `${now + LIFETIME}.${randomBytes(12).toString('hex')}`;
    res.cookie(COOKIE, `${payload}.${sign(payload)}`, { ...cookieOptions(req), maxAge: LIFETIME });
    res.json({ ok: true });
  };
  const clear = (req: Request, res: Response) => {
    res.clearCookie(COOKIE, cookieOptions(req));
    res.json({ ok: true });
  };
  return { requireTeacher, establish, clear };
}
