import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PencilLine, RefreshCw } from 'lucide-react';
import type { PublicSubmission } from '../../shared/model';
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
  Steps,
  dateTime,
} from '../components/ui';
import { draftKey, draftFromSubmission } from './Student';
import { useStudent } from '../student-context';
import ReviewMoment from '../components/ReviewMoment';

export default function Result() {
  const { student } = useStudent();
  const { receipt } = useParams(),
    navigate = useNavigate();
  const resource = useResource<PublicSubmission>(
    `/api/receipts/${encodeURIComponent(receipt || '')}`,
    true,
  );
  const s = resource.data;
  useEffect(() => {
    if (!s || !s.isLatest || s.reviewStatus !== 'pending') return;
    const refresh = () => {
      if (document.visibilityState === 'visible') resource.reload();
    };
    const timer = setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [s?.receipt, s?.reviewStatus, s?.isLatest, resource.reload]);
  function retry() {
    if (!s?.canResubmit) return;
    try {
      sessionStorage.setItem(
        draftKey(s.questionId, student.id, s.receipt),
        JSON.stringify(draftFromSubmission(s)),
      );
    } catch {
      /* Storage is optional. */
    }
    navigate(`/questions/${s.questionId}?retry=${s.receipt}`);
  }
  const pending = s?.reviewStatus === 'pending',
    approved = s?.reviewStatus === 'approved';
  return (
    <>
      <Header />
      <main className="student-main">
        <div className="result-wrap">
          {!s ? (
            resource.loading ? (
              <Loading />
            ) : (
              <ErrorState error={resource.error || '提交记录不存在'} retry={resource.reload} />
            )
          ) : (
            <>
              <Steps result />
              <ReviewMoment key={s.receipt} submission={s} />
              {resource.error && <Alert>暂时无法更新审核状态，请稍后点击“刷新审核状态”。</Alert>}
              {!s.isLatest && <Alert>你已有更新的提交，请查看最新提交的审核状态。</Alert>}
              <section className="card">
                <div className="result-meta">
                  <div>
                    <strong>{s.identity.groupName || '未分组'}</strong>
                    <span className="muted"> / 编号 {s.identity.studentNumber}</span>
                    <p className="tiny">
                      {s.question.title} · 第 {s.question.version} 版
                    </p>
                  </div>
                  <Pill kind={pending ? 'warm' : approved ? 'good' : 'bad'}>
                    {pending ? '待审核' : approved ? '已通过' : '退回重答'}
                  </Pill>
                </div>
                <h3>我的提交内容</h3>
                <div className="detail-prizes spaced">
                  <span>
                    二等奖 <b>{s.answer.secondCount}</b> 张
                  </span>
                  <span>
                    三等奖 <b>{s.answer.thirdCount}</b> 张
                  </span>
                </div>
                <div className="student-answer-values">
                  <div>
                    <small>填写的中奖券数</small>
                    <strong>{s.answer.winningCount}</strong>
                    <span>张</span>
                  </div>
                  <div>
                    <small>填写的中奖率</small>
                    <strong>{s.answer.winningRate}</strong>
                    <span>%</span>
                  </div>
                  <div>
                    <small>填写的总奖金</small>
                    <strong>{s.answer.totalAmount.toLocaleString()}</strong>
                    <span>元</span>
                  </div>
                </div>
                <h3>我的设计理由</h3>
                <p className="reason-block">{s.answer.reason}</p>
                <p className="tiny">提交于 {dateTime(s.createdAt)}</p>
              </section>
              {!pending && (
                <section className="card result-extra">
                  <h3>{approved ? '老师审核意见' : '老师的修改意见'}</h3>
                  <p className="reason-block">{s.feedback || '老师已审核通过本次提交。'}</p>
                  {s.reviewedAt && <p className="tiny">审核于 {dateTime(s.reviewedAt)}</p>}
                </section>
              )}
              {s.isLatest && s.reviewStatus === 'returned' && !s.questionOpen && (
                <Alert>题目目前暂未开放，老师重新开放后才能提交重答。</Alert>
              )}
              <div className="result-actions">
                <ButtonLink to={`/questions/${s.questionId}`} icon={ArrowLeft}>
                  查看题目
                </ButtonLink>
                <Button icon={RefreshCw} onClick={resource.reload} disabled={resource.loading}>
                  {resource.loading ? '正在更新…' : '刷新审核状态'}
                </Button>
                {!s.isLatest ? (
                  <ButtonLink primary to={`/results/${s.latestReceipt}`}>
                    查看最新提交
                  </ButtonLink>
                ) : (
                  s.canResubmit && (
                    <Button primary onClick={retry} icon={PencilLine}>
                      修改后重新提交
                    </Button>
                  )
                )}
              </div>
              <p className="form-foot">请保留本页链接，之后可查看老师的审核状态和意见。</p>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
