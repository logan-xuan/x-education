import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { StudentProfile } from '../../shared/model';
import { ApiError, api, message } from '../api';
import { StudentContext } from '../student-context';
import { ErrorState, Footer, Header, Loading } from '../components/ui';

export default function StudentLayout() {
  const location = useLocation(),
    navigate = useNavigate();
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'expired' | 'error'>('loading');
  const [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<{ student: StudentProfile }>('/api/student/session', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setStudent(data.student);
          setState('ready');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(message(e));
          setState(e instanceof ApiError && e.status === 401 ? 'expired' : 'error');
        }
      });
    const expired = () => {
      setStudent(null);
      setState('expired');
    };
    window.addEventListener('student-session-expired', expired);
    return () => {
      controller.abort();
      window.removeEventListener('student-session-expired', expired);
    };
  }, [version]);
  async function logout() {
    await api('/api/student/session', { method: 'DELETE' });
    navigate('/login', { replace: true });
  }
  if (state === 'expired')
    return (
      <Navigate
        replace
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
      />
    );
  if (state !== 'ready' || !student)
    return (
      <div className="student-world">
        <Header />
        <main className="student-main">
          {state === 'error' ? (
            <ErrorState
              error={error}
              retry={() => {
                setState('loading');
                setVersion((v) => v + 1);
              }}
            />
          ) : (
            <Loading label="正在恢复学生身份…" />
          )}
        </main>
        <Footer />
      </div>
    );
  return (
    <StudentContext.Provider value={{ student, logout }}>
      <div className="student-world">
        <Outlet />
      </div>
    </StudentContext.Provider>
  );
}
