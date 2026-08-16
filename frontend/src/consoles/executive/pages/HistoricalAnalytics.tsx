import { useCallback, useEffect, useState, useMemo, Fragment } from 'react';
import {
  Calendar, Download, Clock, AlertTriangle, AlertOctagon, Users, ChevronDown, ChevronRight,
  Loader2, AlertCircle, BarChart3, Filter, Package, Trash2, Activity,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { connectSocket } from '../../../shared/lib/socket';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Tab = 'timelines' | 'downtime' | 'scrap' | 'operators';

const tabConfig: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'timelines', label: 'Job Timelines', icon: <Clock size={18} strokeWidth={2.5} /> },
  { id: 'downtime', label: 'Downtime & Faults', icon: <AlertTriangle size={18} strokeWidth={2.5} /> },
  { id: 'scrap', label: 'Scrap Tracking', icon: <Trash2 size={18} strokeWidth={2.5} /> },
  { id: 'operators', label: 'Operator Activity', icon: <Users size={18} strokeWidth={2.5} /> },
];

interface JobStageRow {
  id: string;
  stageOrder: number;
  stageName: string;
  status: string;
  estimatedDurationMinutes: number;
  actualDurationMinutes: number | null;
  operatorName: string | null;
}

interface JobHistoryRow {
  id: string;
  jobId: string;
  name: string;
  productName: string | null;
  lineName: string;
  targetQuantity: number;
  actualProducedQty: number | null;
  unit: string;
  status: string;
  scheduledStartAt: string | null;
  completedAt: string | null;
  stages: JobStageRow[];
}

interface FaultRecord {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'MINOR';
  category: string | null;
  loggedAt: string;
  resolvedAt: string | null;
  jobId: string | null;
  jobName: string | null;
  lineName: string | null;
  operatorName: string | null;
}

interface DowntimeRecord {
  id: string;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  jobId: string | null;
  jobName: string | null;
  lineName: string | null;
}

interface ScrapRecord {
  id: string;
  quantity: number;
  unit: string;
  wasteType: string;
  notes: string | null;
  loggedAt: string;
  jobId: string | null;
  jobName: string | null;
  productName: string | null;
  lineName: string | null;
  processName: string | null;
}

interface BatchLogRow {
  id: string;
  batchNumber: number;
  loggedAt: string;
  quantityData: Record<string, number>;
  notes: string | null;
  jobId: string | null;
  jobName: string | null;
  productName: string | null;
  lineName: string | null;
  stageName: string | null;
  operatorName: string | null;
}

interface OperatorActivityRow {
  operatorName: string;
  tasksAssigned: number;
  tasksCompleted: number;
  avgActualDurationMinutes: number | null;
  faultsLogged: number;
  lastActiveAt: string | null;
}

interface AnalyticsData {
  range: { startDate: string; endDate: string };
  jobHistory: JobHistoryRow[];
  faultRecords: FaultRecord[];
  downtimeRecords: DowntimeRecord[];
  scrapRecords: ScrapRecord[];
  batchLogs: BatchLogRow[];
  operatorActivity: OperatorActivityRow[];
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-success-100 text-success-700 border-success-200',
    ACTIVE: 'bg-info-100 text-info-700 border-info-200',
    PAUSED: 'bg-warning-100 text-warning-700 border-warning-200',
    DRAFT: 'bg-slate-100 text-slate-500 border-slate-200',
    CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.DRAFT}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-xl border border-slate-200">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Filter size={28} className="text-slate-400" strokeWidth={2} />
      </div>
      <p className="text-base font-semibold text-slate-700">No Records for This Range</p>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{message}</p>
    </div>
  );
}

