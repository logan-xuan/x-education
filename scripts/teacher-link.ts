import { loadEnvironment } from '../server/env.js';
const config = loadEnvironment();
const index = process.argv.indexOf('--origin');
const origin =
  index >= 0 ? process.argv[index + 1] : process.env.APP_ORIGIN || 'http://localhost:5173';
const url = new URL('/teacher', origin);
url.hash = new URLSearchParams({ key: config.teacherPassword }).toString();
console.log(`老师专属管理链接（仅分享给老师）：\n${url.toString()}`);
