import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Info,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import {
  defaultQuestion,
  questionInputSchema,
  type Question,
  type QuestionInput,
  type Rules,
} from '../../shared/model';
import { api, message } from '../api';
import { useResource } from '../hooks';
import { Alert, ButtonLink, ErrorState, Loading, Pill } from '../components/ui';

export default function Editor() {
  const { id } = useParams(),
    resource = useResource<Question>(id ? `/api/teacher/questions/${id}` : null);
  return id ? (
    resource.loading ? (
      <Loading />
    ) : resource.error ? (
      <ErrorState error={resource.error} retry={resource.reload} />
    ) : (
      resource.data && <EditorForm key={resource.data.id} initial={resource.data} />
    )
  ) : (
    <EditorForm key="new" />
  );
}
function EditorForm({ initial }: { initial?: Question }) {
  const [form, setForm] = useState<QuestionInput>(
    initial || {
      ...defaultQuestion,
      title: '',
      description: '',
      status: 'draft',
      rules: { ...defaultQuestion.rules },
    },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const navigate = useNavigate();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const mode = ((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value;
    const status = mode === 'publish' ? 'published' : initial?.status || 'draft';
    const parsed = questionInputSchema.safeParse({ ...form, status });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join('；'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api(initial ? `/api/teacher/questions/${initial.id}` : '/api/teacher/questions', {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify({ ...parsed.data, ...(initial ? { version: initial.version } : {}) }),
      });
      navigate('/teacher');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function rule(label: string, name: keyof Rules, unit: string, min = 0, max = 1_000_000) {
    return (
      <label className="field">
        {label}
        <span className="input-unit">
          <input
            name={name}
            type="number"
            required
            min={min}
            max={max}
            step="1"
            inputMode="numeric"
            value={Number.isNaN(form.rules[name]) ? '' : form.rules[name]}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                rules: { ...f.rules, [name]: e.target.value === '' ? NaN : Number(e.target.value) },
              }))
            }
          />
          <span>{unit}</span>
        </span>
      </label>
    );
  }
  return (
    <>
      <div className="page-top">
        <div>
          <div className="breadcrumb">
            题目管理
            <ChevronRight size={12} />
            {initial ? '编辑题目' : '新建题目'}
          </div>
          <h1>{initial ? '编辑课堂任务' : '设计一道新任务'}</h1>
          <p>设置任务条件，系统为老师提供核算参考，最终由老师审核。</p>
        </div>
        <ButtonLink to="/teacher" icon={ArrowLeft}>
          返回列表
        </ButtonLink>
      </div>
      <form onSubmit={save}>
        <div className="editor-grid">
          <div className="stack">
            <section className="card">
              <div className="section-heading">
                <h2>
                  <FileText />
                  基本信息
                </h2>
              </div>
              <label className="field">
                题目名称
                <input
                  name="title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  maxLength={60}
                  placeholder="为课堂任务起一个名字"
                />
              </label>
              <label className="field spaced">
                任务情境
                <textarea
                  name="description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  required
                  maxLength={1500}
                  placeholder="描述任务背景与学生需要解决的问题……"
                />
              </label>
            </section>
            <section className="card">
              <div className="section-heading">
                <h2>
                  <SlidersHorizontal />
                  判定条件
                </h2>
                <Pill kind="neutral">红包分配题型</Pill>
              </div>
              <div className="field-grid">
                {rule('总券数', 'totalTickets', '张', 1)}
                {rule('最低中奖率', 'minWinRate', '%', 1, 100)}
                {rule('总预算', 'budget', '元', 0, 1_000_000_000)}
              </div>
              <div className="divider-label">固定奖项 · 超级免单券</div>
              <div className="field-grid">
                {rule('固定张数', 'fixedCount', '张')}
                {rule('每张金额', 'fixedValue', '元')}
              </div>
              <div className="divider-label">学生设计的奖项</div>
              <div className="field-grid">
                {rule('二等奖每张金额', 'secondValue', '元', 1)}
                {rule('三等奖每张金额', 'thirdValue', '元', 1)}
              </div>
              <div className="note">
                <Info size={15} />
                <span>
                  数量和奖金额使用整数。系统检查总券数上限、最低中奖率、预算上限及学生的计算结果。
                </span>
              </div>
            </section>
          </div>
          <aside className="editor-aside">
            <h3>
              <Sparkles size={16} />
              判定方式预览
            </h3>
            <p>这是一道开放方案题。系统依据条件判断，不匹配唯一标准答案。</p>
            <div>
              <Check size={15} />
              方案必须满足全部条件
            </div>
            <div>
              <Check size={15} />
              不要求用完全部预算
            </div>
            <div>
              <Check size={15} />
              设计理由交由老师点评
            </div>
            <p className="spaced">修改参数后，历史提交仍按提交时的规则保存和展示。</p>
            <p>学生填写中奖率时保留至多两位小数。</p>
          </aside>
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="editor-actions">
          <ButtonLink to="/teacher">取消</ButtonLink>
          {!initial && (
            <button className="button" type="submit" name="mode" value="draft" disabled={busy}>
              保存草稿
            </button>
          )}
          <button
            className="button primary"
            type="submit"
            name="mode"
            value={initial ? 'save' : 'publish'}
            disabled={busy}
          >
            {initial ? <Check size={16} /> : <Send size={16} />}
            {busy ? '正在保存…' : initial ? '保存修改' : '发布题目'}
          </button>
        </div>
      </form>
    </>
  );
}
