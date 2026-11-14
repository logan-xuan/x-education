import { test, expect, type Page } from '@playwright/test';

const key = 'e2e-fixed-teacher-secret-2026';
const teacherLink = `/teacher#key=${key}`;
async function loginStudent(page: Page, groupName = '端到端测试组', studentNumber = '03') {
  await expect(page.getByRole('heading', { name: '学生登录', exact: true })).toBeVisible();
  await page.getByLabel('小组名', { exact: true }).fill(groupName);
  await page.getByLabel('编号', { exact: true }).fill(studentNumber);
  await page.getByRole('button', { name: '进入课堂', exact: true }).click();
  await expect(page.getByRole('button', { name: '切换身份', exact: true })).toBeVisible();
}
async function fillAnswer(page: Page, wrong = false) {
  const fields = {
    secondCount: wrong ? '20' : '10',
    thirdCount: wrong ? '450' : '500',
    winningCount: wrong ? '475' : '515',
    winningRate: wrong ? '47.5' : '51.5',
    totalAmount: wrong ? '3150' : '3200',
    reason: '先保证中奖率，再安排剩余预算。',
  };
  for (const [name, value] of Object.entries(fields)) {
    const field = page.locator(`[name="${name}"]`);
    if (await field.isEditable()) await field.fill(value);
  }
}

