import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleCheck,
  LoaderCircle,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Grading, ReviewStatus } from '../../shared/model';

export function Button({
  children,
  primary,
  icon: Icon,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; icon?: LucideIcon }) {
  return (
    <button type="button" {...props} className={`button ${primary ? 'primary' : ''} ${className}`}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
export function ButtonLink({
  children,
  primary,
  icon: Icon,
  className = '',
  ...props
}: LinkProps & { primary?: boolean; icon?: LucideIcon }) {
  return (
    <Link {...props} className={`button ${primary ? 'primary' : ''} ${className}`}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </Link>
  );
}
export function Brand({ teacher = false }: { teacher?: boolean }) {
  return (
    <Link to={teacher ? '/teacher' : '/'} className="brand" aria-label="知课首页">
      <span className="brand-mark">
        <BookOpen size={21} />
      </span>
      <span>
        <strong>知课</strong>
        <small>CLASSROOM LAB</small>
      </span>
    </Link>
  );
}
export function Header({ teacher = false }: { teacher?: boolean }) {
  return (
    <header className="app-header">
      <Brand teacher={teacher} />
      <div className="header-right">
        <span className="header-motto">
          {teacher ? '课堂管理空间' : '让每一个好想法，都被看见。'}
        </span>
        <span className="class-chip">
          {teacher ? (
            <>
              <SlidersHorizontal size={14} /> 老师后台
            </>
          ) : (
            '数学 · 实践探究'
          )}
        </span>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="app-footer">
      <span>知课 / 让思考被看见</span>
      <span>生活中的数学 · 课堂实践</span>
    </footer>
  );
}
export function Pill({
  children,
  kind = 'good',
}: {
  children: ReactNode;
  kind?: 'good' | 'bad' | 'neutral' | 'warm';
}) {
  return <span className={`pill ${kind}`}>{children}</span>;
}
export function Alert({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return (
    <div role={success ? 'status' : 'alert'} className={`alert ${success ? 'success-alert' : ''}`}>
      {success ? <CircleCheck size={17} /> : <AlertCircle size={17} />}
      <span>{children}</span>
    </div>
  );
}
export function Loading({ label = '正在加载…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="empty-state">
      <AlertCircle size={32} />
      <h2>暂时无法显示</h2>
      <p>{error}</p>
      {retry && <Button onClick={retry}>重新加载</Button>}
    </div>
  );
}
export function Steps({ result = false }: { result?: boolean }) {
  return (
    <div className="stepper" aria-label="答题进度">
      <span>
        <b>{result ? <Check size={11} /> : '01'}</b>阅读任务
      </span>
      <i />
      <span className={!result ? 'active' : ''}>
        <b>{result ? <Check size={11} /> : '02'}</b>设计方案
      </span>
      <i />
      <span className={result ? 'active' : ''}>
        <b>03</b>老师审核
      </span>
    </div>
  );
}
export function ReviewBadge({ status }: { status: ReviewStatus }) {
  return <Pill kind={status === 'approved' ? 'good' : status === 'returned' ? 'bad' : 'warm'}>{status === 'approved' ? '已通过' : status === 'returned' ? '退回重答' : '待审核'}</Pill>;
}
export function Checks({ grading }: { grading: Grading }) {
  return (
    <div className="checks">
      {grading.checks.map((c) => (
        <div className="check-row" key={c.code}>
          <div className={`check-text ${c.passed ? '' : 'failed'}`}>
            {c.passed ? <CircleCheck size={18} /> : <AlertCircle size={18} />}
            <div>
              <h3>{c.label}</h3>
              <p>{c.detail}</p>
            </div>
          </div>
          <Pill kind={c.passed ? 'good' : 'bad'}>{c.passed ? '通过' : '需修改'}</Pill>
        </div>
      ))}
    </div>
  );
}
export function Metrics({
  grading,
  rules,
}: {
  grading: Grading;
  rules?: { totalTickets: number; minWinRate: number; budget: number };
}) {
  const c = grading.computed;
  return (
    <div className="result-metrics">
      <div>
        <small>总中奖券数</small>
        <strong>{c.winningCount.toLocaleString()}</strong>
        <span>张</span>
        {rules && <p>总券数 {rules.totalTickets.toLocaleString()} 张</p>}
      </div>
      <div>
        <small>实际中奖率</small>
        <strong>{c.winningRate}</strong>
        <span>%</span>
        {rules && <p>最低要求 {rules.minWinRate}%</p>}
      </div>
      <div>
        <small>实际总奖金</small>
        <strong>{c.totalAmount.toLocaleString()}</strong>
        <span>元</span>
        {rules && <p>总预算 {rules.budget.toLocaleString()} 元</p>}
      </div>
    </div>
  );
}
export function Dialog({
  children,
  title,
  onClose,
  drawer = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const previous = useRef<Element | null>(null);
  useEffect(() => {
    previous.current = document.activeElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      if (previous.current instanceof HTMLElement && previous.current.isConnected)
        previous.current.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? 'drawer-dialog' : 'modal-dialog'}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <Button className="ghost icon-button" aria-label="关闭弹窗" onClick={onClose} icon={X} />
      </div>
      {children}
    </dialog>
  );
}
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
export const icons = { ArrowLeft, ArrowRight };
