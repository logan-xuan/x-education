import { test, expect, type Browser, type Page } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4318';
async function approvedRound(page: Page, browser: Browser, identity: string) {
  const teacher = await browser.newContext({ baseURL });
  try {
    expect(
      (
        await teacher.request.post('/api/teacher/session', {
          headers: { Authorization: 'Bearer e2e-fixed-teacher-secret-2026' },
        })
      ).ok(),
    ).toBe(true);
    const created = await teacher.request.post('/api/teacher/questions', {
      data: {
        title: `互动红包-${identity}`,
        description: '验证不同面额的课堂奖励。',
        status: 'published',
        rules: {
          totalTickets: 1000,
          minWinRate: 50,
          budget: 6000,
          fixedCount: 5,
          fixedValue: 168,
          secondValue: 36,
          thirdValue: 9,
        },
      },
    });
    expect(created.ok()).toBe(true);
    const question = await created.json();
    expect(
      (
        await page.request.post('/api/student/session', {
          data: { groupName: identity, studentNumber: '09' },
        })
      ).ok(),
    ).toBe(true);
    const submitted = await page.request.post(`/api/questions/${question.id}/submissions`, {
      data: {
        questionVersion: question.version,
        answer: {
          secondCount: 10,
          thirdCount: 500,
          winningCount: 515,
          winningRate: 51.5,
          totalAmount: 5700,
          reason: '先计算中奖率，再检查预算。',
        },
      },
    });
    expect(submitted.ok()).toBe(true);
    const submission = await submitted.json();
    expect(submission.reviewStatus).toBe('pending');
    expect(submission).not.toHaveProperty('grading');
    const records = await (
      await teacher.request.get(`/api/teacher/submissions?questionId=${question.id}`)
    ).json();
    expect(
      (
        await teacher.request.patch(`/api/teacher/submissions/${records.items[0].id}/review`, {
          data: { status: 'approved', reviewVersion: 0 },
        })
      ).ok(),
    ).toBe(true);
    // Later edits must not change the reward denominations of the submitted version.
    expect(
      (
        await teacher.request.put(`/api/teacher/questions/${question.id}`, {
          data: {
            ...question,
            rules: {
              ...question.rules,
              budget: 12000,
              fixedValue: 268,
              secondValue: 46,
              thirdValue: 12,
            },
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/results/${submission.receipt}`);
    await expect(page.getByRole('dialog', { name: '接红包小游戏' })).toBeVisible();
    await expect(page.locator('[data-prize="fixed"] strong')).toHaveText('168元');
    await expect(page.locator('[data-prize="second"] strong')).toHaveText('36元');
    await expect(page.locator('[data-prize="third"] strong')).toHaveText('9元');
  } finally {
    await teacher.close();
  }
}
async function targetPacket(page: Page) {
  return page.locator('.rain-packet:not(.packet-caught)').evaluateAll((nodes) => {
    const candidates = nodes.flatMap((node) => {
      if (!node.getClientRects().length) return [];
      const r = node.getBoundingClientRect(),
        x = r.left + r.width / 2,
        y = r.top + r.height / 2;
      return x > 38 && x < innerWidth - 38 && y > 185 && y < innerHeight - 265
        ? [{ id: node.getAttribute('data-packet-id')!, x, y }]
        : [];
    });
    if (!candidates.length) throw new Error('No reachable packet in the play area');
    return candidates[0];
  });
}
async function correctTotals(page: Page) {
  const counts = await Promise.all(
    ['fixed', 'second', 'third'].map(async (kind) =>
      parseInt(await page.getByTestId(`prize-count-${kind}`).innerText(), 10),
    ),
  );
  expect(await page.getByTestId('rain-caught-count').innerText()).toBe(
    String(counts.reduce((a, b) => a + b, 0)),
  );
  expect(await page.getByTestId('rain-total').innerText()).toBe(
    (counts[0] * 168 + counts[1] * 36 + counts[2] * 9).toLocaleString('zh-CN'),
  );
}

test('a mouse can swipe open packets exactly once and rewards use the approved question snapshot', async ({
  page,
  browser,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await approvedRound(page, browser, '鼠标红包组');
  const target = await targetPacket(page);
  // Neither endpoint needs to land inside a packet: the entire swipe is tested.
  await page.mouse.move(Math.max(1, target.x - 36), target.y);
  await page.mouse.move(target.x + 38, target.y);
  await expect(page.locator(`[data-packet-id="${target.id}"]`)).toHaveClass(/packet-caught/);
  const opened = await page.getByTestId('rain-caught-count').innerText();
  expect(Number(opened)).toBeGreaterThan(0);
  await page.mouse.move(target.x, target.y);
  await page.mouse.move(target.x + 1, target.y + 1);
  await expect(page.getByTestId('rain-caught-count')).toHaveText(opened);
  await expect(page.locator('.rain-latest')).toContainText(
    /接到(超级免单券|二等奖|三等奖)，(168|36|9)元/,
  );
  await correctTotals(page);
  await page.screenshot({ path: 'test-results/packet-game-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
  expect(await page.locator('body').evaluate((node) => node.style.overflow)).not.toBe('hidden');
  expect(await page.locator('#root').evaluate((node) => node.inert)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: '再看一次红包雨' }).click();
  const moving = await targetPacket(page);
  await page.mouse.move(moving.x, moving.y);
  await expect(page.getByTestId('rain-caught-count')).not.toHaveText('0');
  await expect(page.locator('.rain-reveal').first()).toContainText(/(超级免单券|二等奖|三等奖)/);
  await expect
    .poll(() =>
      page
        .locator('.rain-reveal')
        .first()
        .evaluate((node) => Number(getComputedStyle(node).opacity)),
    )
    .toBeGreaterThan(0.5);
  await page.screenshot({ path: 'test-results/packet-game-reveal.png' });
  await page.keyboard.press('Escape');
});

test('touch swipes collect rewards without scrolling; the summary, replay and keyboard control work on mobile', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await approvedRound(page, browser, '手指红包组');
    const target = await targetPacket(page),
      initialScroll = await page.evaluate(() => scrollY);
    const touch = await context.newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: target.x - 30, y: target.y }],
    });
    await touch.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: target.x + 30, y: target.y }],
    });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator(`[data-packet-id="${target.id}"]`)).toHaveClass(/packet-caught/);
    expect(await page.evaluate(() => scrollY)).toBe(initialScroll);
    await correctTotals(page);
    await page.screenshot({ path: 'test-results/packet-game-mobile.png' });
    await page.clock.fastForward(20_001);
    await expect(page.getByRole('heading', { name: '红包收好啦！' })).toBeVisible();
    expect(
      await page
        .getByRole('button', { name: '再玩一次' })
        .evaluate((node) => document.activeElement === node),
    ).toBe(true);
    await page.screenshot({
      path: 'test-results/packet-game-summary-mobile.png',
      animations: 'disabled',
    });
    await page.getByRole('button', { name: '再玩一次' }).click();
    await expect(page.getByTestId('rain-caught-count')).toHaveText('0');
    await expect(page.getByTestId('rain-total')).toHaveText('0');
    await page.getByRole('button', { name: '接一个红包', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('rain-caught-count')).toHaveText('1');
    await correctTotals(page);
    await page.setViewportSize({ width: 320, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: '收起红包雨' })).toBeInViewport();
    await expect(page.getByRole('button', { name: '接一个红包', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: '收起红包雨' }).click();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    expect(errors).toEqual([]);
    await touch.detach();
  } finally {
    await context.close();
  }
});
