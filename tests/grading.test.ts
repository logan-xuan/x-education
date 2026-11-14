import test from 'node:test';
import assert from 'node:assert/strict';
import { grade } from '../server/grading.js';
import { defaultQuestion, rulesSchema, type Answer } from '../shared/model.js';

const rules = defaultQuestion.rules;
function answer(secondCount: number, thirdCount: number): Answer {
  const winningCount = rules.fixedCount + secondCount + thirdCount;
  return {
    secondCount,
    thirdCount,
    winningCount,
    winningRate: winningCount / 10,
    totalAmount: 500 + secondCount * 20 + thirdCount * 5,
    reason: '设计理由',
  };
}
test('accepts multiple valid plans, including an exact boundary and unspent budget', () => {
  for (const [x, y] of [
    [10, 500],
    [15, 480],
    [0, 495],
    [5, 500],
  ])
    assert.equal(grade(answer(x, y), rules).isCorrect, true);
});
test('rejects a plan one winning ticket below the minimum', () => {
  const result = grade(answer(0, 494), rules);
  assert.equal(result.checks.find((c) => c.code === 'rate')!.passed, false);
  assert.equal(result.isCorrect, false);
});
test('rejects a plan over budget even when the win rate is sufficient', () => {
  const result = grade(answer(16, 479), rules);
  assert.equal(result.computed.winningCount, 500);
  assert.equal(result.computed.totalAmount, 3215);
  assert.equal(result.checks.find((c) => c.code === 'budget')!.passed, false);
});
test('rejects more winners than total tickets and invalid variable quantities', () => {
  for (const a of [answer(0, 1000), answer(-1, 501), answer(0.5, 500)])
    assert.equal(grade(a, rules).checks[0].passed, false);
});
test('distinguishes a valid plan from incorrect student arithmetic', () => {
  for (const field of ['winningCount', 'winningRate', 'totalAmount'] as const) {
    const a = answer(10, 500);
    a[field] += 1;
    const result = grade(a, rules);
    assert.equal(result.schemeValid, true);
    assert.equal(result.calculationCorrect, false);
    assert.equal(result.isCorrect, false);
  }
});
test('uses the exact rate for the constraint and a rounded rate for student arithmetic', () => {
  const a = {
    secondCount: 0,
    thirdCount: 499994,
    winningCount: 499999,
    winningRate: 50,
    totalAmount: 2500470,
    reason: '不应通过',
  };
  const result = grade(a, { ...rules, totalTickets: 1_000_000, budget: 10_000_000 });
  assert.equal(result.computed.winningRate, 50);
  assert.equal(result.checks[1].passed, false);
  assert.match(result.checks[1].detail, /49\.9999%/);
  assert.equal(result.calculationCorrect, true);
  assert.equal(result.isCorrect, false);
});
test('rounds non-terminating winning percentages to two decimals', () => {
  const result = grade(
    {
      secondCount: 0,
      thirdCount: 162,
      winningCount: 167,
      winningRate: 50.15,
      totalAmount: 1310,
      reason: '约 50.15%',
    },
    { ...rules, totalTickets: 333 },
  );
  assert.equal(result.isCorrect, true);
});
test('prevents teachers from publishing mathematically impossible conditions', () => {
  assert.equal(rulesSchema.safeParse({ ...rules, budget: 2975 }).success, true);
  assert.equal(rulesSchema.safeParse({ ...rules, budget: 2974 }).success, false);
  assert.equal(rulesSchema.safeParse({ ...rules, fixedCount: 1001 }).success, false);
});
