import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  RefreshCw,
  ChevronRight,
  ClipboardList,
  Crown,
  Info,
  Lightbulb,
  LockKeyhole,
  PencilLine,
  Sparkles,
  Ticket,
} from 'lucide-react';
import type { PublicSubmission, Question } from '../../shared/model';
import { studentSubmissionSchema } from '../../shared/model';
import { useStudent } from '../student-context';
import { api, message } from '../api';
import { useResource } from '../hooks';
import {
  Alert,
  Button,
  ButtonLink,
  ErrorState,
  Footer,
  Header,
  Loading,
  Pill,
  ReviewBadge,
  Steps,
} from '../components/ui';

export type AnswerDraft = {
  secondCount: string;
  thirdCount: string;
  winningCount: string;
  winningRate: string;
  totalAmount: string;
  reason: string;
};
export const blankDraft: AnswerDraft = {
  secondCount: '',
  thirdCount: '',
  winningCount: '',
  winningRate: '',
  totalAmount: '',
  reason: '',
};
export const draftKey = (id: string, studentId: string, receipt?: string) =>
  `zhike-draft:${studentId}:${id}${receipt ? `:retry:${receipt}` : ''}`;
export function draftFromSubmission(s: PublicSubmission): AnswerDraft {
  return {
    secondCount: String(s.answer.secondCount),
    thirdCount: String(s.answer.thirdCount),
    winningCount: String(s.answer.winningCount),
    winningRate: String(s.answer.winningRate),
    totalAmount: String(s.answer.totalAmount),
    reason: s.answer.reason,
  };
}
function savedDraft(id: string, studentId: string, previous?: PublicSubmission): AnswerDraft {
  try {
    return {
      ...(previous ? draftFromSubmission(previous) : blankDraft),
      ...JSON.parse(sessionStorage.getItem(draftKey(id, studentId, previous?.receipt)) || '{}'),
    };
  } catch {
    return previous ? draftFromSubmission(previous) : blankDraft;
  }
}

