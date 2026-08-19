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
  ListChecks,
  FileText,
  AlertOctagon,
  Lock,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { connectSocket } from '../../../shared/lib/socket';
import { IssueLogger } from '../components/IssueLogger';
import { InterruptionIntercept } from '../components/InterruptionIntercept';
import type { StageDetail, ChecklistItem, QuantityMetric, BatchEntry } from '../types';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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

// The checklist is nested under Quantity Logging and completed fresh for
// every batch — not once per stage lifecycle. Local `checked` state resets
// after each successful submission, since the next batch needs its own
// pass through the same items.
function QuantitySection({
  metrics,
  batches,
  checklistEnabled,
  checklistItems,
  onSubmitBatch,
}: {
  metrics: QuantityMetric[];
  batches: BatchEntry[];
  checklistEnabled: boolean;
  checklistItems: ChecklistItem[];
  onSubmitBatch: (
    entries: Record<string, number>,
    notes: string,
    checklist: { itemId: string; checked: boolean }[]
  ) => Promise<void>;
}) {
  const [entries, setEntries] = useState<Record<string, number>>(() =>
    Object.fromEntries(metrics.map((m) => [m.id, m.minValue ?? 0]))
  );
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChecklist = checklistEnabled && checklistItems.length > 0;
  const requiredItems = checklistItems.filter((i) => i.isRequired);
  const requiredDone = requiredItems.every((i) => checked.has(i.id));
  const canSubmit = !hasChecklist || requiredDone;

  const toggleItem = (itemId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const updateEntry = (metricId: string, value: number) => {
    setEntries((prev) => ({ ...prev, [metricId]: value }));
  };

  const submitBatch = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const checklistPayload = checklistItems.map((item) => ({ itemId: item.id, checked: checked.has(item.id) }));
      await onSubmitBatch(entries, notes.trim(), checklistPayload);
      setNotes('');
      setChecked(new Set());
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
        {hasChecklist && (
          <div className="space-y-2 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={18} className="text-navy-600" strokeWidth={2.5} />
                <h3 className="text-sm font-bold text-slate-800">Batch Checklist</h3>
              </div>
              {requiredDone ? (
                <span className="flex items-center gap-1 text-xs font-semibold text-success-600 bg-success-50 px-2 py-1 rounded-full">
                  <CheckCircle2 size={12} strokeWidth={2.5} />
                  Done
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-500">
                  {checked.size}/{checklistItems.length}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">Complete this before logging batch #{batches.length + 1}.</p>
            <div className="space-y-2 pt-1">
              {checklistItems.map((item) => {
                const isChecked = checked.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
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
          </div>
        )}

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
          disabled={isSubmitting || !canSubmit}
          className={`w-full py-3 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
            canSubmit ? 'bg-navy-900 hover:bg-navy-800' : 'bg-slate-400'
          }`}
        >
          {isSubmitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : !canSubmit ? (
            <Lock size={18} />
          ) : (
            <Plus size={18} />
          )}
          <span>{canSubmit ? `Log Batch #${batches.length + 1}` : 'Complete checklist to log batch'}</span>
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
  const [batches, setBatches] = useState<BatchEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDetail = useCallback(async () => {
    if (!stageId) return;
    try {
      const { data } = await api.get<StageDetail>(`/operator/stages/${stageId}`);
      setDetail(data);
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
  // immediately.
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

  const handleStart = async () => {
    if (!detail) return;
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
    setIsEnding(true);
    setActionError(null);
    try {
      await api.post(`/operator/stages/${detail.id}/complete`);
      navigate('/operator', { replace: true });
    } catch (e: any) {
      setActionError(e.response?.data?.message || 'Failed to complete process');
    } finally {
      setIsEnding(false);
    }
  };

  const handleQuantitySubmit = async (
    entries: Record<string, number>,
    notes: string,
    checklist: { itemId: string; checked: boolean }[]
  ) => {
    if (!detail) return;
    const entryArray = detail.quantityMetrics.map((m) => ({
      metricId: m.id,
      metricName: m.metricName,
      unitLabel: m.unitLabel,
      value: entries[m.id] ?? 0,
    }));
    await api.post(`/operator/stages/${detail.id}/quantity`, { entries: entryArray, notes: notes || null, checklist });
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

      {!isEmergencyStop && detail.status !== 'COMPLETED' && (
        <div className="px-4 pt-4">
          {detail.status === 'AVAILABLE' && (
            <button
              onClick={handleStart}
              className="w-full py-5 rounded-2xl text-white text-xl font-bold tracking-wide shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 bg-success-500 active:bg-success-600"
            >
              <Play size={28} fill="white" strokeWidth={2.5} />
              START PROCESS
            </button>
          )}

          {isRunning && (
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
                className="flex-1 py-5 rounded-2xl text-white text-lg font-bold tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-danger-500 active:bg-danger-600"
              >
                {isEnding ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <>
                    <Square size={24} fill="white" strokeWidth={2.5} />
                    END PROCESS
                  </>
                )}
              </button>
            </div>
          )}

          {isPaused && !isEmergencyStop && (
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
                className="flex-1 py-5 rounded-2xl text-white text-lg font-bold tracking-wide active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-danger-500 active:bg-danger-600"
              >
                {isEnding ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <>
                    <Square size={24} fill="white" strokeWidth={2.5} />
                    END PROCESS
                  </>
                )}
              </button>
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
        {detail.quantityLoggingEnabled && detail.quantityMetrics.length > 0 && (
          <QuantitySection
            metrics={detail.quantityMetrics}
            batches={batches}
            checklistEnabled={detail.checklistEnabled}
            checklistItems={detail.checklistItems}
            onSubmitBatch={handleQuantitySubmit}
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
