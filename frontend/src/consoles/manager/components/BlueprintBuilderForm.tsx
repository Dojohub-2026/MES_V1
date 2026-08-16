import { useEffect, useState } from 'react';
import {
  X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Plus, Trash2,
  FileText, CheckSquare, BarChart3, ClipboardCheck, AlertTriangle, Save, Loader2,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';

interface ChecklistItemForm { itemText: string; isRequired: boolean; }
interface QuantityMetricForm { metricName: string; unitLabel: string; minValue: number | null; maxValue: number | null; inputFrequency: 'ONCE' | 'PER_BATCH' | 'HOURLY'; }
interface QcQuestionForm { questionText: string; responseType: 'pass_fail' | 'numeric' | 'free_text'; numericMinValue: number | null; numericMaxValue: number | null; isRequired: boolean; }
interface FaultCategoryForm { faultName: string; }

interface FormState {
  name: string;
  description: string;
  category: string;
  stationTag: string;
  estimatedDurationMinutes: number;
  guidelinesEnabled: boolean;
  guidelinesContent: string;
  checklistEnabled: boolean;
  checklistValidationTiming: string;
  checklistItems: ChecklistItemForm[];
  quantityLoggingEnabled: boolean;
  quantityMetrics: QuantityMetricForm[];
  qcFormEnabled: boolean;
  qcQuestions: QcQuestionForm[];
  faultCategoriesEnabled: boolean;
  faultCategories: FaultCategoryForm[];
}

const emptyForm: FormState = {
  name: '', description: '', category: 'preparation', stationTag: '', estimatedDurationMinutes: 15,
  guidelinesEnabled: false, guidelinesContent: '',
  checklistEnabled: false, checklistValidationTiming: 'before_start', checklistItems: [],
  quantityLoggingEnabled: false, quantityMetrics: [],
  qcFormEnabled: false, qcQuestions: [],
  faultCategoriesEnabled: false, faultCategories: [],
};

function TogglePanel({ title, description, icon, enabled, onToggle, children }: {
  title: string; description: string; icon: React.ReactNode; enabled: boolean;
  onToggle: (v: boolean) => void; children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(enabled);
  useEffect(() => { setExpanded(enabled); }, [enabled]);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/50 overflow-hidden ${enabled ? 'ring-2 ring-navy-500/20' : ''}`}>
      <div className="flex items-center gap-3 p-4 bg-slate-50/50">
        <button type="button" onClick={() => onToggle(!enabled)} className="flex-shrink-0">
          {enabled ? <ToggleRight size={22} className="text-navy-600" /> : <ToggleLeft size={22} className="text-slate-300" />}
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${enabled ? 'bg-navy-100 text-navy-700' : 'bg-slate-100 text-slate-400'}`}>
            {icon}
          </div>
          <div>
            <h3 className={`font-semibold ${enabled ? 'text-slate-900' : 'text-slate-500'}`}>{title}</h3>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>
        {enabled && (
          <button type="button" onClick={() => setExpanded(!expanded)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>
      {enabled && expanded && <div className="p-4 border-t border-slate-200">{children}</div>}
    </div>
  );
}

export function BlueprintBuilderForm({ blueprintId, onCancel, onSaved }: {
  blueprintId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(!!blueprintId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!blueprintId) return;
    api.get(`/blueprints/${blueprintId}`)
      .then((res) => {
        const bp = res.data.blueprint;
        setForm({
          name: bp.name, description: bp.description || '', category: bp.category,
          stationTag: bp.stationTag || '', estimatedDurationMinutes: bp.estimatedDurationMinutes,
          guidelinesEnabled: bp.guidelinesEnabled, guidelinesContent: bp.guidelinesContent || '',
          checklistEnabled: bp.checklistEnabled, checklistValidationTiming: bp.checklistValidationTiming || 'before_start',
          checklistItems: bp.checklistItems.map((c: any) => ({ itemText: c.itemText, isRequired: c.isRequired })),
          quantityLoggingEnabled: bp.quantityLoggingEnabled,
          quantityMetrics: bp.quantities.map((q: any) => ({ metricName: q.metricName, unitLabel: q.unitLabel, minValue: q.minValue, maxValue: q.maxValue, inputFrequency: q.inputFrequency })),
          qcFormEnabled: bp.qcFormEnabled,
          qcQuestions: bp.qcQuestions.map((q: any) => ({ questionText: q.questionText, responseType: q.responseType, numericMinValue: q.numericMinValue, numericMaxValue: q.numericMaxValue, isRequired: q.isRequired })),
          faultCategoriesEnabled: bp.faultCategoriesEnabled,
          faultCategories: bp.faultCategories.map((f: any) => ({ faultName: f.faultName})),
        });
      })
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load blueprint.'))
      .finally(() => setLoading(false));
  }, [blueprintId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (blueprintId) {
        await api.put(`/blueprints/${blueprintId}`, form);
      } else {
        await api.post('/blueprints', form);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save blueprint.');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-slate-400"><Loader2 size={28} className="animate-spin" /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{blueprintId ? 'Edit Blueprint' : 'Create Blueprint'}</h1>
        <button type="button" onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700">
          <AlertTriangle size={18} />{error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/50 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full h-20 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            >
              <option value="preparation">Preparation</option>
              <option value="processing">Processing</option>
              <option value="packaging">Packaging</option>
              <option value="quality_control">Quality Control</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Station Tag</label>
            <input
              value={form.stationTag}
              onChange={(e) => setForm({ ...form, stationTag: e.target.value })}
              placeholder="e.g. Station 3"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Est. Duration (min)</label>
            <input
              type="number"
              min={0}
              value={form.estimatedDurationMinutes}
              onChange={(e) => setForm({ ...form, estimatedDurationMinutes: Number(e.target.value) })}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <TogglePanel
        title="Guidelines" description="Written instructions shown to operators"
        icon={<FileText size={18} />} enabled={form.guidelinesEnabled}
        onToggle={(v) => setForm({ ...form, guidelinesEnabled: v })}
      >
        <textarea
          value={form.guidelinesContent}
          onChange={(e) => setForm({ ...form, guidelinesContent: e.target.value })}
          placeholder="Enter detailed guidelines for operators..."
          className="w-full h-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"
        />
      </TogglePanel>

      <TogglePanel
        title="Checklist" description="Required steps operators must confirm"
        icon={<CheckSquare size={18} />} enabled={form.checklistEnabled}
        onToggle={(v) => setForm({ ...form, checklistEnabled: v })}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Validation Timing</label>
            <select
              value={form.checklistValidationTiming}
              onChange={(e) => setForm({ ...form, checklistValidationTiming: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
            >
              <option value="before_start">Before Start</option>
              <option value="before_completion">Before Completion</option>
              <option value="both">Both</option>
            </select>
          </div>
          {form.checklistItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={item.itemText}
                onChange={(e) => {
                  const items = [...form.checklistItems];
                  items[i] = { ...items[i], itemText: e.target.value };
                  setForm({ ...form, checklistItems: items });
                }}
                placeholder="Checklist item"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={item.isRequired}
                  onChange={(e) => {
                    const items = [...form.checklistItems];
                    items[i] = { ...items[i], isRequired: e.target.checked };
                    setForm({ ...form, checklistItems: items });
                  }}
                /> Required
              </label>
              <button type="button" onClick={() => setForm({ ...form, checklistItems: form.checklistItems.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-danger-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, checklistItems: [...form.checklistItems, { itemText: '', isRequired: true }] })}
            className="flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-700"
          >
            <Plus size={16} /> Add Item
          </button>
        </div>
      </TogglePanel>

      <TogglePanel
        title="Quantity Logging" description="Numeric metrics operators log during the stage"
        icon={<BarChart3 size={18} />} enabled={form.quantityLoggingEnabled}
        onToggle={(v) => setForm({ ...form, quantityLoggingEnabled: v })}
      >
        <div className="space-y-3">
          {form.quantityMetrics.map((m, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                value={m.metricName}
                onChange={(e) => { const arr = [...form.quantityMetrics]; arr[i] = { ...arr[i], metricName: e.target.value }; setForm({ ...form, quantityMetrics: arr }); }}
                placeholder="Metric name" className="col-span-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <input
                value={m.unitLabel}
                onChange={(e) => { const arr = [...form.quantityMetrics]; arr[i] = { ...arr[i], unitLabel: e.target.value }; setForm({ ...form, quantityMetrics: arr }); }}
                placeholder="Unit" className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              {/*<input
                type="number" value={m.minValue ?? ''}
                onChange={(e) => { const arr = [...form.quantityMetrics]; arr[i] = { ...arr[i], minValue: e.target.value === '' ? null : Number(e.target.value) }; setForm({ ...form, quantityMetrics: arr }); }}
                placeholder="Min" className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <input
                type="number" value={m.maxValue ?? ''}
                onChange={(e) => { const arr = [...form.quantityMetrics]; arr[i] = { ...arr[i], maxValue: e.target.value === '' ? null : Number(e.target.value) }; setForm({ ...form, quantityMetrics: arr }); }}
                placeholder="Max" className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />*/}
              <select
                value={m.inputFrequency}
                onChange={(e) => { const arr = [...form.quantityMetrics]; arr[i] = { ...arr[i], inputFrequency: e.target.value as any }; setForm({ ...form, quantityMetrics: arr }); }}
                className="col-span-1 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="ONCE">Once</option>
                <option value="PER_BATCH">Per Batch</option>
                <option value="HOURLY">Hourly</option>
              </select>
              <button type="button" onClick={() => setForm({ ...form, quantityMetrics: form.quantityMetrics.filter((_, idx) => idx !== i) })} className="col-span-1 text-slate-400 hover:text-danger-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, quantityMetrics: [...form.quantityMetrics, { metricName: '', unitLabel: '', minValue: null, maxValue: null, inputFrequency: 'PER_BATCH' }] })}
            className="flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-700"
          >
            <Plus size={16} /> Add Metric
          </button>
        </div>
      </TogglePanel>

      <TogglePanel
        title="Quality Control Form" description="Quality control questions for this stage"
        icon={<ClipboardCheck size={18} />} enabled={form.qcFormEnabled}
        onToggle={(v) => setForm({ ...form, qcFormEnabled: v })}
      >
        <div className="space-y-3">
          {form.qcQuestions.map((q, i) => (
            <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  value={q.questionText}
                  onChange={(e) => { const arr = [...form.qcQuestions]; arr[i] = { ...arr[i], questionText: e.target.value }; setForm({ ...form, qcQuestions: arr }); }}
                  placeholder="Question" className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                />
                <select
                  value={q.responseType}
                  onChange={(e) => { const arr = [...form.qcQuestions]; arr[i] = { ...arr[i], responseType: e.target.value as any }; setForm({ ...form, qcQuestions: arr }); }}
                  className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs"
                >
                  <option value="pass_fail">Pass/Fail</option>
                  {/*<option value="numeric">Numeric</option>
                  <option value="free_text">Free Text</option>*/}
                </select>
                <button type="button" onClick={() => setForm({ ...form, qcQuestions: form.qcQuestions.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-danger-600">
                  <Trash2 size={16} />
                </button>
              </div>
              {q.responseType === 'numeric' && (
                <div className="flex gap-2">
                  <input
                    type="number" value={q.numericMinValue ?? ''}
                    onChange={(e) => { const arr = [...form.qcQuestions]; arr[i] = { ...arr[i], numericMinValue: e.target.value === '' ? null : Number(e.target.value) }; setForm({ ...form, qcQuestions: arr }); }}
                    placeholder="Min" className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                  <input
                    type="number" value={q.numericMaxValue ?? ''}
                    onChange={(e) => { const arr = [...form.qcQuestions]; arr[i] = { ...arr[i], numericMaxValue: e.target.value === '' ? null : Number(e.target.value) }; setForm({ ...form, qcQuestions: arr }); }}
                    placeholder="Max" className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, qcQuestions: [...form.qcQuestions, { questionText: '', responseType: 'pass_fail', numericMinValue: null, numericMaxValue: null, isRequired: true }] })}
            className="flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-700"
          >
            <Plus size={16} /> Add Question
          </button>
        </div>
      </TogglePanel>

      <TogglePanel
        title="Fault Categories" description="Predefined fault types operators can report"
        icon={<AlertTriangle size={18} />} enabled={form.faultCategoriesEnabled}
        onToggle={(v) => setForm({ ...form, faultCategoriesEnabled: v })}
      >
        <div className="space-y-3">
          {form.faultCategories.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={f.faultName}
                onChange={(e) => { const arr = [...form.faultCategories]; arr[i] = { ...arr[i], faultName: e.target.value }; setForm({ ...form, faultCategories: arr }); }}
                placeholder="Fault name" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              
              <button type="button" onClick={() => setForm({ ...form, faultCategories: form.faultCategories.filter((_, idx) => idx !== i) })} className="text-slate-400 hover:text-danger-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setForm({ ...form, faultCategories: [...form.faultCategories, { faultName: '' }] })}
            className="flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:text-navy-700"
          >
            <Plus size={16} /> Add Fault Category
          </button>
        </div>
      </TogglePanel>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-lg transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {blueprintId ? 'Save Changes' : 'Create Blueprint'}
        </button>
        <button type="button" onClick={onCancel} className="px-6 py-3 border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}