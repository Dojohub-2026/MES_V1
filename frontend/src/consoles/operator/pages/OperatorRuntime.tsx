import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Loader2,
  CheckCircle2,
  Plus,
  Minus,
  Check,
  X,
  AlertTriangle,
  ClipboardList,
  FlaskConical,
  ListChecks,
  FileText,
  AlertOctagon,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { connectSocket } from '../../../shared/lib/socket';
import { IssueLogger } from '../components/IssueLogger';
import { InterruptionIntercept } from '../components/InterruptionIntercept';
import type { StageDetail, ChecklistItem, QcQuestion, QuantityMetric, BatchEntry } from '../types';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ChecklistBlockerBanner({
  action,
  timing,
  remaining,
  onDismiss,
}: {
  action: 'start' | 'end';
  timing: string;
  remaining: number;
  onDismiss: () => void;
}) {
  const actionLabel = action === 'start' ? 'START PROCESS' : 'END PROCESS';
  const timingLabel =
    timing === 'before_start' ? 'before starting' : timing === 'before_completion' ? 'before completing' : 'before this action';

  return (
    <div className="mx-4 mt-3 p-4 rounded-2xl bg-warning-500 text-white">
      <div className="flex items-start gap-3">
        <ShieldAlert size={24} strokeWidth={2.5} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-bold text-base leading-tight">Checklist Required</p>
          <p className="text-sm font-medium opacity-90 mt-0.5">
            Complete {remaining} required item{remaining !== 1 ? 's' : ''} {timingLabel} you can {actionLabel}.
          </p>
        </div>
        <button onClick={onDismiss} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 active:bg-white/30 flex-shrink-0">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function GuidelinesSection({ content }: { content: string }) {
  return (
    <section className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <FileText size={22} className="text-navy-600" strokeWidth={2.5} />
        <h2 className="text-lg font-bold text-slate-900">Operating Guidelines</h2>
      </div>
      <div className="px-5 py-4">
        <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">{content}</p>
      </div>
    </section>
  );
}

function ChecklistSection({
  items,
  validationTiming,
  checked,
  onToggle,
  isBlocking,
}: {
  items: ChecklistItem[];
  validationTiming: string | null;
  checked: Set<string>;
  onToggle: (itemId: string) => void;
  isBlocking: boolean;
}) {
  const completedCount = items.filter((i) => checked.has(i.id)).length;
  const requiredItems = items.filter((i) => i.isRequired);
  const requiredDone = requiredItems.every((i) => checked.has(i.id));

  const timingBadge =
    validationTiming === 'before_start'
      ? 'Required before START'
      : validationTiming === 'before_completion'
      ? 'Required before END'
      : validationTiming === 'both'
      ? 'Required at START and END'
      : null;

  return (
    <section
      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
        isBlocking ? 'border-warning-400 shadow-[0_0_0_3px_rgba(251,191,36,0.3)]' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <ListChecks size={22} className={isBlocking ? 'text-warning-500' : 'text-navy-600'} strokeWidth={2.5} />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Pre-Start Checklist</h2>
            {timingBadge && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isBlocking ? 'bg-warning-100 text-warning-700' : 'bg-navy-100 text-navy-700'}`}>
                {timingBadge}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {requiredDone ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-success-600 bg-success-50 px-2 py-1 rounded-full">
              <CheckCircle2 size={14} strokeWidth={2.5} />
              Done
            </span>
          ) : (
            <span className="text-sm font-semibold text-slate-500">
              {completedCount}/{items.length}
            </span>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="px-5 pt-3 pb-1">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${requiredDone ? 'bg-success-500' : isBlocking ? 'bg-warning-400' : 'bg-navy-500'}`}
              style={{ width: `${(completedCount / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="p-4 space-y-2">
        {items.map((item) => {
          const isChecked = checked.has(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left active:scale-[0.99] transition-transform ${isChecked ? 'bg-success-50' : 'bg-slate-50'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                  isChecked ? 'bg-success-500 border-success-500' : 'bg-white border-slate-300'
                }`}
              >
                {isChecked && <Check size={20} className="text-white" strokeWidth={3} />}
              </div>
              <span className={`text-base flex-1 leading-snug ${isChecked ? 'text-slate-400 line-through' : 'text-slate-800 font-medium'}`}>
                {item.itemText}
              </span>
              {item.isRequired && !isChecked && (
                <span className="text-xs font-bold text-danger-600 bg-danger-50 px-2 py-1 rounded-md flex-shrink-0">REQUIRED</span>
              )}
              {item.isRequired && isChecked && <CheckCircle2 size={18} className="text-success-500 flex-shrink-0" strokeWidth={2.5} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function QuantitySection({
  metrics,
  batches,
  onSubmitBatch,
}: {
  metrics: QuantityMetric[];
  batches: BatchEntry[];
  onSubmitBatch: (entries: Record<string, number>, notes: string) => Promise<void>;
}) {
  const [entries, setEntries] = useState<Record<string, number>>(() =>
    Object.fromEntries(metrics.map((m) => [m.id, m.minValue ?? 0]))
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateEntry = (metricId: string, value: number) => {
    setEntries((prev) => ({ ...prev, [metricId]: value }));
  };

  const submitBatch = async () => {
    setIsSubmitting(true);
    try {
      await onSubmitBatch(entries, notes.trim());
      setNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <ClipboardList size={22} className="text-navy-600" strokeWidth={2.5} />
        <h2 className="text-lg font-bold text-slate-900">Quantity Log</h2>
        <span className="ml-auto text-sm text-slate-500">{batches.length} batches recorded</span>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((m) => {
            const val = entries[m.id] ?? m.minValue ?? 0;
            const hasRange = m.minValue !== null && m.maxValue !== null;
            const rangePercent = hasRange ? Math.min(100, ((val - (m.minValue ?? 0)) / ((m.maxValue ?? 1) - (m.minValue ?? 0))) * 100) : null;

            return (
              <div key={m.id} className="p-4 bg-slate-50 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{m.metricName}</span>
                  <span className="text-sm text-slate-500">{m.unitLabel}</span>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => updateEntry(m.id, Math.max(val - 1, m.minValue ?? -Infinity))}
                    className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Minus size={18} className="text-slate-700" />
                  </button>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => updateEntry(m.id, parseFloat(e.target.value) || 0)}
                    className="w-24 text-center text-2xl font-bold text-slate-900 bg-white border border-slate-200 rounded-lg py-1"
                  />
                  <button
                    onClick={() => updateEntry(m.id, Math.min(val + 1, m.maxValue ?? Infinity))}
                    className="w-10 h-10 rounded-lg bg-navy-900 flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <Plus size={18} className="text-white" />
                  </button>
                </div>

                {rangePercent !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Min: {m.minValue}</span>
                      <span>Max: {m.maxValue}</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-navy-500 rounded-full transition-all" style={{ width: `${rangePercent}%` }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add batch notes..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
          />
        </div>

        <button
          onClick={submitBatch}
          disabled={isSubmitting}
          className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          <span>Log Batch #{batches.length + 1}</span>
        </button>

        {batches.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-slate-700">Batch History</h3>
            {batches.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-900">Batch #{log.batchNumber}</span>
                  <span className="text-xs text-slate-500">{new Date(log.loggedAt).toLocaleString()}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(log.quantityData).map(([name, value]) => (
                    <span key={name} className="px-2 py-0.5 bg-white rounded text-slate-600">
                      {name}: {value}
                    </span>
                  ))}
                </div>
                {log.notes && <p className="text-slate-500 mt-1 italic">"{log.notes}"</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface QcAnswer {
  passed?: boolean;
  responseText?: string;
}

function QCSection({
  questions,
  answers,
  onAnswer,
}: {
  questions: QcQuestion[];
  answers: Record<string, QcAnswer>;
  onAnswer: (questionId: string, answer: QcAnswer) => void;
}) {
  return (
    <section className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <FlaskConical size={22} className="text-navy-600" strokeWidth={2.5} />
        <h2 className="text-lg font-bold text-slate-900">Quality Control Check</h2>
      </div>
      <div className="p-4 space-y-4">
        {questions.map((q) => {
          const answer = answers[q.id] ?? {};
          return (
            <div key={q.id} className="p-4 bg-slate-50 rounded-xl">
              <p className="text-base font-semibold text-slate-900 mb-3">
                {q.questionText}
                {q.isRequired && <span className="text-danger-600 ml-1">*</span>}
              </p>
              {q.responseType === 'pass_fail' ? (
                <div className="flex gap-3">
                  <button
                    onClick={() => onAnswer(q.id, { passed: true })}
                    className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 ${
                      answer.passed === true ? 'bg-success-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 size={20} strokeWidth={2.5} />
                    PASS
                  </button>
                  <button
                    onClick={() => onAnswer(q.id, { passed: false })}
                    className={`flex-1 py-3 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2 ${
                      answer.passed === false ? 'bg-danger-500 text-white' : 'bg-white border-2 border-slate-200 text-slate-600'
                    }`}
                  >
                    <X size={20} strokeWidth={2.5} />
                    FAIL
                  </button>
                </div>
              ) : q.responseType === 'numeric' ? (
                <div>
                  <input
                    type="number"
                    value={answer.responseText || ''}
                    onChange={(e) => onAnswer(q.id, { responseText: e.target.value })}
                    placeholder="Enter value..."
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-xl font-bold text-slate-900 focus:outline-none focus:border-navy-500"
                  />
                  {q.numericMinValue !== null && q.numericMaxValue !== null && (
                    <p className="text-sm text-slate-500 mt-1.5">
                      Target range: {q.numericMinValue}–{q.numericMaxValue}
                    </p>
                  )}
                </div>
              ) : (
                <textarea
                  rows={3}
                  value={answer.responseText || ''}
                  onChange={(e) => onAnswer(q.id, { responseText: e.target.value })}
                  placeholder="Type your response..."
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-base text-slate-900 focus:outline-none focus:border-navy-500 resize-none"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function OperatorRuntime() {
  const { stageId } = useParams<{ stageId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<StageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isIssueLoggerOpen, setIsIssueLoggerOpen] = useState(false);
  const [isInterruptionOpen, setIsInterruptionOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  // Checklist progress lives only in this component's state — it's never
  // sent to or loaded from the backend. If the operator navigates away and
  // back, or refreshes the page, mid-stage checklist progress resets to
  // empty and every item has to be re-checked, even though the stage
  // itself is still RUNNING.
  const [checklistChecked, setChecklistChecked] = useState<Set<string>>(new Set());
  const [checklistBlockingAction, setChecklistBlockingAction] = useState<'start' | 'end' | null>(null);
  const [qcAnswers, setQcAnswers] = useState<Record<string, QcAnswer>>({});
  const [batches, setBatches] = useState<BatchEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDetail = useCallback(async () => {
    if (!stageId) return;
    try {
      const { data } = await api.get<StageDetail>(`/operator/stages/${stageId}`);
      setDetail(data);
      const seeded: Record<string, QcAnswer> = {};
      data.qcResponses.forEach((r) => {
        seeded[r.questionId] = { passed: r.passed ?? undefined, responseText: r.responseText ?? undefined };
      });
      setQcAnswers(seeded);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load process');
    } finally {
      setLoading(false);
    }
  }, [stageId]);

  const loadBatches = useCallback(async () => {
    if (!stageId) return;
    const { data } = await api.get(`/operator/stages/${stageId}/quantity`);
    setBatches(data.batches);
  }, [stageId]);

  useEffect(() => {
    loadDetail();
    loadBatches();
  }, [loadDetail, loadBatches]);

  // Elapsed time is computed from the server-recorded actualStartedAt
  // timestamp every tick, not accumulated locally — so a page refresh or
  // navigating away and back still shows the correct elapsed time
  // immediately, rather than resetting to zero like the checklist state
  // above does.
  useEffect(() => {
    if (!detail?.actualStartedAt) {
      setElapsedSeconds(0);
      return;
    }
    const started = new Date(detail.actualStartedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    if (detail.status === 'RUNNING') {
      timerRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [detail?.actualStartedAt, detail?.status]);

  useEffect(() => {
    const socket = connectSocket();

    const handleTriggered = (payload: { jobIds: string[] }) => {
      setDetail((prev) => {
        if (!prev || !payload.jobIds.includes(prev.jobId)) return prev;
        return { ...prev, status: 'PAUSED', jobStatus: 'PAUSED' };
      });
    };

    const handleResumed = (payload: { jobIds: string[]; stages?: { stageId: string; status: StageDetail['status'] }[] }) => {
      let needsRefetch = false;
      setDetail((prev) => {
        if (!prev || !payload.jobIds.includes(prev.jobId)) return prev;
        const match = payload.stages?.find((s) => s.stageId === prev.id);
        if (!match) {
          needsRefetch = true;
          return prev;
        }
        return { ...prev, status: match.status, jobStatus: 'ACTIVE' };
      });
      if (needsRefetch) loadDetail();
    };

    socket.on('emergency:triggered', handleTriggered);
    socket.on('emergency:resumed', handleResumed);
    return () => {
      socket.off('emergency:triggered', handleTriggered);
      socket.off('emergency:resumed', handleResumed);
    };
  }, [loadDetail]);

  const isRunning = detail?.status === 'RUNNING';
  const isPaused = detail?.status === 'PAUSED';
  // A stage can be PAUSED for two different reasons: the operator paused it
  // themselves (job stays ACTIVE), or a manager triggered Emergency Stop on
  // the whole job (job goes PAUSED too). Only the second case locks out the
  // self-service Resume button — mirrors the same check in the backend's
  // runtimeController.resumeStage.
  const isEmergencyStop = isPaused && detail?.jobStatus === 'PAUSED';

  const timing = detail?.checklistValidationTiming ?? null;
  const hasChecklist = !!(detail?.checklistEnabled && detail.checklistItems.length > 0);
  const requiredChecklistItems = detail?.checklistItems.filter((i) => i.isRequired) ?? [];
  const allChecklistDone = requiredChecklistItems.length === 0 || requiredChecklistItems.every((i) => checklistChecked.has(i.id));
  const remainingRequired = requiredChecklistItems.filter((i) => !checklistChecked.has(i.id)).length;

  const requiredQcQuestions = detail?.qcQuestions.filter((q) => q.isRequired) ?? [];
  const isQcAnswered = (q: (typeof requiredQcQuestions)[number]) => {
    const a = qcAnswers[q.id];
    if (!a) return false;
    return q.responseType === 'pass_fail' ? a.passed !== undefined : !!a.responseText?.trim();
  };
  const allQcDone = requiredQcQuestions.length === 0 || requiredQcQuestions.every(isQcAnswered);

  const startBlocked = hasChecklist && (timing === 'before_start' || timing === 'both') && !allChecklistDone;
  const endChecklistBlocked = hasChecklist && (timing === 'before_completion' || timing === 'both') && !allChecklistDone;
  const endQcBlocked = !!detail?.requiresQc && !allQcDone;
  const endBlocked = endChecklistBlocked || endQcBlocked;

  const handleChecklistToggle = useCallback((itemId: string) => {
    setChecklistChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setChecklistBlockingAction(null);
  }, []);

  const handleStart = async () => {
    if (!detail) return;
    if (startBlocked) {
      setChecklistBlockingAction('start');
      return;
    }
    setActionError(null);
    try {
      await api.post(`/operator/stages/${detail.id}/start`);
      setDetail((prev) => (prev ? { ...prev, status: 'RUNNING', actualStartedAt: prev.actualStartedAt || new Date().toISOString() } : prev));
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Failed to start process');
    }
  };

  const handlePause = () => {
    if (!detail) return;
    setIsInterruptionOpen(true);
  };

  const handleInterruptionSelect = async (reason: string) => {
    if (!detail) return;
    setIsPausing(true);
    setActionError(null);
    try {
      await api.post(`/operator/stages/${detail.id}/pause`, { reason });
      setDetail((prev) => (prev ? { ...prev, status: 'PAUSED' } : prev));
      setIsInterruptionOpen(false);
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Failed to pause process');
      setIsInterruptionOpen(false);
    } finally {
      setIsPausing(false);
    }
  };

  const handleResume = async () => {
    if (!detail) return;
    setActionError(null);
    try {
      await api.post(`/operator/stages/${detail.id}/resume`);
      setDetail((prev) => (prev ? { ...prev, status: 'RUNNING' } : prev));
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Failed to resume process');
    }
  };

  const handleEndProcess = async () => {
    if (!detail) return;
    if (endBlocked) {
      setChecklistBlockingAction('end');
      return;
    }
    setChecklistBlockingAction(null);
    setIsEnding(true);
    setActionError(null);
    try {
      const answeredResponses = Object.entries(qcAnswers)
        .filter(([, a]) => a.passed !== undefined || !!a.responseText?.trim())
        .map(([questionId, a]) => ({ questionId, passed: a.passed ?? null, responseText: a.responseText ?? null }));
      if (answeredResponses.length > 0) {
        await api.post(`/operator/stages/${detail.id}/qc`, { responses: answeredResponses });
      }
      await api.post(`/operator/stages/${detail.id}/complete`);
      navigate('/operator', { replace: true });
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Failed to complete process');
    } finally {
      setIsEnding(false);
    }
  };

  const handleQuantitySubmit = async (entries: Record<string, number>, notes: string) => {
    if (!detail) return;
    const entryArray = detail.quantityMetrics.map((m) => ({
      metricId: m.id,
      metricName: m.metricName,
      unitLabel: m.unitLabel,
      value: entries[m.id] ?? 0,
    }));
    await api.post(`/operator/stages/${detail.id}/quantity`, { entries: entryArray, notes: notes || null });
    await loadBatches();
  };

  const handleIssueSubmit = async (payload: { faultName: string; severity: 'CRITICAL' | 'MINOR'; notes: string }) => {
    if (!detail) return;
    await api.post(`/operator/stages/${detail.id}/faults`, payload);
    setIsIssueLoggerOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center max-w-md mx-auto">
        <Loader2 size={32} className="text-navy-500 animate-spin" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center max-w-md mx-auto px-6 text-center">
        <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-danger-600" strokeWidth={2.5} />
        </div>
        <p className="text-lg font-bold text-slate-900 mb-1">Unable to Load Process</p>
        <p className="text-base text-slate-500 mb-6">{error || 'Unknown error'}</p>
        <button onClick={() => navigate('/operator')} className="px-6 py-3 rounded-xl bg-navy-900 text-white text-base font-bold active:bg-navy-800">
          Back to Assignments
        </button>
      </div>
    );
  }

  if (isIssueLoggerOpen) {
    return (
      <IssueLogger
        faultCategories={detail.faultCategories}
        stageName={detail.stageName}
        jobId={detail.jobId}
        jobName={detail.jobName}
        productName={detail.productName}
        onSubmit={handleIssueSubmit}
        onBack={() => setIsIssueLoggerOpen(false)}
      />
    );
  }

  const getStatusLabel = () => {
    if (isEmergencyStop) return { label: 'EMERGENCY STOP', color: 'text-danger-600', bg: 'bg-danger-100' };
    if (detail.status === 'AVAILABLE') return { label: 'READY TO START', color: 'text-slate-600', bg: 'bg-slate-100' };
    if (isRunning) return { label: 'RUNNING', color: 'text-cyan-700', bg: 'bg-cyan-100' };
    if (isPaused) return { label: 'PAUSED', color: 'text-warning-700', bg: 'bg-warning-100' };
    return { label: 'COMPLETED', color: 'text-success-700', bg: 'bg-success-100' };
  };
  const statusLabel = getStatusLabel();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/operator')}
              className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-700" strokeWidth={2.5} />
            </button>

            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm font-bold ${statusLabel.bg} ${statusLabel.color}`}>{statusLabel.label}</div>
              <div className="font-mono text-xl font-bold text-slate-900 tabular-nums">{formatDuration(elapsedSeconds)}</div>
            </div>
          </div>

          <div className="mt-1">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">{detail.stageName}</h1>
            <p className="text-sm text-slate-500">
              {detail.jobName}
              {detail.productName ? ` · ${detail.productName}` : ''}
            </p>
          </div>
        </div>
      </header>

      {isEmergencyStop && (
        <div className="mx-4 mt-4 p-5 rounded-2xl bg-danger-500 text-white">
          <div className="flex items-center gap-3">
            <AlertOctagon size={32} strokeWidth={2.5} />
            <div>
              <p className="text-lg font-bold">EMERGENCY STOP ACTIVE</p>
              <p className="text-sm font-medium opacity-90">Process frozen by manager. Await authorization to resume.</p>
            </div>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-danger-500 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {checklistBlockingAction && timing && (
        <ChecklistBlockerBanner
          action={checklistBlockingAction}
          timing={timing}
          // Both branches of this ternary currently evaluate to the same
          // value — remainingRequired isn't actually split by start vs.
          // end timing. Only matters in practice if a blueprint uses
          // checklistValidationTiming: 'both' with different items required
          // at start vs. completion; today the banner would show the same
          // "remaining" count regardless of which action triggered it.
          remaining={checklistBlockingAction === 'start' ? remainingRequired : remainingRequired}
          onDismiss={() => setChecklistBlockingAction(null)}
        />
      )}

      {!isEmergencyStop && detail.status !== 'COMPLETED' && (
        <div className="px-4 pt-4">
          {detail.status === 'AVAILABLE' && (
            <div className="space-y-2">
              <button
                onClick={handleStart}
                className={`w-full py-5 rounded-2xl text-white text-xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${
                  startBlocked ? 'bg-slate-400 active:bg-slate-500' : 'bg-success-500 active:bg-success-600'
                }`}
              >
                {startBlocked ? (
                  <>
                    <Lock size={26} strokeWidth={2.5} />
                    CHECKLIST REQUIRED
                  </>
                ) : (
                  <>
                    <Play size={28} fill="white" strokeWidth={2.5} />
                    START PROCESS
                  </>
                )}
              </button>
              {startBlocked && (
                <p className="text-center text-sm text-slate-500 font-medium">
                  Complete {remainingRequired} required checklist item{remainingRequired !== 1 ? 's' : ''} below to unlock
                </p>
              )}
            </div>
          )}

          {isRunning && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <button
                  onClick={handlePause}
                  className="flex-1 py-5 rounded-2xl bg-warning-500 text-white text-lg font-bold tracking-wide active:bg-warning-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Pause size={24} fill="white" strokeWidth={2.5} />
                  PAUSE
                </button>
                <button
                  onClick={handleEndProcess}
                  disabled={isEnding}
                  className={`flex-1 py-5 rounded-2xl text-white text-lg font-bold tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                    endBlocked ? 'bg-slate-400 active:bg-slate-500' : 'bg-danger-500 active:bg-danger-600'
                  }`}
                >
                  {isEnding ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : endBlocked ? (
                    <>
                      <Lock size={22} strokeWidth={2.5} />
                      LOCKED
                    </>
                  ) : (
                    <>
                      <Square size={24} fill="white" strokeWidth={2.5} />
                      END PROCESS
                    </>
                  )}
                </button>
              </div>
              {endBlocked && (
                <p className="text-center text-sm text-slate-500 font-medium">
                  {endQcBlocked ? 'Complete required QC checks and checklist items to unlock END PROCESS' : 'Complete required checklist items to unlock END PROCESS'}
                </p>
              )}
            </div>
          )}

          {isPaused && !isEmergencyStop && (
            <div className="space-y-2">
              <div className="flex gap-3">
                <button
                  onClick={handleResume}
                  className="flex-1 py-5 rounded-2xl bg-success-500 text-white text-lg font-bold tracking-wide active:bg-success-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Play size={24} fill="white" strokeWidth={2.5} />
                  RESUME
                </button>
                <button
                  onClick={handleEndProcess}
                  disabled={isEnding}
                  className={`flex-1 py-5 rounded-2xl text-white text-lg font-bold tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                    endBlocked ? 'bg-slate-400 active:bg-slate-500' : 'bg-danger-500 active:bg-danger-600'
                  }`}
                >
                  {isEnding ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : endBlocked ? (
                    <>
                      <Lock size={22} strokeWidth={2.5} />
                      LOCKED
                    </>
                  ) : (
                    <>
                      <Square size={24} fill="white" strokeWidth={2.5} />
                      END PROCESS
                    </>
                  )}
                </button>
              </div>
              {endBlocked && <p className="text-center text-sm text-slate-500 font-medium">Complete required checklist/QC items to unlock END PROCESS</p>}
            </div>
          )}
        </div>
      )}

      {detail.status === 'COMPLETED' && (
        <div className="mx-4 mt-4 p-5 rounded-2xl bg-success-50 border-2 border-success-200 flex items-center gap-3">
          <CheckCircle2 size={32} className="text-success-600" strokeWidth={2.5} />
          <div>
            <p className="text-lg font-bold text-success-800">Process Completed</p>
            <p className="text-sm text-success-600">This stage has been marked complete.</p>
          </div>
        </div>
      )}

      <main className="flex-1 px-4 py-4 space-y-4 pb-32">
        {detail.instruction && (
          <section className="bg-navy-50 border-2 border-navy-100 rounded-2xl px-5 py-4">
            <p className="text-sm font-bold text-navy-700 mb-1">Work Instruction</p>
            <p className="text-base text-navy-900">{detail.instruction}</p>
          </section>
        )}
        {detail.guidelinesEnabled && detail.guidelinesContent && <GuidelinesSection content={detail.guidelinesContent} />}
        {detail.checklistEnabled && detail.checklistItems.length > 0 && (
          <ChecklistSection
            items={detail.checklistItems}
            validationTiming={detail.checklistValidationTiming}
            checked={checklistChecked}
            onToggle={handleChecklistToggle}
            isBlocking={!!checklistBlockingAction}
          />
        )}
        {detail.quantityLoggingEnabled && detail.quantityMetrics.length > 0 && (
          <QuantitySection metrics={detail.quantityMetrics} batches={batches} onSubmitBatch={handleQuantitySubmit} />
        )}
        {detail.qcFormEnabled && detail.qcQuestions.length > 0 && (
          <QCSection
            questions={detail.qcQuestions}
            answers={qcAnswers}
            onAnswer={(id, answer) => setQcAnswers((prev) => ({ ...prev, [id]: answer }))}
          />
        )}
      </main>

      {detail.status !== 'COMPLETED' && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 py-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={() => setIsIssueLoggerOpen(true)}
            className="w-full py-4 rounded-2xl border-2 border-danger-300 bg-danger-50 text-danger-700 text-base font-bold active:bg-danger-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <AlertTriangle size={22} strokeWidth={2.5} />
            REPORT FAULT / ISSUE
          </button>
        </div>
      )}

      <InterruptionIntercept
        isOpen={isInterruptionOpen}
        isSubmitting={isPausing}
        onSelectReason={handleInterruptionSelect}
        onCancel={() => setIsInterruptionOpen(false)}
      />
    </div>
  );
}
