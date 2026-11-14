import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Undo2,
  Inbox,
  RefreshCw,
  Search,
  SearchX,
  Send,
  Users,
} from 'lucide-react';
import {
  reviewInputSchema,
  type QuestionSummary,
  type RecordsResponse,
  type Submission,
} from '../../shared/model';
import { api, message } from '../api';
import { useDebounce, useResource } from '../hooks';
import {
  Alert,
  Button,
  Checks,
  Dialog,
  ErrorState,
  Loading,
  Metrics,
  Pill,
  ReviewBadge,
  dateTime,
} from '../components/ui';

export default function Records() {
  const questions = useResource<QuestionSummary[]>('/api/teacher/questions');
  const [params, setParams] = useSearchParams();
  const questionId = params.get('question') || questions.data?.[0]?.id || '';
  const question = questions.data?.find((q) => q.id === questionId);
  const [search, setSearch] = useState(''),
    [result, setResult] = useState('all'),
    [reviewStatus, setReviewStatus] = useState('all'),
    [latest, setLatest] = useState(true),
    [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const debounced = useDebounce(search);
  const query = new URLSearchParams({
    questionId,
    search: debounced,
    result,
    reviewStatus,
    latest: String(latest),
    page: String(page),
  });
  const records = useResource<RecordsResponse>(
      questionId ? `/api/teacher/submissions?${query}` : null,
    ),
    data = records.data;
  useEffect(() => setPage(1), [questionId, debounced, result, reviewStatus, latest]);
  function clear() {
    setSearch('');
    setResult('all');
    setReviewStatus('all');
    setLatest(true);
    setPage(1);
  }
  return (
    <>
      <div className="page-top">
        <div>
          <h1>提交记录</h1>
          <p>看见每一份方案，跟进每一次尝试。</p>
        </div>
        <Button icon={RefreshCw} onClick={records.reload} disabled={records.loading || !questionId}>
          刷新
        </Button>
      </div>
      {questions.loading ? (
        <Loading />
      ) : questions.error ? (
        <ErrorState error={questions.error} retry={questions.reload} />
      ) : !questions.data?.length ? (
        <div className="empty-state">
          <Inbox size={32} />
          <h2>还没有课堂任务</h2>
          <p>创建并发布题目后，就可以在这里查看答案。</p>
        </div>
      ) : (
        <>
          <label className="field question-selector">
            查看题目
            <select
              value={questionId}
              onChange={(e) => {
                setParams({ question: e.target.value });
                setPage(1);
              }}
            >
              {questions.data.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                  {q.status === 'draft' ? '（草稿）' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="summary-grid">
            <div className="summary-card">
              <div>
                <small>已提交学生</small>
                <Users size={17} />
              </div>
              <strong>
                {data ? data.stats.studentCount : '—'}
                <span>人</span>
              </strong>
              <p>{data ? `累计 ${data.stats.submissionCount} 次提交` : '按组名与编号去重'}</p>
            </div>
            <div className="summary-card">
              <div>
                <small>待审核</small>
                <Clock3 size={17} />
              </div>
              <strong>
                {data ? data.stats.pendingCount : '—'}
                <span>人</span>
              </strong>
              <p>按每人最新一次提交统计</p>
            </div>
            <div className="summary-card accent">
              <div>
                <small>已通过</small>
                <CircleCheck size={17} />
              </div>
              <strong>
                {data ? data.stats.approvedCount : '—'}
                <span>人</span>
              </strong>
              <p>{data ? `另有 ${data.stats.returnedCount} 人退回重答` : '由老师审核决定'}</p>
            </div>
          </div>
          <section className="table-box">
            <div className="table-heading">
              <h2>{question?.title || '答题记录'}</h2>
              {question && (
                <Pill kind={question.status === 'published' ? 'good' : 'neutral'}>
                  {question.status === 'published'
                    ? '收集中'
                    : question.status === 'closed'
                      ? '已关闭'
                      : '草稿'}
                </Pill>
              )}
            </div>
            <div className="table-toolbar">
              <label className="search-field">
                <Search size={16} />
                <input
                  aria-label="搜索组名或编号"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索组名 / 编号"
                  maxLength={60}
                />
              </label>
              <select
                aria-label="筛选自动核算参考"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              >
                <option value="all">全部核算参考</option>
                <option value="correct">参考达标</option>
                <option value="incorrect">参考未达标</option>
              </select>
              <select
                aria-label="筛选审核状态"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
              >
                <option value="all">全部审核状态</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="returned">退回重答</option>
              </select>
              <select
                aria-label="筛选提交范围"
                value={String(latest)}
                onChange={(e) => setLatest(e.target.value === 'true')}
              >
                <option value="true">每人最新一次</option>
                <option value="false">全部提交</option>
              </select>
            </div>
            {records.loading ? (
              <Loading />
            ) : records.error ? (
              <ErrorState error={records.error} retry={records.reload} />
            ) : data?.items.length ? (
              <>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>组名 / 编号</th>
                        <th>分配方案</th>
                        <th>中奖率</th>
                        <th>总奖金</th>
                        <th>自动核算参考</th>
                        <th>审核状态</th>
                        <th>提交时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <strong>{s.identity.groupName || '未分组'}</strong>
                            <small>编号 {s.identity.studentNumber}</small>
                          </td>
                          <td className="number">
                            二 {s.answer.secondCount} / 三 {s.answer.thirdCount}
                          </td>
                          <td className="number">{s.grading.computed.winningRate}%</td>
                          <td className="number">
                            ¥{s.grading.computed.totalAmount.toLocaleString()}
                          </td>
                          <td>
                            <Pill kind={s.grading.isCorrect ? 'good' : 'bad'}>
                              {s.grading.isCorrect ? '参考达标' : '参考未达标'}
                            </Pill>
                          </td>
                          <td>
                            <ReviewBadge status={s.reviewStatus} />
                          </td>
                          <td className="record-date">{dateTime(s.createdAt)}</td>
                          <td>
                            <button className="text-button" onClick={() => setSelected(s.id)}>
                              查看详情
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  <span>共 {data.total} 条 · 中奖率及奖金为系统核算值</span>
                  <div className="pagination">
                    <Button
                      className="small icon-button"
                      icon={ChevronLeft}
                      aria-label="上一页"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                    />
                    <span>
                      {page} / {Math.max(1, Math.ceil(data.total / data.pageSize))}
                    </span>
                    <Button
                      className="small icon-button"
                      icon={ChevronRight}
                      aria-label="下一页"
                      disabled={page * data.pageSize >= data.total}
                      onClick={() => setPage((p) => p + 1)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                {debounced || result !== 'all' || reviewStatus !== 'all' ? (
                  <SearchX size={32} />
                ) : (
                  <Inbox size={32} />
                )}
                <h2>
                  {debounced || result !== 'all' || reviewStatus !== 'all'
                    ? '没有符合条件的记录'
                    : '还没有学生提交答案'}
                </h2>
                <p>
                  {debounced || result !== 'all' || reviewStatus !== 'all'
                    ? '换个关键词，或调整筛选条件再试试。'
                    : '学生提交方案后，答题情况会展示在这里。'}
                </p>
                {(debounced || result !== 'all' || reviewStatus !== 'all') && (
                  <Button onClick={clear}>清除筛选</Button>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {selected !== null && (
        <SubmissionDetail
          id={selected}
          onClose={() => setSelected(null)}
          onSelect={setSelected}
          onReviewed={records.reload}
        />
      )}
    </>
  );
}

function SubmissionDetail({
  id,
  onClose,
  onSelect,
  onReviewed,
}: {
  id: number;
  onClose: () => void;
  onSelect: (id: number) => void;
  onReviewed: () => void;
}) {
  const resource = useResource<{
    submission: Submission;
    history: Submission[];
    canReview: boolean;
  }>(`/api/teacher/submissions/${id}`);
  const [tab, setTab] = useState('answer'),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const s = resource.data?.submission;
  useEffect(() => {
    setTab('answer');
    setNotice('');
    setError('');
  }, [id]);
  useEffect(() => {
    setFeedback(s?.feedback || '');
  }, [s?.id, s?.feedback]);
  async function review(status: 'approved' | 'returned') {
    if (!s || busy) return;
    const parsed = reviewInputSchema.safeParse({
      status,
      feedback,
      reviewVersion: s.reviewVersion,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api(`/api/teacher/submissions/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify(parsed.data),
      });
      setNotice(
        status === 'approved'
          ? '已审核通过，学生可以查看审核状态。'
          : '已退回重答，学生可根据修改意见重新提交。',
      );
      resource.reload();
      onReviewed();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog drawer title="答案详情" onClose={onClose}>
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : (
        s && (
          <>
            <p className="tiny detail-timestamp">
              提交 #{s.id} · {dateTime(s.createdAt)} · 题目第 {s.question.version} 版
            </p>
            <div className="detail-identity">
              <div className="person">
                <span className="avatar">{(s.identity.groupName || '未').slice(0, 1)}</span>
                <div>
                  <h3>{s.identity.groupName || '未分组'}</h3>
                  <p>
                    编号 {s.identity.studentNumber} · 共提交 {resource.data!.history.length} 次
                  </p>
                </div>
              </div>
              <ReviewBadge status={s.reviewStatus} />
            </div>
            <div className="detail-tabs" role="group" aria-label="答案内容">
              <button onClick={() => setTab('answer')} aria-pressed={tab === 'answer'}>
                本次答案
              </button>
              <button onClick={() => setTab('history')} aria-pressed={tab === 'history'}>
                提交历史（{resource.data!.history.length}）
              </button>
            </div>
            {tab === 'answer' ? (
              <>
                <div className="detail-prizes">
                  <span>
                    二等奖 <b>{s.answer.secondCount}</b> 张
                  </span>
                  <span>
                    三等奖 <b>{s.answer.thirdCount}</b> 张
                  </span>
                </div>
                <Metrics grading={s.grading} rules={s.question.rules} />
                <h3>自动核算参考（仅老师可见）</h3>
                <p className="tiny">以下内容仅供审核参考，最终结论由老师选择通过或退回。</p>
                <Checks grading={s.grading} />
                {!s.grading.calculationCorrect && (
                  <div className="submitted-calculation">
                    学生填写：中奖券 {s.answer.winningCount} 张 / 中奖率 {s.answer.winningRate}% /
                    总奖金 {s.answer.totalAmount} 元
                  </div>
                )}
                <h3 className="spaced">学生的设计理由</h3>
                <p className="reason-block">{s.answer.reason}</p>
                <div className="feedback-section">
                  {resource.data!.canReview ? (
                    <>
                      <label className="field">
                        审核意见
                        <textarea
                          value={feedback}
                          onChange={(e) => {
                            setFeedback(e.target.value);
                            setNotice('');
                          }}
                          maxLength={500}
                          placeholder="填写鼓励或修改建议；退回重答时必须说明原因。"
                        />
                      </label>
                      <div className="field-help">
                        <span>审核后向学生展示，不会展示自动核算结果。</span>
                        <span>{feedback.length} / 500</span>
                      </div>
                      {error && <Alert>{error}</Alert>}
                      <div className="dialog-actions">
                        <Button icon={Undo2} disabled={busy} onClick={() => review('returned')}>
                          退回重答
                        </Button>
                        <Button
                          primary
                          icon={CircleCheck}
                          disabled={busy}
                          onClick={() => review('approved')}
                        >
                          {busy ? '正在提交…' : '审核通过'}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3>老师审核意见</h3>
                      <p className="reason-block">
                        {s.feedback ||
                          (s.reviewStatus === 'pending'
                            ? '这是历史提交，请审核最新一次答案。'
                            : '本次审核已完成。')}
                      </p>
                      {s.reviewedAt && <p className="tiny">审核于 {dateTime(s.reviewedAt)}</p>}
                      {s.reviewStatus === 'pending' && (
                        <Button onClick={() => onSelect(resource.data!.history[0].id)}>
                          查看最新答案
                        </Button>
                      )}
                    </>
                  )}
                  {notice && <Alert success>{notice}</Alert>}
                </div>
              </>
            ) : (
              <div className="history-list">
                {resource.data!.history.map((h, index, all) => (
                  <div className="history-item" key={h.id}>
                    <div>
                      <h3>
                        第 {all.length - index} 次提交{' '}
                        {index === 0 && <Pill kind="neutral">最新</Pill>}
                      </h3>
                      <p>
                        {dateTime(h.createdAt)} · 二等奖 {h.answer.secondCount} 张 / 三等奖{' '}
                        {h.answer.thirdCount} 张
                      </p>
                      <span className="tiny">题目第 {h.question.version} 版</span>
                    </div>
                    <div>
                      <ReviewBadge status={h.reviewStatus} />
                      <button
                        className="text-button"
                        onClick={() => {
                          onSelect(h.id);
                          setTab('answer');
                        }}
                      >
                        查看本次
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      )}
    </Dialog>
  );
}
