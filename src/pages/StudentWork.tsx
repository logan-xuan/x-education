import { RefreshCw } from 'lucide-react';
import type { PublicSubmission } from '../../shared/model';
import { useResource } from '../hooks';
import {
  Button,
  ButtonLink,
  ErrorState,
  Footer,
  Header,
  Loading,
  ReviewBadge,
  dateTime,
} from '../components/ui';

export default function StudentWork() {
  const resource = useResource<PublicSubmission[]>('/api/student/submissions');
  return (
    <>
      <Header />
      <main className="student-main">
        <div className="page-top">
          <div>
            <h1>我的提交</h1>
            <p>查看自己的课堂任务和老师审核状态。</p>
          </div>
          <Button icon={RefreshCw} disabled={resource.loading} onClick={resource.reload}>
            刷新
          </Button>
        </div>
        {resource.loading ? (
          <Loading />
        ) : resource.error ? (
          <ErrorState error={resource.error} retry={resource.reload} />
        ) : resource.data?.length ? (
          <div className="question-list">
            {resource.data.map((s) => (
              <section className="question-card" key={s.questionId}>
                <div className="question-card-top">
                  <span className="tiny">提交于 {dateTime(s.createdAt)}</span>
                  <ReviewBadge status={s.reviewStatus} />
                </div>
                <h2>{s.question.title}</h2>
                <p className="question-description">
                  {s.reviewStatus === 'pending'
                    ? '答案已保存，正在等待老师审核。'
                    : s.feedback || '老师已审核通过。'}
                </p>
                <div className="actions spaced">
                  <ButtonLink to={`/results/${s.receipt}`}>查看审核状态</ButtonLink>
                  {s.canResubmit && (
                    <ButtonLink primary to={`/questions/${s.questionId}?retry=${s.receipt}`}>
                      修改后重答
                    </ButtonLink>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>还没有提交记录</h2>
            <p>完成课堂任务后，你可以在这里查看审核进度。</p>
            <ButtonLink primary to="/">
              去答题
            </ButtonLink>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
