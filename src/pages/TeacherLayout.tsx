import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ChartNoAxesCombined,
  KeyRound,
  LogOut,
  NotebookPen,
  RefreshCw,
  Sprout,
} from 'lucide-react';
import { ApiError, closeTeacherSession, message, openTeacherSession } from '../api';
import { Alert, Button, Footer, Header, Loading } from '../components/ui';

export default function TeacherLayout() {
  const [state, setState] = useState<'loading' | 'ready' | 'denied'>('loading'),
    [error, setError] = useState(''),
    [verificationFailed, setVerificationFailed] = useState(false);
  const attempt = useRef(0);
  const verify = useCallback(() => {
    const current = ++attempt.current;
    setState('loading');
    setError('');
    setVerificationFailed(false);
    openTeacherSession()
      .then(() => {
        if (attempt.current === current) setState('ready');
      })
      .catch((e) => {
        if (attempt.current === current) {
          setState('denied');
          setError(message(e));
          setVerificationFailed(!(e instanceof ApiError) || e.status !== 401);
        }
      });
  }, []);
  useEffect(() => {
    verify();
    const linkOpened = () => {
      if (new URLSearchParams(window.location.hash.slice(1)).has('key')) verify();
    };
    const expired = () => {
      attempt.current++;
      setState('denied');
      setVerificationFailed(false);
      setError('管理访问已过期，请重新打开老师专属链接。');
    };
    window.addEventListener('teacher-session-expired', expired);
    window.addEventListener('hashchange', linkOpened);
    return () => {
      attempt.current++;
      window.removeEventListener('teacher-session-expired', expired);
      window.removeEventListener('hashchange', linkOpened);
    };
  }, [verify]);
  async function exit() {
    try {
      await closeTeacherSession();
      attempt.current++;
      setState('denied');
      setVerificationFailed(false);
      setError('已退出管理空间。需要继续管理时，请重新打开老师专属链接。');
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <Header teacher />
      {state === 'loading' ? (
        <main className="student-main">
          <Loading label="正在验证老师管理链接…" />
        </main>
      ) : state === 'denied' ? (
        <main className="access-page">
          <div className="access-icon">
            <KeyRound size={28} />
          </div>
          <h1>{verificationFailed ? '暂时无法验证管理链接' : '请使用老师专属链接进入'}</h1>
          <p>
            此页面仅供老师管理课堂任务。
            <br />
            {verificationFailed
              ? '请重新验证；也可以刷新页面或重新打开完整老师链接。'
              : '请打开含固定管理密码的完整老师链接，验证成功后可直接刷新访问。'}
          </p>
          {error && <Alert>{error}</Alert>}
          <Button primary icon={RefreshCw} onClick={verify}>
            重新验证
          </Button>
        </main>
      ) : (
        <div className="teacher-shell">
          <aside className="sidebar">
            <div className="sidebar-label">教学工作台</div>
            <NavLink
              to="/teacher"
              end
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <NotebookPen size={18} />
              题目管理
            </NavLink>
            <NavLink
              to="/teacher/records"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <ChartNoAxesCombined size={18} />
              提交记录
            </NavLink>
            <div className="sidebar-bottom">
              <Sprout size={19} />
              <p>
                每一次尝试
                <br />
                都值得被看见。
              </p>
              <Button icon={LogOut} className="ghost" onClick={exit}>
                退出管理
              </Button>
            </div>
          </aside>
          <main className="teacher-main">
            {error && <Alert>{error}</Alert>}
            <Outlet />
          </main>
        </div>
      )}
      <Footer />
    </>
  );
}
