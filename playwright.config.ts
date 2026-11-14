import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4318',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync(chrome) ? chrome : undefined),
    },
  },
  webServer: {
    command: 'node dist/server/index.js',
    url: 'http://127.0.0.1:4318/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '4318',
      HOST: '127.0.0.1',
      DATABASE_PATH: ':memory:',
      TEACHER_PASSWORD: 'e2e-fixed-teacher-secret-2026',
      NODE_ENV: 'test',
    },
  },
});
