import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BookOpen, Lightbulb, PencilLine, Sparkles } from 'lucide-react';
import { identitySchema } from '../../shared/model';
import { api, message } from '../api';
import { Alert, Footer, Header, Loading } from '../components/ui';
import CatBuddy from '../components/CatBuddy';

function returnPath(raw: string | null) {
  if (!raw) return '/';
  try {
    const url = new URL(raw, window.location.origin);
    if (
      url.origin !== window.location.origin ||
      !(
        url.pathname === '/' ||
        url.pathname === '/my-submissions' ||
        /^\/(questions|results)\/[^/]+$/.test(url.pathname)
      )
    )
      return '/';
    return url.pathname + url.search;
  } catch {
    return '/';
  }
}
export default function StudentLogin() {
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const next = returnPath(params.get('next'));
  const [groupName, setGroupName] = useState(''),
    [studentNumber, setStudentNumber] = useState('');
  const [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api('/api/student/session', { signal: controller.signal })
      .then(() => {
        if (!controller.signal.aborted) navigate(next, { replace: true });
      })
      .catch(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [navigate, next]);
  async function enter(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = identitySchema.safeParse({ groupName, studentNumber });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/student/session', { method: 'POST', body: JSON.stringify(parsed.data) });
      navigate(next, { replace: true });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="student-world">
      <Header />
      <main className="student-login-main">
        {checking ? (
          <Loading label="正在检查学生身份…" />
        ) : (
          <div className="login-adventure">
            <section className="login-welcome" aria-label="欢迎来到数学课堂">
              <span className="adventure-tag">
                <Sparkles size={16} />
                今天，也要闪闪发光
              </span>
              <h2>
                和小橘一起，
                <br />
                发现数学的乐趣。
              </h2>
              <p>带上好奇心，开启今天的小小探险！</p>
              <div className="login-cat-scene">
                <span className="cat-welcome-bubble">每个好想法，都值得被看见！</span>
                <CatBuddy decorative />
                <span className="scene-doodle doodle-one" aria-hidden="true">
                  ✧
                </span>
                <span className="scene-doodle doodle-two" aria-hidden="true">
                  ＋
                </span>
              </div>
              <div className="adventure-steps">
                <span>
                  <BookOpen size={17} />
                  读一读
                </span>
                <span>
                  <Lightbulb size={17} />
                  想一想
                </span>
                <span>
                  <PencilLine size={17} />
                  试一试
                </span>
              </div>
            </section>
            <section className="student-login-card">
              <p className="eyebrow">
                <span aria-hidden="true">✦</span> 准备好了吗？一起出发
              </p>
              <h1>学生登录</h1>
              <p className="login-intro">填好你的课堂身份，小橘就能记住你啦。</p>
              <form onSubmit={enter}>
                <label className="field">
                  小组名 <span className="tiny">选填</span>
                  <input
                    aria-label="小组名"
                    name="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="例如：灵感组"
                    maxLength={30}
                    autoComplete="off"
                  />
                </label>
                <label className="field spaced">
                  编号 <span className="required-mark">必填</span>
                  <input
                    aria-label="编号"
                    name="studentNumber"
                    value={studentNumber}
                    onChange={(e) => {
                      e.target.setCustomValidity('');
                      setStudentNumber(e.target.value);
                    }}
                    onInvalid={(e) => e.currentTarget.setCustomValidity('请填写编号')}
                    placeholder="请输入你的编号，例如 03"
                    maxLength={30}
                    autoComplete="username"
                    required
                  />
                </label>
                {error && <Alert>{error}</Alert>}
                <button type="submit" className="button primary full" disabled={busy}>
                  {busy ? '正在进入…' : '进入课堂'}
                  <ArrowRight size={16} />
                </button>
              </form>
              <p className="login-hint">
                无需密码。请使用相同的小组名和编号登录，找回自己的提交和审核状态。
              </p>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