function JobTimelinesTab({ data }: { data: JobHistoryRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (data.length === 0) {
    return <EmptyState message="No jobs were created in this date range." />;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <div className="col-span-3">Job / Product</div>
        <div className="col-span-2">Date</div>
        <div className="col-span-2 text-center">Status</div>
        <div className="col-span-2 text-center">Target / Actual</div>
        <div className="col-span-1 text-right">Est.</div>
        <div className="col-span-2 text-right">Actual Duration</div>
      </div>

      {data.map((job) => {
        const isExpanded = expanded.has(job.id);
        const totalEstimated = job.stages.reduce((sum, s) => sum + s.estimatedDurationMinutes, 0);
        const totalActual = job.stages.reduce((sum, s) => sum + (s.actualDurationMinutes || 0), 0);
        const anyActual = job.stages.some((s) => s.actualDurationMinutes !== null);

        return (
          <div key={job.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => toggle(job.id)}
              className="w-full grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors text-left"
            >
              <div className="col-span-3 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center flex-shrink-0">
                  <Package size={16} className="text-navy-600" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
                  <p className="text-xs text-slate-500 truncate">{job.jobId} · {job.lineName}</p>
                </div>
              </div>
              <div className="col-span-2 text-sm text-slate-600">
                {job.scheduledStartAt ? new Date(job.scheduledStartAt).toLocaleString() : '—'}
              </div>
              <div className="col-span-2 flex justify-center">{statusBadge(job.status)}</div>
              <div className="col-span-2 text-center text-sm text-slate-700">
                {job.targetQuantity.toLocaleString()} / {job.actualProducedQty != null ? job.actualProducedQty.toLocaleString() : '—'} {job.unit}
              </div>
              <div className="col-span-1 text-right text-sm font-medium text-slate-600">{totalEstimated} min</div>
              <div className="col-span-2 flex items-center justify-end gap-2">
                <span className="text-sm font-bold text-slate-900">{anyActual ? `${totalActual} min` : '—'}</span>
                {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase">
                      <th className="text-left py-2 pl-11">Stage</th>
                      <th className="text-center py-2">Est. (min)</th>
                      <th className="text-center py-2">Actual (min)</th>
                      <th className="text-center py-2">Variance</th>
                      <th className="text-right py-2">Operator</th>
                    </tr>
                  </thead>
                  <tbody>
                    {job.stages.map((stage) => {
                      const variance = stage.actualDurationMinutes !== null ? stage.actualDurationMinutes - stage.estimatedDurationMinutes : null;
                      return (
                        <tr key={stage.id} className="border-t border-slate-200">
                          <td className="py-2 pl-11">
                            <span className="text-xs text-slate-500 mr-2">{stage.stageOrder + 1}.</span>
                            <span className="font-medium text-slate-800">{stage.stageName}</span>
                          </td>
                          <td className="text-center py-2 text-slate-600">{stage.estimatedDurationMinutes || '-'}</td>
                          <td className="text-center py-2 font-medium text-slate-800">{stage.actualDurationMinutes ?? '-'}</td>
                          <td className="text-center py-2">
                            {variance !== null ? (
                              <span className={`font-medium ${variance > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                                {variance > 0 ? '+' : ''}{variance}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="text-right py-2 text-slate-600">{stage.operatorName || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DowntimeFaultsTab({ downtime, faults }: { downtime: DowntimeRecord[]; faults: FaultRecord[] }) {
  const downtimeByReason = useMemo(() => {
    const agg: Record<string, number> = {};
    downtime.forEach((d) => {
      if (d.durationMinutes) agg[d.reason] = (agg[d.reason] || 0) + d.durationMinutes;
    });
    return Object.entries(agg)
      .map(([reason, minutes]) => ({ reason, minutes }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [downtime]);

  const maxMinutes = Math.max(...downtimeByReason.map((d) => d.minutes), 1);

  if (downtime.length === 0 && faults.length === 0) {
    return <EmptyState message="No faults or downtime were logged in this date range." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-navy-600" strokeWidth={2.5} />
            <h3 className="text-base font-bold text-slate-900">Downtime by Reason</h3>
          </div>
          <span className="text-sm text-slate-500">{downtime.reduce((s, d) => s + (d.durationMinutes || 0), 0)} total minutes</span>
        </div>
        {downtimeByReason.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No downtime entries logged in this range.</p>
        ) : (
          <div className="space-y-3">
            {downtimeByReason.map((item) => (
              <div key={item.reason} className="flex items-center gap-4">
                <div className="w-40 text-sm text-slate-700 truncate">{item.reason}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className="h-full bg-warning-500 rounded-lg" style={{ width: `${(item.minutes / maxMinutes) * 100}%` }} />
                </div>
                <div className="w-20 text-right text-sm font-semibold text-slate-700">{item.minutes} min</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Fault Log</h3>
        </div>
        {faults.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No faults logged in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fault</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Job / Line</th>
                  <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Severity</th>
                  <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Logged</th>
                  <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {faults.map((f) => (
                  <tr key={f.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{f.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{f.jobName || '—'} {f.lineName ? `· ${f.lineName}` : ''}</td>
                    <td className="px-6 py-4 text-center">
                      {f.severity === 'CRITICAL' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-danger-100 text-danger-700 border border-danger-200">
                          <AlertOctagon size={12} strokeWidth={2.5} /> Critical
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-warning-100 text-warning-700 border border-warning-200">
                          <AlertTriangle size={12} strokeWidth={2.5} /> Minor
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-slate-500">{new Date(f.loggedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-center text-sm">
                      {f.resolvedAt ? (
                        <span className="text-success-600 font-medium">Resolved</span>
                      ) : (
                        <span className="text-warning-600 font-medium">Open</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ScrapTrackingTab({ scrapData, batchData }: { scrapData: ScrapRecord[]; batchData: BatchLogRow[] }) {
  // Sums s.quantity across all matching records regardless of s.unit — if
  // scrap for the same waste type or line is ever logged in mixed units
  // (kg alongside liters or units), this total blends them into one number
  // with no unit conversion. Fine today if scrap logging happens to be
  // consistent per waste type/line in practice, but worth checking before
  // trusting this total if that assumption ever breaks.
  const byWasteType = useMemo(() => {
    const agg: Record<string, number> = {};
    scrapData.forEach((s) => {
      agg[s.wasteType] = (agg[s.wasteType] || 0) + s.quantity;
    });
    return Object.entries(agg)
      .map(([wasteType, quantity]) => ({ wasteType, quantity }))
      .sort((a, b) => b.quantity - a.quantity);
  }, [scrapData]);

  const byLine = useMemo(() => {
    const agg: Record<string, number> = {};
    scrapData.forEach((s) => {
      const key = s.lineName || 'Unassigned';
      agg[key] = (agg[key] || 0) + s.quantity;
    });
    return Object.entries(agg)
      .map(([lineName, total]) => ({ lineName, total }))
      .sort((a, b) => b.total - a.total);
  }, [scrapData]);

  const maxQuantity = Math.max(...byWasteType.map((d) => d.quantity), 1);

  if (scrapData.length === 0 && batchData.length === 0) {
    return (
      <EmptyState message="No scrap or batch quantities have been logged in this date range. Managers can log scrap manually, and operators log batch quantities from the floor console." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-danger-100 flex items-center justify-center">
              <Trash2 size={18} className="text-danger-600" strokeWidth={2.5} />
            </div>
            <span className="text-sm text-slate-600">Total Scrap Logged</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{scrapData.length} entr{scrapData.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-navy-100 flex items-center justify-center">
              <Package size={18} className="text-navy-600" strokeWidth={2.5} />
            </div>
            <span className="text-sm text-slate-600">Waste Types</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{byWasteType.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-info-100 flex items-center justify-center">
              <Activity size={18} className="text-info-600" strokeWidth={2.5} />
            </div>
            <span className="text-sm text-slate-600">Production Lines</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{byLine.length}</p>
        </div>
      </div>

      {byWasteType.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-base font-bold text-slate-900 mb-4">Scrap by Waste Type</h3>
          <div className="space-y-3">
            {byWasteType.map((item) => (
              <div key={item.wasteType} className="flex items-center gap-4">
                <div className="w-40 text-sm text-slate-700 truncate">{item.wasteType}</div>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div className="h-full bg-danger-500 rounded-lg" style={{ width: `${(item.quantity / maxQuantity) * 100}%` }} />
                </div>
                <div className="w-24 text-right text-sm font-semibold text-slate-700">{item.quantity.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {scrapData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Trash2 size={20} className="text-navy-600" strokeWidth={2.5} />
              <h3 className="text-base font-bold text-slate-900">Scrap & Waste Log</h3>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Production Line</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Process</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity Wasted</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Waste Type</th>
                </tr>
              </thead>
              <tbody>
                {scrapData.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <span className="text-base font-bold text-slate-900">{row.lineName || 'Unassigned'}</span>
                    </td>
                    <td className="px-6 py-5 text-base text-slate-700">{row.processName || row.jobName || '—'}</td>
                    <td className="px-6 py-5 text-center">
                      <span className="text-base font-semibold text-slate-900">{row.quantity.toLocaleString()}</span>
                      <span className="text-base text-slate-500 ml-1">{row.unit}</span>
                    </td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        {row.wasteType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-navy-600" strokeWidth={2.5} />
            <h3 className="text-base font-bold text-slate-900">Logged Batch Data</h3>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Every quantity batch operators have recorded from the floor console, including production and waste metrics.</p>
        </div>
        {batchData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No batch quantities logged in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Job / Line</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Stage</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Operator</th>
                  <th className="text-center px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Batch #</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Quantities Logged</th>
                  <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Logged At</th>
                </tr>
              </thead>
              <tbody>
                {batchData.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors align-top">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-slate-900">{row.jobName || '—'}</p>
                      <p className="text-xs text-slate-500">{row.jobId} {row.lineName ? `· ${row.lineName}` : ''}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.stageName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.operatorName || '—'}</td>
                    <td className="px-6 py-4 text-center text-sm font-semibold text-slate-800">#{row.batchNumber}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(row.quantityData).map(([metric, value]) => (
                          <span key={metric} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                            {metric}: <span className="font-semibold text-slate-800">{value}</span>
                          </span>
                        ))}
                      </div>
                      {row.notes && <p className="text-xs text-slate-500 italic mt-1.5">"{row.notes}"</p>}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-500">{new Date(row.loggedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OperatorActivityTab({ data }: { data: OperatorActivityRow[] }) {
  if (data.length === 0) {
    return <EmptyState message="No operator task assignments fall within this date range." />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Users size={20} strokeWidth={2.5} />
          <h3 className="text-base font-bold">Operator Activity</h3>
        </div>
        <p className="text-sm text-slate-300 max-w-2xl">
          Objective task-completion and fault-logging counts. This view is descriptive only — no scores, rankings, or leaderboards.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Operator</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tasks Assigned</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tasks Completed</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Avg. Actual Duration</th>
                <th className="text-center px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Faults Logged</th>
                <th className="text-right px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.operatorName} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-navy-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-navy-700">{row.operatorName.split(' ').map((n) => n[0]).join('').slice(0, 2)}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{row.operatorName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-slate-800">{row.tasksAssigned}</td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">{row.tasksCompleted}</td>
                  <td className="px-6 py-4 text-center text-sm text-slate-700">{row.avgActualDurationMinutes != null ? `${row.avgActualDurationMinutes} min` : '—'}</td>
                  <td className="px-6 py-4 text-center text-sm font-semibold text-slate-800">{row.faultsLogged}</td>
                  <td className="px-6 py-4 text-right text-sm text-slate-500">{row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function HistoricalAnalytics() {
  const [activeTab, setActiveTab] = useState<Tab>('timelines');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    const res = await api.get<AnalyticsData>('/executive/analytics', { params: { startDate, endDate } });
    setData(res.data);
    setError(null);
  }, [startDate, endDate]);

  // Initial load / date-range change — shows the loading spinner, since this
  // is a deliberate user action.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAnalytics()
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load analytics data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAnalytics]);

  // Live updates — refetch silently in the background whenever something
  // that feeds these views happens on the floor, without flashing the
  // loading state over data the executive is already looking at.
  useEffect(() => {
    const socket = connectSocket();
    const refresh = () => {
      fetchAnalytics().catch(() => {});
    };
    socket.on('stage:updated', refresh);
    socket.on('batch:logged', refresh);
    socket.on('scrap:logged', refresh);
    socket.on('fault:reported', refresh);
    socket.on('fault:resolved', refresh);
    socket.on('emergency:triggered', refresh);
    socket.on('emergency:resumed', refresh);
    return () => {
      socket.off('stage:updated', refresh);
      socket.off('batch:logged', refresh);
      socket.off('scrap:logged', refresh);
      socket.off('fault:reported', refresh);
      socket.off('fault:resolved', refresh);
      socket.off('emergency:triggered', refresh);
      socket.off('emergency:resumed', refresh);
    };
  }, [fetchAnalytics]);

  const handleExport = () => {
    if (!data) return;
    // Only the free-text-ish fields (job name, fault title, downtime
    // reason) are quoted — lineName, jobId, and the other fields below
    // aren't escaped at all. A line name or product name that ever
    // contains a comma would silently shift every column after it in the
    // exported CSV.
    const lines = [
      'Type,Reference,Line,Date,Value,Details',
      ...data.jobHistory.map(
        (j) => `Job,${j.jobId},${j.lineName},${j.scheduledStartAt || ''},${j.targetQuantity} ${j.unit} target,"${j.name} (${j.status})"`
      ),
      ...data.faultRecords.map(
        (f) => `Fault,${f.jobId || ''},${f.lineName || ''},${f.loggedAt},${f.severity},"${f.title}"`
      ),
      ...data.downtimeRecords.map(
        (d) => `Downtime,${d.jobId || ''},${d.lineName || ''},${d.startedAt},${d.durationMinutes ?? ''} min,"${d.reason}"`
      ),
      ...data.scrapRecords.map(
        (s) => `Scrap,${s.jobId || ''},${s.lineName || ''},${s.loggedAt},${s.quantity} ${s.unit},"${s.wasteType}"`
      ),
      ...data.batchLogs.map((b) => {
        const metrics = Object.entries(b.quantityData).map(([k, v]) => `${k}: ${v}`).join('; ');
        return `Batch,${b.jobId || ''},${b.lineName || ''},${b.loggedAt},Batch #${b.batchNumber},"${b.stageName || ''} — ${metrics}"`;
      }),
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-analytics-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (!data) return;

    const doc = new jsPDF({ orientation: 'landscape' });
    // Starts below the title + range lines drawn just under, so the first
    // section header doesn't land on the same baseline as "Range: ...".
    const nextY = () => (doc as any).lastAutoTable?.finalY ?? 26;

    doc.setFontSize(16);
    doc.text('Production Analytics Report', 14, 14);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Range: ${startDate} to ${endDate}`, 14, 20);

    const section = (title: string, head: string[], body: (string | number)[][]) => {
      if (body.length === 0) return;
      const startY = nextY() + 10;
      doc.setFontSize(12);
      doc.setTextColor(20);
      doc.text(title, 14, startY - 4);
      autoTable(doc, {
        head: [head],
        body,
        startY,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 23, 42] },
        margin: { left: 14, right: 14 },
      });
    };

    section(
      'Job History',
      ['Job', 'Line', 'Date', 'Target', 'Status'],
      data.jobHistory.map((j) => [
        `${j.jobId} — ${j.name}`,
        j.lineName,
        j.scheduledStartAt ? new Date(j.scheduledStartAt).toLocaleString() : '',
        `${j.targetQuantity} ${j.unit}`,
        j.status,
      ])
    );

    section(
      'Faults',
      ['Job', 'Line', 'Logged At', 'Severity', 'Title'],
      data.faultRecords.map((f) => [f.jobId || '', f.lineName || '', new Date(f.loggedAt).toLocaleString(), f.severity, f.title])
    );

    section(
      'Downtime',
      ['Job', 'Line', 'Started At', 'Duration', 'Reason'],
      data.downtimeRecords.map((d) => [
        d.jobId || '',
        d.lineName || '',
        new Date(d.startedAt).toLocaleString(),
        d.durationMinutes != null ? `${d.durationMinutes} min` : '',
        d.reason,
      ])
    );

    section(
      'Scrap',
      ['Job', 'Line', 'Logged At', 'Quantity', 'Waste Type'],
      data.scrapRecords.map((s) => [s.jobId || '', s.lineName || '', new Date(s.loggedAt).toLocaleString(), `${s.quantity} ${s.unit}`, s.wasteType])
    );

    section(
      'Batch Logs',
      ['Job', 'Line', 'Logged At', 'Batch #', 'Stage'],
      data.batchLogs.map((b) => [b.jobId || '', b.lineName || '', new Date(b.loggedAt).toLocaleString(), b.batchNumber, b.stageName || ''])
    );

    section(
      'Operator Activity',
      ['Operator', 'Tasks Assigned', 'Tasks Completed', 'Avg. Actual Duration', 'Faults Logged', 'Last Active'],
      data.operatorActivity.map((row) => [
        row.operatorName,
        row.tasksAssigned,
        row.tasksCompleted,
        row.avgActualDurationMinutes != null ? `${row.avgActualDurationMinutes} min` : '—',
        row.faultsLogged,
        row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : '—',
      ])
    );

    doc.save(`production-analytics-${startDate}-to-${endDate}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Historical Data Analytics</h2>
        <p className="text-base text-slate-500 mt-1">Job history, downtime, faults, and operator activity across every line.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white rounded-xl border border-slate-200/80 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 flex-wrap">
          <Filter size={16} className="text-slate-400" strokeWidth={2.5} />
          <span className="font-medium">Filters:</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <Calendar size={16} className="text-slate-400" strokeWidth={2.5} />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-sm text-slate-700 bg-transparent outline-none" />
          </div>
          <span className="text-sm text-slate-400">to</span>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <Calendar size={16} className="text-slate-400" strokeWidth={2.5} />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-sm text-slate-700 bg-transparent outline-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={loading || !data}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold transition-all active:scale-[0.98]"
          >
            <Download size={18} strokeWidth={2.5} />
            Export to CSV
          </button>
          <button
            onClick={handleExportPdf}
            disabled={loading || !data}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-navy-900 hover:bg-navy-50 disabled:bg-slate-100 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed text-navy-900 text-sm font-bold transition-all active:scale-[0.98]"
          >
            <Download size={18} strokeWidth={2.5} />
            Export to PDF
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex gap-1 -mb-px">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-navy-700 border border-b-white border-slate-200 -mb-px'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-50 rounded-b-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
            <Loader2 size={28} className="text-navy-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200 text-center">
            <AlertCircle size={32} className="text-danger-600 mb-3" strokeWidth={2.5} />
            <p className="text-base font-semibold text-slate-900">Failed to Load Data</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : data ? (
          <Fragment>
            {activeTab === 'timelines' && <JobTimelinesTab data={data.jobHistory} />}
            {activeTab === 'downtime' && <DowntimeFaultsTab downtime={data.downtimeRecords} faults={data.faultRecords} />}
            {activeTab === 'scrap' && <ScrapTrackingTab scrapData={data.scrapRecords} batchData={data.batchLogs} />}
            {activeTab === 'operators' && <OperatorActivityTab data={data.operatorActivity} />}
          </Fragment>
        ) : null}
      </div>
    </div>
  );
}
