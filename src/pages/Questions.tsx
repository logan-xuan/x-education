import { useRef, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Link2,
  LockKeyhole,
  PencilLine,
  Plus,
  Send,
  Unlock,
} from 'lucide-react';
import type { QuestionSummary } from '../../shared/model';
import { api, message } from '../api';
import { useResource } from '../hooks';
import {
  Alert,
  Button,
  ButtonLink,
  Dialog,
  ErrorState,
  Loading,
  Pill,
  dateTime,
} from '../components/ui';

export default function Questions() {
  const resource = useResource<QuestionSummary[]>('/api/teacher/questions');
  const [closing, setClosing] = useState<QuestionSummary | null>(null),
    [sharing, setSharing] = useState<QuestionSummary | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const linkInput = useRef<HTMLInputElement>(null);
  const studentLink = (q: QuestionSummary) => `${window.location.origin}/questions/${q.id}`;
  async function status(q: QuestionSummary) {
    setBusy(true);
    setError('');
    try {
      await api(`/api/teacher/questions/${q.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: q.status === 'published' ? 'closed' : 'published',
          version: q.version,
        }),
      });
      setClosing(null);
      setNotice(
        q.status === 'published'
          ? '本题已结束收集，历史记录和评语已保留。'
          : '题目已开放，学生现在可以提交方案。',
      );
      resource.reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!sharing) return;
    try {
      await navigator.clipboard.writeText(studentLink(sharing));
      setNotice('答题链接已复制，可以分享给学生。');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setNotice('请复制已选中的答题链接。');
    }
  }
  return (
    <>
      <div className="page-top">
        <div>
          <p className="eyebrow quiet">TEACHING WORKSPACE</p>
          <h1>题目管理</h1>
          <p>把一道好题，变成一堂有参与感的课。</p>
        </div>
        <ButtonLink primary to="/teacher/questions/new" icon={Plus}>
          新建题目
        </ButtonLink>
      </div>
      {error && <Alert>{error}</Alert>}
      {notice && !sharing && <Alert success>{notice}</Alert>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : resource.data?.length ? (
        <div className="question-list">
          {resource.data.map((q) => (
            <section className="question-card" key={q.id}>
              <div className="question-card-top">
                <span className="tiny">数学实践 · 第 {q.version} 版</span>
                <Pill kind={q.status === 'published' ? 'good' : 'neutral'}>
                  <span className="status-dot" />
                  {q.status === 'published' ? '收集中' : q.status === 'closed' ? '已关闭' : '草稿'}
                </Pill>
              </div>
              <h2>{q.title}</h2>
              <p className="question-description">{q.description}</p>
              <div className="question-rules">
                <span>
                  总券数 <b>{q.rules.totalTickets.toLocaleString()} 张</b>
                </span>
                <span>
                  中奖率 <b>≥ {q.rules.minWinRate}%</b>
                </span>
                <span>
                  预算 <b>{q.rules.budget.toLocaleString()} 元</b>
                </span>
              </div>
              <div className="question-bottom">
                <div className="tiny">
                  {q.studentCount} 人已提交 · {q.submissionCount} 次作答
                  <p>更新于 {dateTime(q.updatedAt)}</p>
                </div>
                <div className="actions">
                  <ButtonLink
                    className="small"
                    to={`/teacher/questions/${q.id}/edit`}
                    icon={PencilLine}
                  >
                    编辑
                  </ButtonLink>
                  <ButtonLink className="small" to={`/teacher/records?question=${q.id}`}>
                    查看记录
                  </ButtonLink>
                  {q.status !== 'draft' && (
                    <Button
                      className="small"
                      icon={Link2}
                      onClick={() => {
                        setNotice('');
                        setSharing(q);
                      }}
                    >
                      答题链接
                    </Button>
                  )}
                  <Button
                    className="small"
                    disabled={busy}
                    onClick={() => (q.status === 'published' ? setClosing(q) : status(q))}
                    icon={
                      q.status === 'published' ? LockKeyhole : q.status === 'draft' ? Send : Unlock
                    }
                  >
                    {q.status === 'published'
                      ? '关闭提交'
                      : q.status === 'draft'
                        ? '发布题目'
                        : '重新开放'}
                  </Button>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>创建第一道课堂任务</h2>
          <p>发布后即可将答题链接分享给学生。</p>
          <ButtonLink to="/teacher/questions/new" primary icon={Plus}>
            新建题目
          </ButtonLink>
        </div>
      )}
      {closing && (
        <Dialog
          title="结束本题的答案收集？"
          onClose={() => {
            if (!busy) setClosing(null);
          }}
        >
          <p className="dialog-description">
            关闭后，学生仍可阅读题目，无法提交新答案。已有记录和老师评语都会保留，之后可以重新开放。
          </p>
          {error && <Alert>{error}</Alert>}
          <div className="dialog-actions">
            <Button disabled={busy} onClick={() => setClosing(null)}>
              取消
            </Button>
            <Button primary disabled={busy} icon={LockKeyhole} onClick={() => status(closing)}>
              {busy ? '正在关闭…' : '确认关闭'}
            </Button>
          </div>
        </Dialog>
      )}
      {sharing && (
        <Dialog title="分享学生答题链接" onClose={() => setSharing(null)}>
          <p className="dialog-description">学生打开链接后，填写组名和编号即可答题。</p>
          <label className="field spaced">
            学生答题链接
            <input
              ref={linkInput}
              readOnly
              value={studentLink(sharing)}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          {notice && <Alert success>{notice}</Alert>}
          <div className="dialog-actions">
            <ButtonLink
              target="_blank"
              rel="noopener noreferrer"
              to={`/questions/${sharing.id}`}
              icon={ExternalLink}
            >
              预览学生页
            </ButtonLink>
            <Button primary icon={Copy} onClick={copy}>
              复制链接
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
