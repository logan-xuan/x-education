import { existsSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

export function loadEnvironment() {
  const path = resolve('.env');
  if (!existsSync(path) && !process.env.TEACHER_PASSWORD) {
    writeFileSync(
      path,
      `# Keep this file private. The password stays fixed across restarts.\nTEACHER_PASSWORD=${randomBytes(24).toString('base64url')}\nDATABASE_PATH=./data/classroom.sqlite\n`,
      { mode: 0o600, flag: 'wx' },
    );
    console.log('已创建 .env，并生成固定管理密码。运行 npm run teacher-link 查看老师专属链接。');
  }
  if (existsSync(path)) loadEnvFile(path);
  const teacherPassword = process.env.TEACHER_PASSWORD || '';
  if (teacherPassword.length < 12)
    throw new Error('TEACHER_PASSWORD 至少需要 12 个字符，请在 .env 中设置固定管理密码');
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT 必须是有效的端口号');
  return {
    teacherPassword,
    port,
    host: process.env.HOST || '0.0.0.0',
    databasePath: process.env.DATABASE_PATH || './data/classroom.sqlite',
    appOrigin: process.env.APP_ORIGIN,
    trustProxy: process.env.TRUST_PROXY === '1',
  };
}
