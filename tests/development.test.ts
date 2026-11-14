import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite';
import viteConfig from '../vite.config.js';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';
import type { PublicSubmission } from '../shared/model.js';

test('the real development proxy accepts same-origin student and teacher writes and rejects cross-site writes', async (t) => {
  const store = new Store(':memory:');
  const password = 'development-proxy-test-key-2026';
  const backend = createApp({ store, teacherPassword: password }).listen(0, '127.0.0.1');
  let proxy: ViteDevServer | undefined;
  t.after(async () => {
    await proxy?.close();
    await new Promise<void>((resolve, reject) =>
      backend.close((error) => (error ? reject(error) : resolve())),
    );
    store.close();
  });
  await once(backend, 'listening');
  const target = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
  const rule = viteConfig.server!.proxy!['/api'];
  // Keep the application's proxy behavior; replace only the test backend address.
  const testRule = typeof rule === 'string' ? target : { ...rule, target };
  proxy = await createServer({
    ...viteConfig,
    configFile: false,
    logLevel: 'silent',
    server: {
      ...viteConfig.server,
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      open: false,
      proxy: { '/api': testRule },
    },
  });
  await proxy.listen();
  const origin = `http://127.0.0.1:${(proxy.httpServer!.address() as AddressInfo).port}`;
  const answer = {
    questionVersion: 1,
    identity: { groupName: '开发代理测试组', studentNumber: '01' },
    answer: {
      secondCount: 10,
      thirdCount: 500,
      winningCount: 515,
      winningRate: 51.5,
      totalAmount: 3200,
      reason: '验证真实开发代理路径。',
    },
  };
  const submitted = await fetch(`${origin}/api/questions/red-packet/submissions`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(answer),
  });
  assert.equal(submitted.status, 201, await submitted.clone().text());
  const first = (await submitted.json()) as PublicSubmission;
  assert.equal(first.reviewStatus, 'pending');
  assert.equal('grading' in first, false);

  const incorrect = await fetch(`${origin}/api/questions/red-packet/submissions`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...answer,
      identity: { ...answer.identity, studentNumber: '02' },
      answer: {
        secondCount: 10,
        thirdCount: 333,
        winningCount: 2323,
        winningRate: 232,
        totalAmount: 2323,
        reason: '验证截图中的未达标方案仍能提交并得到判定。',
      },
    }),
  });
  assert.equal(incorrect.status, 201);
  const incorrectResult = (await incorrect.json()) as PublicSubmission;
  assert.equal(incorrectResult.reviewStatus, 'pending');
  assert.equal('grading' in incorrectResult, false);
  assert.deepEqual(store.receipt(incorrectResult.receipt).grading.computed, {
    winningCount: 348,
    winningRate: 34.8,
    totalAmount: 2365,
  });

  const teacher = await fetch(`${origin}/api/teacher/session`, {
    method: 'POST',
    headers: { Origin: origin, Authorization: `Bearer ${password}` },
  });
  assert.equal(teacher.status, 200);
  const cookie = teacher.headers.get('set-cookie')!.split(';')[0];
  const changed = await fetch(`${origin}/api/teacher/questions/red-packet/status`, {
    method: 'PATCH',
    headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'closed', version: 1 }),
  });
  assert.equal(changed.status, 200);

  for (const path of ['/api/questions/red-packet/submissions', '/api/teacher/session']) {
    const rejected = await fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' },
      body: JSON.stringify(answer),
    });
    assert.equal(rejected.status, 403);
  }
});