test('students wait for review; teachers return and approve work without exposing automatic results', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/questions/red-packet');
  await loginStudent(page);
  await expect(page.getByRole('heading', { name: '直播间红包雨策划任务' })).toBeVisible();
  await expect(page.locator('a[href^="/teacher"]')).toHaveCount(0);
  await fillAnswer(page);
  const submitted = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/submissions'),
  );
  await page.getByRole('button', { name: '提交方案，等待审核' }).click();
  const response = await (await submitted).json();
  expect(response.reviewStatus).toBe('pending');
  expect(response).not.toHaveProperty('grading');
  await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
  await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
  await expect(page.locator('.cat-comfort')).toHaveCount(0);
  await expect(page.getByText('逐项核验')).toHaveCount(0);
  await expect(page.getByText('实际中奖率', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '修改后重新提交' })).toHaveCount(0);
  const receiptUrl = page.url();
  await page.reload();
  await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
  const teacherContext = await browser.newContext(),
    teacher = await teacherContext.newPage();
  try {
    await teacher.goto(teacherLink);
    await expect(teacher.getByRole('heading', { name: '题目管理', exact: true })).toBeVisible();
    expect(teacher.url()).not.toContain('#');
    await teacher.getByRole('link', { name: '提交记录', exact: true }).click();
    await expect(teacher.getByRole('button', { name: /导出/ })).toHaveCount(0);
    await teacher
      .getByRole('row')
      .filter({ hasText: '端到端测试组' })
      .getByRole('button', { name: '查看详情' })
      .click();
    const detail = teacher.getByRole('dialog', { name: '答案详情' });
    await expect(detail.getByText('自动核算参考（仅老师可见）', { exact: true })).toBeVisible();
    await detail.getByRole('button', { name: '退回重答', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('填写修改意见');
    await detail.getByLabel('审核意见').fill('请补充预算分配的思考过程。');
    await detail.getByRole('button', { name: '退回重答', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('已退回重答');
    await page.getByRole('button', { name: '刷新审核状态' }).click();
    await expect(page.getByRole('heading', { name: '没关系，我们再试一次！' })).toBeVisible();
    await expect(page.locator('.cat-comfort')).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    await page.getByRole('button', { name: '摸摸小橘' }).click();
    await expect(page.locator('.cat-speech')).toContainText('每一次尝试，都在进步');
    await page.getByRole('button', { name: '让小橘休息' }).click();
    await expect(page.locator('.cat-buddy')).toHaveClass(/cat-resting/);
    await page.getByRole('button', { name: '叫醒小橘' }).click();
    await expect(page.locator('.cat-buddy')).not.toHaveClass(/cat-resting/);
    await page.screenshot({
      path: 'test-results/student-cat-comfort.png',
      fullPage: true,
      animations: 'disabled',
    });
    await expect(page.getByText('请补充预算分配的思考过程。', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '修改后重新提交' }).click();
    await expect(page.getByLabel('当前答题身份')).toContainText('编号：03');
    await fillAnswer(page, true);
    await page.getByRole('button', { name: '提交方案，等待审核' }).click();
    await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
    await expect(page.getByText(/低于最低要求/)).toHaveCount(0);
    await detail.getByRole('button', { name: '关闭弹窗' }).click();
    await teacher.getByRole('button', { name: '刷新', exact: true }).click();
    await expect(teacher.locator('tbody tr')).toHaveCount(1);
    await teacher.getByRole('button', { name: '查看详情' }).click();
    await detail.getByRole('button', { name: '提交历史（2）' }).click();
    await expect(detail.locator('.history-item')).toHaveCount(2);
    await detail.getByRole('button', { name: '本次答案', exact: true }).click();
    await expect(detail.getByText(/低于最低要求 50%/)).toBeVisible();
    await detail.getByLabel('审核意见').fill('已完成课堂讨论，本次通过。');
    await detail.getByRole('button', { name: '审核通过', exact: true }).click();
    await expect(detail.getByRole('status')).toContainText('已审核通过');
    await page.getByRole('button', { name: '刷新审核状态' }).click();
    await expect(page.getByRole('heading', { name: '恭喜你答对了！' })).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toBeVisible();
    await expect(page.locator('.rain-packet')).toHaveCount(68);
    await page.getByRole('button', { name: '收起红包雨' }).click();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    await page.getByRole('button', { name: '刷新审核状态' }).click();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    await page.getByRole('button', { name: '再看一次红包雨' }).click();
    await expect(page.getByTestId('red-packet-rain')).toBeVisible();
    await expect
      .poll(() =>
        page.locator('.rain-packet').evaluateAll(
          (packets) =>
            packets.filter((packet) => {
              const rect = packet.getBoundingClientRect();
              return (
                rect.bottom > 0 &&
                rect.top < window.innerHeight &&
                rect.right > 0 &&
                rect.left < window.innerWidth
              );
            }).length,
        ),
      )
      .toBeGreaterThan(15);
    await page.screenshot({ path: 'test-results/student-celebration.png' });
    await page.getByRole('button', { name: '收起红包雨' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: '恭喜你答对了！' })).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '修改后重新提交' })).toHaveCount(0);
    await expect(page.getByText('自动核算参考（仅老师可见）')).toHaveCount(0);
    await detail.getByRole('button', { name: '关闭弹窗' }).click();
    await teacher.getByLabel('筛选审核状态').selectOption('returned');
    await expect(teacher.getByRole('heading', { name: '没有符合条件的记录' })).toBeVisible();
    await teacher.getByLabel('筛选提交范围').selectOption('false');
    await expect(teacher.locator('tbody tr')).toHaveCount(1);
    await teacher.getByLabel('搜索组名或编号').fill('没有这个组');
    await expect(teacher.getByRole('heading', { name: '没有符合条件的记录' })).toBeVisible();
    await teacher.getByRole('button', { name: '清除筛选' }).click();
    await expect(teacher.locator('tbody tr')).toHaveCount(1);
    await teacher.screenshot({ path: 'test-results/teacher-records-desktop.png', fullPage: true });
    await page.goto('/teacher');
    await expect(page.getByRole('heading', { name: '请使用老师专属链接进入' })).toBeVisible();
    expect((await page.request.get('/api/teacher/questions')).status()).toBe(401);
    await page.goto(receiptUrl);
    await expect(page.getByRole('link', { name: '查看最新提交' })).toBeVisible();
    await expect(page.getByRole('button', { name: '修改后重新提交' })).toHaveCount(0);
    await page.getByRole('link', { name: '查看最新提交' }).click();
    await expect(page.getByRole('heading', { name: '恭喜你答对了！' })).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await teacherContext.close();
  }
});

