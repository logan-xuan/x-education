import type { Answer, Check, Grading, Rules } from '../shared/model.js';

export function grade(answer: Answer, rules: Rules): Grading {
  const winningCount = rules.fixedCount + answer.secondCount + answer.thirdCount;
  const rawRate = (winningCount / rules.totalTickets) * 100;
  const winningRate = Math.round((winningCount * 10_000) / rules.totalTickets) / 100;
  const totalAmount =
    rules.fixedCount * rules.fixedValue +
    answer.secondCount * rules.secondValue +
    answer.thirdCount * rules.thirdValue;
  const validCounts = [answer.secondCount, answer.thirdCount].every(
    (n) => Number.isSafeInteger(n) && n >= 0,
  );
  const ratePassed = winningCount * 100 >= rules.totalTickets * rules.minWinRate;
  const detailedRate =
    !ratePassed && winningRate >= rules.minWinRate ? Number(rawRate.toFixed(6)) : winningRate;
  const same = (a: number, b: number) => Math.abs(a - b) < 0.000001;
  const calculationCorrect =
    answer.winningCount === winningCount &&
    same(answer.winningRate, winningRate) &&
    same(answer.totalAmount, totalAmount);
  const checks: Check[] = [
    {
      code: 'quantity',
      label: '奖券数量合法',
      passed: validCounts && winningCount <= rules.totalTickets,
      detail: !validCounts
        ? '二等奖与三等奖的数量必须为非负整数。'
        : `${rules.fixedCount} + ${answer.secondCount} + ${answer.thirdCount} = ${winningCount} 张${winningCount > rules.totalTickets ? `，超过总券数 ${rules.totalTickets} 张。` : `，未超过总券数 ${rules.totalTickets} 张。`}`,
    },
    {
      code: 'rate',
      label: '中奖率达到要求',
      passed: ratePassed,
      detail: `${winningCount} ÷ ${rules.totalTickets} × 100% = ${detailedRate}%，${ratePassed ? '达到' : '低于'}最低要求 ${rules.minWinRate}%。`,
    },
    {
      code: 'budget',
      label: '总奖金未超预算',
      passed: totalAmount <= rules.budget,
      detail: `总奖金 ${totalAmount} 元，预算 ${rules.budget} 元，${totalAmount <= rules.budget ? `剩余 ${rules.budget - totalAmount}` : `超出 ${totalAmount - rules.budget}`} 元。`,
    },
    {
      code: 'calculation',
      label: '填写的计算结果正确',
      passed: calculationCorrect,
      detail: calculationCorrect
        ? '总中奖券数、中奖率、总奖金均与系统核算一致。'
        : `请核对：中奖券 ${winningCount} 张，中奖率 ${winningRate}%，总奖金 ${totalAmount} 元。`,
    },
  ];
  const schemeValid = checks.slice(0, 3).every((c) => c.passed);
  return {
    isCorrect: schemeValid && calculationCorrect,
    schemeValid,
    calculationCorrect,
    computed: { winningCount, winningRate, totalAmount },
    checks,
  };
}
