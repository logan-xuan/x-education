import { z } from 'zod';

const integer = (max = 1_000_000) => z.number().int().min(0).max(max);
export const rulesSchema = z
  .object({
    totalTickets: integer().min(1),
    minWinRate: z.number().int().min(1).max(100),
    budget: integer(1_000_000_000),
    fixedCount: integer(),
    fixedValue: integer(),
    secondValue: integer().min(1),
    thirdValue: integer().min(1),
  })
  .superRefine((rules, ctx) => {
    if (rules.fixedCount > rules.totalTickets)
      ctx.addIssue({ code: 'custom', message: '固定奖券数量不能超过总券数', path: ['fixedCount'] });
    if (rules.fixedCount * rules.fixedValue > rules.budget)
      ctx.addIssue({ code: 'custom', message: '固定奖金额不能超过总预算', path: ['budget'] });
    // With a budget cap and a minimum win count, the cheapest feasible plan
    // assigns every additional required winner to the cheaper variable prize.
    const needed = Math.max(
      0,
      Math.ceil((rules.totalTickets * rules.minWinRate) / 100) - rules.fixedCount,
    );
    if (
      rules.fixedCount * rules.fixedValue + needed * Math.min(rules.secondValue, rules.thirdValue) >
      rules.budget
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '当前预算无法达到最低中奖率，请调整条件',
        path: ['budget'],
      });
    }
  });
export type Rules = z.infer<typeof rulesSchema>;
export const questionInputSchema = z.object({
  title: z.string().trim().min(1, '请填写题目名称').max(60),
  description: z.string().trim().min(1, '请填写任务情境').max(1500),
  rules: rulesSchema,
  status: z.enum(['draft', 'published', 'closed']).default('draft'),
});
export type QuestionInput = z.infer<typeof questionInputSchema>;
export interface Question extends QuestionInput {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface QuestionSummary extends Question {
  studentCount: number;
  submissionCount: number;
}
export const answerSchema = z.object({
  secondCount: integer(),
  thirdCount: integer(),
  winningCount: integer(2_000_001),
  winningRate: z.number().min(0).max(1_000_000),
  totalAmount: z.number().min(0).max(10_000_000_000_000),
  reason: z.string().trim().min(1, '请填写设计理由').max(500),
});
export const identitySchema = z.object({
  groupName: z.string().trim().max(30).default(''),
  studentNumber: z.string().trim().min(1, '请填写编号').max(30),
});
export const submissionInputSchema = z.object({
  questionVersion: z.number().int().positive(),
  previousReceipt: z
    .string()
    .regex(/^[A-Za-z0-9_-]{32}$/)
    .optional(),
  identity: identitySchema,
  answer: answerSchema,
});
export type Answer = z.infer<typeof answerSchema>;
export type Identity = z.infer<typeof identitySchema>;
export interface StudentProfile extends Identity {
  id: string;
  createdAt: string;
  lastLoginAt: string;
}
export const studentSubmissionSchema = submissionInputSchema
  .omit({ identity: true })
  .extend({ studentId: z.string().uuid().optional() });
export type SubmissionInput = z.infer<typeof submissionInputSchema>;
export interface Check {
  code: 'quantity' | 'rate' | 'budget' | 'calculation';
  label: string;
  passed: boolean;
  detail: string;
}
export interface Grading {
  isCorrect: boolean;
  schemeValid: boolean;
  calculationCorrect: boolean;
  computed: { winningCount: number; winningRate: number; totalAmount: number };
  checks: Check[];
}
export interface Submission {
  id: number;
  receipt: string;
  questionId: string;
  question: Question;
  identity: Identity;
  answer: Answer;
  grading: Grading;
  reviewStatus: ReviewStatus;
  reviewVersion: number;
  reviewedAt: string | null;
  feedback: string;
  feedbackUpdatedAt: string | null;
  createdAt: string;
}
export type ReviewStatus = 'pending' | 'approved' | 'returned';
export const reviewInputSchema = z
  .object({
    status: z.enum(['approved', 'returned']),
    feedback: z.string().trim().max(500).default(''),
    reviewVersion: z.number().int().min(0),
  })
  .superRefine((input, ctx) => {
    if (input.status === 'returned' && !input.feedback) {
      ctx.addIssue({ code: 'custom', path: ['feedback'], message: '退回重答时请填写修改意见' });
    }
  });
export type ReviewInput = z.infer<typeof reviewInputSchema>;
// Whitelist the student contract. Automatic grading must never leave teacher-only APIs.
export type PublicSubmission = Pick<
  Submission,
  | 'receipt'
  | 'questionId'
  | 'question'
  | 'identity'
  | 'answer'
  | 'reviewStatus'
  | 'reviewedAt'
  | 'createdAt'
> & {
  feedback: string;
  isLatest: boolean;
  latestReceipt: string;
  canResubmit: boolean;
  questionOpen: boolean;
};
export interface Stats {
  studentCount: number;
  submissionCount: number;
  pendingCount: number;
  approvedCount: number;
  returnedCount: number;
}
export interface RecordsResponse {
  items: Submission[];
  total: number;
  page: number;
  pageSize: number;
  stats: Stats;
}
export interface RecordFilters {
  questionId: string;
  search?: string;
  result?: 'all' | 'correct' | 'incorrect';
  reviewStatus?: 'all' | ReviewStatus;
  latest?: boolean;
  page?: number;
  pageSize?: number;
}
export const defaultQuestion: QuestionInput = {
  title: '直播间红包雨策划任务',
  description:
    '直播间即将上线红包雨活动，预算固定、中奖率有最低要求。请你设计一套红包分配方案，让预算花得合理，让惊喜如期发生。',
  status: 'published',
  rules: {
    totalTickets: 1000,
    minWinRate: 50,
    budget: 3200,
    fixedCount: 5,
    fixedValue: 100,
    secondValue: 20,
    thirdValue: 5,
  },
};
