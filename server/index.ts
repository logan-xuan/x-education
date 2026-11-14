import { resolve } from 'node:path';
import { createApp } from './app.js';
import { Store } from './store.js';
import { loadEnvironment } from './env.js';

const config = loadEnvironment();
const store = new Store(config.databasePath);
const app = createApp({
  store,
  teacherPassword: config.teacherPassword,
  clientDir: resolve('dist/client'),
  appOrigin: config.appOrigin,
  trustProxy: config.trustProxy,
});
const server = app.listen(config.port, config.host, () => {
  console.log(`知课服务已启动：http://localhost:${config.port}`);
});
server.on('error', (error) => {
  console.error('启动失败：', error.message);
  store.close();
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  });
