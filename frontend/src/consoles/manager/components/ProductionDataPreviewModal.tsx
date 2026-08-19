import { useEffect, useState } from 'react';
import { X, Loader2, AlertTriangle, Package, Send, Layers } from 'lucide-react';
import { api } from '../../../shared/lib/api';

interface MaterialConsumed {
  name: string;
  qty_used: number | null;
  unit: string;
  lot_number: string | null;
  source?: string;
}

interface DowntimeEntry {
  start: string;
  end: string;
  reason: string | null;
}

interface StageMetric {
  name: string;
  unit: string;
  total: number;
}

interface StageBatch {
  batchNumber: number;
  loggedAt: string;
  operatorName: string | null;
  quantityData: Record<string, number>;
}

interface StageReport {
  stageOrder: number;
  stageName: string;
  metrics: StageMetric[];
  batches: StageBatch[];
}

interface ScrapBreakdownEntry {
  source: string;
  metric: string;
  quantity: number;
  unit: string;
}

interface ErpPayload {
  work_order_id: string | null;
  job_id: string;
  batch_number: string | null;
  actual_produced: number;
  actual_scrap: number;
  materials_consumed: MaterialConsumed[];
  downtime_log: DowntimeEntry[];
  stages: StageReport[];
  scrap_breakdown: ScrapBreakdownEntry[];
}

interface ProductionDataPreviewModalProps {
  jobId: string;
  jobName: string;
  onClose: () => void;
  onSend: () => void;
  sending: boolean;
}

export function ProductionDataPreviewModal({ jobId, jobName, onClose, onSend, sending }: ProductionDataPreviewModalProps) {
  const [payload, setPayload] = useState<ErpPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ErpPayload>(`/manager/jobs/${jobId}/erp-preview`)
      .then((res) => {
        if (!cancelled) setPayload(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load preview.');
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-white rounded-card shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 bg-navy-950 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Production Report — Preview Before Sending to ERP</h2>
              <p className="text-slate-400 text-xs mt-0.5">{jobName}</p>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm">
              <AlertTriangle size={18} strokeWidth={2.5} />
              {error}
            </div>
          )}

          {!payload && !error && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={28} className="animate-spin" strokeWidth={2.5} />
            </div>
          )}

          {payload && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <PreviewStat label="Work Order" value={payload.work_order_id ?? '—'} />
                <PreviewStat label="Batch" value={payload.batch_number ?? '—'} />
                <PreviewStat label="Produced" value={String(payload.actual_produced)} tone="success" />
                <PreviewStat label="Scrap" value={String(payload.actual_scrap)} tone="danger" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={14} className="text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-900">Production Process</h3>
                  <span className="text-xs text-slate-400">({payload.stages.length} stages)</span>
                </div>
                <div className="space-y-3">
                  {[...payload.stages]
                    .sort((a, b) => a.stageOrder - b.stageOrder)
                    .map((stage) => (
                      <div key={stage.stageOrder} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900">
                            #{stage.stageOrder} {stage.stageName}
                          </span>
                          <div className="flex gap-1.5">
                            {stage.metrics.map((m) => (
                              <span
                                key={m.name}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  /reject|waste|scrap|loss|defect/i.test(m.name)
                                    ? 'bg-danger-100 text-danger-700 border-danger-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {m.name}: {m.total} {m.unit}
                              </span>
                            ))}
                          </div>
                        </div>
                        {stage.batches.length === 0 ? (
                          <EmptyRow>No batches logged at this stage.</EmptyRow>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide">
                                <th className="pl-3 pb-1.5 pt-2">Batch</th>
                                <th className="pb-1.5 pt-2">Operator</th>
                                <th className="pb-1.5 pt-2">Logged</th>
                                <th className="pb-1.5 pt-2 pr-3">Values</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stage.batches.map((b) => (
                                <tr key={b.batchNumber} className="border-t border-slate-100">
                                  <td className="pl-3 py-1.5 text-slate-500">#{b.batchNumber}</td>
                                  <td className="py-1.5 text-slate-500">{b.operatorName ?? 'Unassigned'}</td>
                                  <td className="py-1.5 text-slate-500">{new Date(b.loggedAt).toLocaleString()}</td>
                                  <td className="py-1.5 pr-3 text-slate-900">
                                    {Object.entries(b.quantityData)
                                      .map(([k, v]) => `${k}: ${v}`)
                                      .join(' · ')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <PreviewSection title="Scrap Breakdown" count={payload.scrap_breakdown.length}>
                {payload.scrap_breakdown.length === 0 ? (
                  <EmptyRow>No scrap or waste recorded on this job.</EmptyRow>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide">
                        <th className="pb-1.5 pr-3">Source</th>
                        <th className="pb-1.5 pr-3">Metric</th>
                        <th className="pb-1.5">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.scrap_breakdown.map((s, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 pr-3 text-slate-900">{s.source}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{s.metric}</td>
                          <td className="py-1.5 text-slate-500">
                            {s.quantity} {s.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </PreviewSection>

              <PreviewSection title="Materials Consumed" count={payload.materials_consumed.length}>
                {payload.materials_consumed.length === 0 ? (
                  <EmptyRow>No materials logged on this job.</EmptyRow>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide">
                        <th className="pb-1.5 pr-3">Material</th>
                        <th className="pb-1.5 pr-3">Qty Used</th>
                        <th className="pb-1.5 pr-3">Unit</th>
                        <th className="pb-1.5">Logged At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.materials_consumed.map((m, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 pr-3 text-slate-900">{m.name}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{m.qty_used ?? 'not tracked'}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{m.unit}</td>
                          <td className="py-1.5 text-slate-500">{m.source ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </PreviewSection>

              <PreviewSection title="Downtime Log" count={payload.downtime_log.length}>
                {payload.downtime_log.length === 0 ? (
                  <EmptyRow>No downtime recorded for this job.</EmptyRow>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wide">
                        <th className="pb-1.5 pr-3">Start</th>
                        <th className="pb-1.5 pr-3">End</th>
                        <th className="pb-1.5">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.downtime_log.map((d, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="py-1.5 pr-3 text-slate-500">{new Date(d.start).toLocaleString()}</td>
                          <td className="py-1.5 pr-3 text-slate-500">{new Date(d.end).toLocaleString()}</td>
                          <td className="py-1.5 text-slate-900">{d.reason ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </PreviewSection>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onSend}
            disabled={!payload || sending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Sending…
              </>
            ) : (
              <>
                Send to ERP
                <Send size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  const valueColor = tone === 'success' ? 'text-success-700' : tone === 'danger' ? 'text-danger-700' : 'text-slate-900';
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold mt-0.5 truncate ${valueColor}`}>{value}</p>
    </div>
  );
}

function PreviewSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Package size={14} className="text-slate-400" />
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-400">({count})</span>
      </div>
      <div className="rounded-xl border border-slate-200 p-3 overflow-x-auto">{children}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-400 italic py-1">{children}</p>;
}