export default function Student() {
  const [params] = useSearchParams();
  const retryReceipt = params.get('retry');
  const previous = useResource<PublicSubmission>(
    retryReceipt ? `/api/receipts/${encodeURIComponent(retryReceipt)}` : null,
  );
  const { id } = useParams(),
    resource = useResource<Question | null>(
      id ? `/api/questions/${encodeURIComponent(id)}` : '/api/questions/current',
    );
  return (
    <>
      <Header />
      <main className="student-main">
        {resource.loading || (retryReceipt && previous.loading) ? (
          <Loading label="正在准备课堂任务…" />
        ) : resource.error || previous.error ? (
          <ErrorState
            error={resource.error || previous.error}
            retry={() => {
              resource.reload();
              previous.reload();
            }}
          />
        ) : retryReceipt &&
          previous.data &&
          (!previous.data.canResubmit || previous.data.questionId !== resource.data?.id) ? (
          <section className="card empty-state">
            <h1>当前提交暂不能重答</h1>
            <p>
              {previous.data.reviewStatus === 'returned' && !previous.data.questionOpen
                ? '题目暂未开放，请等待老师重新开放。'
                : '只有老师退回的最新提交可以修改后重答。'}
            </p>
            <Link className="button primary" to={`/results/${previous.data.latestReceipt}`}>
              查看最新审核状态
            </Link>
          </section>
        ) : resource.data ? (
          <StudentTask
            key={`${resource.data.id}:${retryReceipt || 'new'}`}
            question={resource.data}
            previous={previous.data || undefined}
            reload={resource.reload}
          />
        ) : (
          <div className="empty-state">
            <ClipboardList size={36} />
            <h1>新的课堂任务正在准备中</h1>
            <p>老师发布后即可开始答题，请稍后再来。</p>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
function StudentTask({
  question: q,
  reload,
  previous,
}: {
  question: Question;
  reload: () => void;
  previous?: PublicSubmission;
}) {
  const r = q.rules,
    navigate = useNavigate();
  const { student } = useStudent();
  const mine = useResource<PublicSubmission[]>(
    previous ? null : `/api/student/submissions?questionId=${encodeURIComponent(q.id)}`,
    true,
  );
  const latest = mine.data?.[0];
  const [draft, setDraft] = useState<AnswerDraft>(() => savedDraft(q.id, student.id, previous));
  useEffect(() => {
    if (!latest || latest.reviewStatus !== 'pending' || previous) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') mine.reload();
    }, 10_000);
    return () => clearInterval(timer);
  }, [latest?.reviewStatus, latest?.receipt, previous, mine.reload]);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey(q.id, student.id, previous?.receipt), JSON.stringify(draft));
    } catch {
      /* Answering still works when browser storage is disabled. */
    }
  }, [draft, q.id, student.id, previous?.receipt]);
  function change(name: keyof AnswerDraft, value: string) {
    setDraft((d) => ({ ...d, [name]: value }));
    setError('');
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || q.status !== 'published') return;
    const result = studentSubmissionSchema.safeParse({
      questionVersion: q.version,
      previousReceipt: previous?.receipt,
      studentId: student.id,
      answer: {
        secondCount: Number(draft.secondCount),
        thirdCount: Number(draft.thirdCount),
        winningCount: Number(draft.winningCount),
        winningRate: Number(draft.winningRate),
        totalAmount: Number(draft.totalAmount),
        reason: draft.reason,
      },
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const receipt = await api<PublicSubmission>(`/api/questions/${q.id}/submissions`, {
        method: 'POST',
        body: JSON.stringify(result.data),
      });
      navigate(`/results/${receipt.receipt}`);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  function numeric(
    label: string,
    name: keyof AnswerDraft,
    unit: string,
    placeholder = '填写数量',
    decimal = false,
  ) {
    return (
      <label className="field">
        {label}
        <span className="input-unit">
          <input
            type="number"
            name={name}
            value={draft[name]}
            onChange={(e) => change(name, e.target.value)}
            placeholder={placeholder}
            min="0"
            max={
              name === 'totalAmount'
                ? 10_000_000_000_000
                : name === 'winningRate'
                  ? 1_000_000
                  : name === 'winningCount'
                    ? 2_000_001
                    : 1_000_000
            }
            step={decimal ? '0.01' : '1'}
            inputMode={decimal ? 'decimal' : 'numeric'}
            required
          />
          <span>{unit}</span>
        </span>
      </label>
    );
  }
  return (
    <>
      <div className="breadcrumb">
        <Link to="/">课堂任务</Link>
        <ChevronRight size={12} />
        <span>{q.title}</span>
      </div>
      <Steps />
      {previous && (
        <Alert>老师已退回本次答案：{previous.feedback}。请按当前题目条件修改后重新提交。</Alert>
      )}
      {q.status === 'closed' && <Alert>本题已结束收集。你仍可阅读题目，暂时无法提交新答案。</Alert>}
      <section className="task-hero">
        <div>
          <div className="eyebrow">
            S 级任务 · 生活中的数学{' '}
            <Pill kind={q.status === 'closed' ? 'neutral' : 'good'}>
              {q.status === 'closed' ? '已结束' : '进行中'}
            </Pill>
          </div>
          <h1>{q.title}</h1>
          <p>{q.description}</p>
        </div>
        <div className="envelope-scene" aria-hidden="true">
          <span className="luck-ticket">GOOD LUCK</span>
          <div className="envelope" />
          <span className="envelope-coin">✦</span>
          <span className="spark spark-a">✧</span>
          <span className="spark spark-b">✦</span>
        </div>
      </section>
      <div className="student-workspace">
        <div className="stack">
          <section className="card">
            <div className="section-heading">
              <h2>
                <ClipboardList />
                任务情报
              </h2>
              <span className="tiny">先读条件，再设计</span>
            </div>
            <div className="rules-grid">
              <div>
                <small>总券数</small>
                <strong>{r.totalTickets.toLocaleString()}</strong>
                <span>张</span>
              </div>
              <div className="key-rule">
                <small>最低中奖率</small>
                <strong>
                  {r.minWinRate}
                  <em>%</em>
                </strong>
              </div>
              <div>
                <small>总预算</small>
                <strong>{r.budget.toLocaleString()}</strong>
                <span>元</span>
              </div>
            </div>
            <div className="prize-row">
              <span>
                <i className="prize-icon warm">
                  <Crown size={15} />
                </i>
                超级免单券 <Pill kind="warm">固定 {r.fixedCount} 张</Pill>
              </span>
              <b>{r.fixedValue} 元 / 张</b>
            </div>
            <div className="prize-row">
              <span>
                <i className="prize-icon">
                  <Ticket size={15} />
                </i>
                二等奖
              </span>
              <b>{r.secondValue} 元 / 张</b>
            </div>
            <div className="prize-row">
              <span>
                <i className="prize-icon">
                  <Ticket size={15} />
                </i>
                三等奖
              </span>
              <b>{r.thirdValue} 元 / 张</b>
            </div>
            <div className="note">
              <Info size={15} />
              <span>超级免单券计入总中奖券数及总奖金。剩余券视为未中奖。</span>
            </div>
          </section>
          <section className="card">
            <div className="section-heading">
              <h2>
                <Lightbulb />
                你的挑战
              </h2>
            </div>
            {[
              ['找到条件之间的关系', '总券数、中奖券数、中奖率和总奖金，如何互相影响？'],
              ['设计一种整数分配方案', '分别安排多少张二等奖、三等奖，才能同时满足要求？'],
              ['算一算，并说明你的想法', '记录计算结果，写下设计理由，再提交给老师审核。'],
            ].map(([title, detail], i) => (
              <div className="challenge" key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </div>
              </div>
            ))}
            <div className="note">
              <Sparkles size={15} />
              <span>答案不止一种。符合条件就是好方案，不必花完全部预算。</span>
            </div>
          </section>
        </div>
        {!previous && mine.loading && !mine.data ? (
          <div className="card">
            <Loading label="正在读取我的提交状态…" />
          </div>
        ) : !previous && mine.error ? (
          <div className="card">
            <ErrorState error={mine.error} retry={mine.reload} />
          </div>
        ) : !previous && latest ? (
          <section className="card own-task-status">
            <div className="section-heading">
              <h2>我的答题状态</h2>
              <ReviewBadge status={latest.reviewStatus} />
            </div>
            <div className="student-session-card">
              <span>小组：{student.groupName || '未分组'}</span>
              <strong>编号：{student.studentNumber}</strong>
            </div>
            <h3>
              {latest.reviewStatus === 'pending'
                ? '答案已提交，等待老师审核'
                : latest.reviewStatus === 'approved'
                  ? '老师已审核通过'
                  : '老师已退回，请修改后重答'}
            </h3>
            <p>
              {latest.reviewStatus === 'pending'
                ? '请等待老师审核，本页会自动更新状态。'
                : latest.feedback || '本次审核已完成。'}
            </p>
            <div className="actions spaced">
              <ButtonLink primary to={`/results/${latest.receipt}`}>
                查看审核状态
              </ButtonLink>
              {latest.canResubmit && (
                <ButtonLink to={`/questions/${q.id}?retry=${latest.receipt}`}>
                  修改后重答
                </ButtonLink>
              )}
              <Button icon={RefreshCw} disabled={mine.loading} onClick={mine.reload}>
                刷新状态
              </Button>
            </div>
          </section>
        ) : (
          <form className="card answer-form" onSubmit={submit}>
            <div className="section-heading">
              <h2>
                <PencilLine />
                方案申报表
              </h2>
              <span className="tiny">所有项目均需填写</span>
            </div>
            <div className="student-session-card" aria-label="当前答题身份">
              <span>小组：{student.groupName || '未分组'}</span>
              <strong>编号：{student.studentNumber}</strong>
            </div>
            <div className="divider-label">我的分配方案</div>
            <div className="field-grid">
              {numeric(`二等奖（${r.secondValue} 元）`, 'secondCount', '张')}
              {numeric(`三等奖（${r.thirdValue} 元）`, 'thirdCount', '张')}
            </div>
            <div className="calculation-fields">
              {numeric('总中奖券数', 'winningCount', '张', '自己算一算')}
              {numeric('中奖率', 'winningRate', '%', '填写结果', true)}
              {numeric('总奖金', 'totalAmount', '元', '填写结果', true)}
            </div>
            <label className="field">
              我的设计理由
              <textarea
                name="reason"
                value={draft.reason}
                onChange={(e) => change('reason', e.target.value)}
                placeholder="说说你如何兼顾预算与中奖率……"
                maxLength={500}
                required
              />
            </label>
            <div className="field-help">
              <span>写下思考过程，老师会认真阅读</span>
              <span>{draft.reason.length} / 500</span>
            </div>
            {error && (
              <>
                <Alert>{error}</Alert>
                <button className="text-button" type="button" onClick={reload}>
                  重新载入最新题目
                </button>
              </>
            )}
            <button
              className="button primary full"
              type="submit"
              disabled={busy || q.status !== 'published'}
            >
              {q.status === 'closed' ? (
                <>
                  <LockKeyhole size={16} /> 本题已关闭提交
                </>
              ) : (
                <>
                  {busy ? '正在提交…' : '提交方案，等待审核'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
            <p className="form-foot">提交后等待老师审核，退回后才能修改并重答。</p>
          </form>
        )}
      </div>
    </>
  );
}