test('teacher creates, publishes, edits, closes and reopens tasks; student cannot submit stale versions', async ({
  page,
  browser,
}) => {
  await page.goto(teacherLink);
  await page.getByRole('link', { name: '新建题目' }).click();
  await page.getByLabel('题目名称').fill('自定义课堂任务');
  await page.getByLabel('任务情境').fill('请综合考虑中奖率和预算，设计你自己的方案。');
  await page.getByLabel('总预算').fill('2800');
  await page.getByRole('button', { name: '保存草稿' }).click();
  await expect(page.getByRole('alert')).toContainText('无法达到最低中奖率');
  await page.getByLabel('总预算').fill('3300');
  await page.getByRole('button', { name: '保存草稿' }).click();
  const card = page
    .locator('.question-card')
    .filter({ has: page.getByRole('heading', { name: '自定义课堂任务', exact: true }) });
  await expect(card.getByText('草稿', { exact: true })).toBeVisible();
  const tasks = await (await page.request.get('/api/teacher/questions')).json();
  const task = tasks.find((q: { title: string }) => q.title === '自定义课堂任务');
  const studentContext = await browser.newContext(),
    student = await studentContext.newPage();
  try {
    expect((await student.request.get(`/api/questions/${task.id}`)).status()).toBe(404);
    await card.getByRole('button', { name: '发布题目' }).click();
    await expect(card.getByText('收集中', { exact: true })).toBeVisible();
    await card.getByRole('button', { name: '答题链接' }).click();
    const sharing = page.getByRole('dialog', { name: '分享学生答题链接' });
    expect(await sharing.getByLabel('学生答题链接').inputValue()).toBe(
      `http://127.0.0.1:4318/questions/${task.id}`,
    );
    await sharing.getByRole('button', { name: '关闭弹窗' }).click();
    await student.goto(`/questions/${task.id}`);
    await loginStudent(student);
    await fillAnswer(student);
    await card.getByRole('link', { name: '编辑', exact: true }).click();
    await page.getByLabel('总预算').fill('3400');
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(card).toBeVisible();
    await student.getByRole('button', { name: '提交方案，等待审核' }).click();
    await expect(student.getByRole('alert')).toContainText('老师已更新题目');
    await student.getByRole('button', { name: '重新载入最新题目' }).click();
    await student.getByRole('button', { name: '提交方案，等待审核' }).click();
    await expect(student.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
    await card.getByRole('button', { name: '关闭提交' }).click();
    await page.getByRole('button', { name: '确认关闭' }).click();
    await expect(card.getByText('已关闭', { exact: true })).toBeVisible();
    await student.goto(`/questions/${task.id}`);
    await expect(student.getByRole('alert')).toContainText('本题已结束收集');
    await expect(student.getByRole('button', { name: '提交方案，等待审核' })).toHaveCount(0);
    await card.getByRole('button', { name: '重新开放' }).click();
    await expect(card.getByText('收集中', { exact: true })).toBeVisible();
  } finally {
    await studentContext.close();
  }
});

test('student and teacher layouts fit mobile screens and preserve working access controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/questions/red-packet');
  await loginStudent(page, '移动审核组');
  await expect(page.getByRole('heading', { name: '方案申报表' })).toBeVisible();
  await expect(page.locator('a[href^="/teacher"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: 'test-results/student-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await fillAnswer(page);
  await page.getByRole('button', { name: '提交方案，等待审核' }).click();
  await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
  await page.goto(teacherLink);
  await page.getByRole('link', { name: '提交记录', exact: true }).click();
  await page.getByLabel('查看题目').selectOption('red-packet');
  await expect(page.locator('tbody tr').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: '查看详情' }).first().click();
  const detail = page.getByRole('dialog', { name: '答案详情' });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: '审核通过' })).toBeVisible();
  await page.screenshot({ path: 'test-results/teacher-detail-mobile.png', fullPage: true });
  await detail.getByRole('button', { name: '关闭弹窗' }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/questions/red-packet');
  await expect(page.getByRole('heading', { name: '我的答题状态' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto(teacherLink);
  await page.getByRole('button', { name: '退出管理' }).click();
  await expect(page.getByRole('heading', { name: '请使用老师专属链接进入' })).toBeVisible();
  expect((await page.request.get('/api/teacher/questions')).status()).toBe(401);
});

test('a teacher can reopen the fixed management link in the same tab after an invalid key or logout', async ({
  page,
}) => {
  await page.goto('/teacher#key=invalid-key');
  await expect(page.getByRole('heading', { name: '请使用老师专属链接进入' })).toBeVisible();
  await page.evaluate((key) => {
    window.location.hash = `key=${key}`;
  }, key);
  await expect(page.getByRole('heading', { name: '题目管理', exact: true })).toBeVisible();
  expect(page.url()).not.toContain('#');
  await page.getByRole('button', { name: '退出管理' }).click();
  await expect(page.getByRole('heading', { name: '请使用老师专属链接进入' })).toBeVisible();
  await page.evaluate((key) => {
    window.location.hash = `key=${key}`;
  }, key);
  await expect(page.getByRole('heading', { name: '题目管理', exact: true })).toBeVisible();
  expect(page.url()).not.toContain('#');
});

test('a failed teacher verification keeps the management key available for retry and refresh', async ({
  page,
}) => {
  let failFirstVerification = true;
  await page.route('**/api/teacher/session', async (route) => {
    if (route.request().method() === 'POST' && failFirstVerification) {
      failFirstVerification = false;
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: '验证请求暂时失败，请重试' }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(teacherLink);
  await expect(page.getByRole('alert')).toContainText('验证请求暂时失败');
  expect(page.url()).toContain(`#key=${key}`);
  await page.getByRole('button', { name: '重新验证', exact: true }).click();
  await expect(page.getByRole('heading', { name: '题目管理', exact: true })).toBeVisible();
  expect(page.url()).not.toContain('#');
  await page.reload();
  await expect(page.getByRole('heading', { name: '题目管理', exact: true })).toBeVisible();
});

test('passwordless student login restores work and separates identities on a shared browser', async ({
  page,
}) => {
  await page.goto('/questions/red-packet');
  await expect(page.getByRole('heading', { name: '学生登录', exact: true })).toBeVisible();
  await page.screenshot({
    path: 'test-results/student-login.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '进入课堂' }).click();
  expect(
    await page
      .getByLabel('编号', { exact: true })
      .evaluate((input) => (input as HTMLInputElement).validity.valueMissing),
  ).toBe(true);
  await loginStudent(page, '', '006');
  await expect(page.getByLabel('当前答题身份')).toContainText('未分组');
  await expect(page.locator('input[name="groupName"]')).toHaveCount(0);
  const original = (await (await page.request.get('/api/student/session')).json()).student;
  await fillAnswer(page);
  await page.getByRole('button', { name: '提交方案，等待审核' }).click();
  await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
  const receipt = page.url().split('/results/')[1];
  await page.getByRole('link', { name: '我的提交', exact: true }).click();
  await expect(page.locator('.question-card')).toHaveCount(1);
  await page.getByRole('button', { name: '切换身份', exact: true }).click();
  await expect(page.getByRole('heading', { name: '学生登录', exact: true })).toBeVisible();
  expect((await page.request.get(`/api/receipts/${receipt}`)).status()).toBe(401);
  await loginStudent(page, '其他小组', '006');
  await page.getByRole('link', { name: '我的提交', exact: true }).click();
  await expect(page.getByRole('heading', { name: '还没有提交记录' })).toBeVisible();
  expect((await page.request.get(`/api/receipts/${receipt}`)).status()).toBe(404);
  await page.getByRole('button', { name: '切换身份', exact: true }).click();
  await loginStudent(page, '', '006');
  const restored = (await (await page.request.get('/api/student/session')).json()).student;
  expect(restored.id).toBe(original.id);
  await page.getByRole('link', { name: '我的提交', exact: true }).click();
  await expect(page.locator('.question-card')).toHaveCount(1);
  await expect(page.locator('.question-card')).toContainText('待审核');
  await page.getByRole('link', { name: '查看审核状态', exact: true }).click();
  await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
  await expect(page.getByText('实际中奖率', { exact: true })).toHaveCount(0);
  await page.goto('/login?next=https%3A%2F%2Fother.example%2Fteacher');
  await expect(page).toHaveURL('http://127.0.0.1:4318/');
  expect((await page.request.get('/api/teacher/questions')).status()).toBe(401);
});

test('celebration follows a teacher decision, ends automatically and respects reduced motion on mobile', async ({
  page,
  browser,
}) => {
  const teacherContext = await browser.newContext();
  try {
    await page.clock.install();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/questions/red-packet');
    await loginStudent(page, '动画验收组', '08');
    await fillAnswer(page);
    await page.getByRole('button', { name: '提交方案，等待审核' }).click();
    await expect(page.getByRole('heading', { name: '提交成功，等待老师审核' })).toBeVisible();
    const receipt = page.url().split('/results/')[1];
    // View the task itself while the teacher reviews, matching the classroom's shared-screen flow.
    await page.goto('/questions/red-packet');
    await expect(page.getByRole('heading', { name: '我的答题状态' })).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    expect(
      (
        await teacherContext.request.post('http://127.0.0.1:4318/api/teacher/session', {
          headers: { Authorization: `Bearer ${key}` },
        })
      ).ok(),
    ).toBe(true);
    const records = await (
      await teacherContext.request.get(
        'http://127.0.0.1:4318/api/teacher/submissions?questionId=red-packet',
      )
    ).json();
    const record = records.items.find((s: { receipt: string }) => s.receipt === receipt);
    expect(record).toBeTruthy();
    expect(
      (
        await teacherContext.request.patch(
          `http://127.0.0.1:4318/api/teacher/submissions/${record.id}/review`,
          {
            data: {
              status: 'approved',
              feedback: '思考很认真，继续加油！',
              reviewVersion: record.reviewVersion,
            },
          },
        )
      ).ok(),
    ).toBe(true);
    await page.clock.fastForward(10_001);
    await expect(page.getByRole('heading', { name: '恭喜你答对了！' })).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toBeVisible();
    await expect(page.locator('.rain-packet').first()).toHaveCSS('animation-name', 'none');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('red-packet-rain').getByRole('status')).toContainText(
      '恭喜你答对了！',
    );
    await expect(page.getByTestId('red-packet-rain').getByRole('status')).toBeInViewport();
    expect(await page.locator('.rain-packet:visible').count()).toBe(8);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: 'test-results/student-approved-mobile.png', fullPage: true });
    await page.clock.fastForward(8_001);
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    await page.getByRole('button', { name: '再看一次红包雨' }).click();
    await expect(page.getByTestId('red-packet-rain')).toBeVisible();
    await page.getByRole('button', { name: '收起红包雨' }).click();
    await page.goto(`/results/${receipt}`);
    await expect(page.getByRole('heading', { name: '恭喜你答对了！' })).toBeVisible();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 720 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: '再看一次红包雨' }).click();
    await expect(page.locator('.rain-packet').first()).toHaveCSS(
      'animation-name',
      'red-packet-fall',
    );
    await page.clock.fastForward(2_000);
    await page.getByRole('button', { name: '收起红包雨' }).click();
    await expect(page.getByTestId('red-packet-rain')).toHaveCount(0);
    expect((await page.request.get(`/api/receipts/${receipt}`)).ok()).toBe(true);
  } finally {
    await teacherContext.close();
  }
});
