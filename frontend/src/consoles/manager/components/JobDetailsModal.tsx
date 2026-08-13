import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Clock3,
  Layers,
  Loader2,
  FileText,
  Factory,
  Wrench,
  ScrollText,
  ShieldAlert,
  X,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { formatDate, formatRelativeTime } from '../../../shared/lib/formatters';

type JobStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

type StageStatus = 'PENDING' | 'AVAILABLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';

interface JobDetails {
  id: string;
  jobId: string;
  name: string;
  productName: string | null;
  targetQuantity: number;
  unit: string;
  status: JobStatus;
  source: 'MANUAL' | 'ERP';
  notes: string | null;
  targetDate: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  batchNumber: string | null;
  externalWorkOrderId: string | null;
  actualProducedQty: number | null;
  actualScrapQty: number | null;
  createdAt: string;
  updatedAt: string;
  line: {
    id: string;
    lineCode: string;
    name: string;
    description: string | null;
    isActive: boolean;
    targetProduct: string | null;
    targetQuantity: number | null;
    unit: string | null;
    managerId: string | null;
    manager: { id: string; name: string; identifier: string } | null;
  } | null;
  stages: Array<{
    id: string;
    stageOrder: number;
    stageName: string;
    instruction: string | null;
    requiresQc: boolean;
    estimatedDurationMinutes: number;
    stationTag: string | null;
    status: StageStatus;
    notes: string | null;
    operator: { id: string; name: string; identifier: string } | null;
    blueprint: { id: string; name: string; category: string; skillCategory: string | null; stationTag: string | null } | null;
    scheduledStartAt: string | null;
    scheduledEndAt: string | null;
    actualStartedAt: string | null;
    actualEndedAt: string | null;
    qcResponses: Array<{
      id: string;
      loggedAt: string;
      passed: boolean | null;
      responseText: string | null;
      question: { id: string; questionText: string; responseType: string };
    }>;
    scrapLogs: Array<{
      id: string;
      quantity: number;
      unit: string;
      wasteType: string;
      notes: string | null;
      loggedAt: string;
    }>;
    faults: Array<{
      id: string;
      title: string;
      description: string | null;
      severity: 'CRITICAL' | 'MINOR';
      category: string | null;
      resolvedAt: string | null;
      resolvedBy: string | null;
      resolutionNotes: string | null;
      loggedAt: string;
      operator: { id: string; name: string } | null;
    }>;
  }>;
  materialRequirements: Array<{
    id: string;
    name: string;
    qtyPerUnit: number;
    unit: string;
    totalRequired: number;
    wastagePct: number | null;
    sortOrder: number;
  }>;
  downtimeLogs: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    reason: string;
    category: string | null;
    stageid: string | null;
  }>;
  scrapLogs: Array<{
    id: string;
    quantity: number;
    unit: string;
    wasteType: string;
    notes: string | null;
    loggedAt: string;
    stage: { id: string; stageName: string; stageOrder: number } | null;
  }>;
  faults: Array<{
    id: string;
    title: string;
    description: string | null;
    severity: 'CRITICAL' | 'MINOR';
    category: string | null;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNotes: string | null;
    loggedAt: string;
    operator: { id: string; name: string } | null;
    stage: { id: string; stageName: string; stageOrder: number } | null;
  }>;
}

interface JobDetailsModalProps {
  jobId: string;
  jobName: string;
  onClose: () => void;
  embedded?: boolean;
}

const STATUS_STYLE: Record<JobStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  ACTIVE: 'bg-success-100 text-success-700 border-success-200',
  PAUSED: 'bg-warning-100 text-warning-700 border-warning-200',
  COMPLETED: 'bg-info-100 text-info-700 border-info-200',
  CANCELLED: 'bg-danger-100 text-danger-700 border-danger-200',
};

const STAGE_STYLE: Record<StageStatus, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-200',
  AVAILABLE: 'bg-info-100 text-info-700 border-info-200',
  RUNNING: 'bg-navy-100 text-navy-700 border-navy-200',
  PAUSED: 'bg-warning-100 text-warning-700 border-warning-200',
  COMPLETED: 'bg-success-100 text-success-700 border-success-200',
};

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {count !== undefined && <span className="text-xs text-slate-400">({count})</span>}
      </div>
      {children}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 break-words">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">{children}</p>;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function JobDetailsModal({ jobId, jobName, onClose, embedded = false }: JobDetailsModalProps) {
  const [job, setJob] = useState<JobDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setJob(null);
    setError(null);

    api
      .get<JobDetails>(`/manager/jobs/${jobId}`)
      .then((res) => {
        if (!cancelled) setJob(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Failed to load job details.');
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const shell = (
    <div
      className={
        embedded
          ? 'w-full bg-slate-50 rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col'
          : 'relative w-full max-w-5xl bg-white rounded-card shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col'
      }
    >
      <div className="px-6 py-4 bg-navy-950 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Live Job Review</p>
              <h2 className="text-lg font-bold text-white truncate">{job?.name ?? jobName}</h2>
              <p className="text-slate-400 text-xs mt-0.5 font-mono">{job?.jobId ?? jobId}</p>
              {job && (
                <span className={`mt-3 inline-flex text-[10px] font-bold px-2.5 py-1 rounded-full border ${STATUS_STYLE[job.status]}`}>
                  {job.status}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

      <div className={embedded ? 'p-6 space-y-6' : 'flex-1 overflow-y-auto p-6 space-y-6'}>
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm">
              <AlertTriangle size={18} strokeWidth={2.5} />
              {error}
            </div>
          )}

          {!job && !error && (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3 text-slate-500">
                <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Loading job details</p>
                  <p className="text-xs text-slate-500">Fetching the full record for {jobName}.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-16 rounded-xl border border-slate-200 bg-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {job && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <InfoTile label="Status" value={job.status} />
                <InfoTile label="Source" value={job.source} />
                <InfoTile label="Batch" value={job.batchNumber ?? '—'} />
                <InfoTile label="External Work Order" value={job.externalWorkOrderId ?? '—'} />
                <InfoTile label="Product" value={job.productName ?? '—'} />
                <InfoTile label="Target Quantity" value={`${job.targetQuantity.toLocaleString()} ${job.unit}`} />
                <InfoTile label="Created" value={formatDateTime(job.createdAt)} />
                <InfoTile label="Updated" value={formatRelativeTime(job.updatedAt)} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Factory size={16} className="text-navy-600" />
                    <h3 className="text-sm font-bold text-slate-900">Production Line</h3>
                  </div>
                  {job.line ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <InfoTile label="Line Code" value={job.line.lineCode} />
                      <InfoTile label="Line Name" value={job.line.name} />
                      <InfoTile label="Line Status" value={job.line.isActive ? 'Active' : 'Inactive'} />
                      <InfoTile label="Line Manager" value={job.line.manager?.name ?? 'Unassigned'} />
                      <InfoTile label="Target Product" value={job.line.targetProduct ?? '—'} />
                      <InfoTile label="Target Qty / Unit" value={job.line.targetQuantity ? `${job.line.targetQuantity.toLocaleString()} ${job.line.unit ?? ''}`.trim() : '—'} />
                    </div>
                  ) : (
                    <EmptyState>This job is not assigned to a production line yet.</EmptyState>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock size={16} className="text-navy-600" />
                    <h3 className="text-sm font-bold text-slate-900">Planning</h3>
                  </div>
                  <div className="space-y-3">
                    <InfoTile label="Target Date" value={job.targetDate ? formatDate(job.targetDate) : '—'} />
                    <InfoTile label="Scheduled Start" value={formatDateTime(job.scheduledStartAt)} />
                    <InfoTile label="Scheduled End" value={formatDateTime(job.scheduledEndAt)} />
                    <InfoTile label="Started" value={formatDateTime(job.startedAt)} />
                    <InfoTile label="Completed" value={formatDateTime(job.completedAt)} />
                  </div>
                </div>
              </div>

              {job.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-navy-600" />
                    <h3 className="text-sm font-bold text-slate-900">Job Notes</h3>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{job.notes}</p>
                </div>
              )}

              <Section icon={<Layers size={16} className="text-navy-600" />} title="Process Stages" count={job.stages.length}>
                {job.stages.length === 0 ? (
                  <EmptyState>No process stages were built for this job.</EmptyState>
                ) : (
                  <div className="space-y-3">
                    {job.stages.map((stage) => (
                      <div key={stage.id} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              #{stage.stageOrder} {stage.stageName}
                            </p>
                            <p className="text-xs text-slate-400">
                              {stage.blueprint ? `${stage.blueprint.category} blueprint` : 'Ad hoc stage'}
                              {stage.stationTag ? ` · ${stage.stationTag}` : ''}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STAGE_STYLE[stage.status]}`}>{stage.status}</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-4 bg-white">
                          <div className="space-y-2">
                            <InfoTile label="Operator" value={stage.operator?.name ?? 'Unassigned'} />
                            <InfoTile label="Duration" value={`${stage.estimatedDurationMinutes} min`} />
                            <InfoTile label="Requires QC" value={stage.requiresQc ? 'Yes' : 'No'} />
                          </div>
                          <div className="space-y-2">
                            <InfoTile label="Scheduled Start" value={formatDateTime(stage.scheduledStartAt)} />
                            <InfoTile label="Scheduled End" value={formatDateTime(stage.scheduledEndAt)} />
                            <InfoTile label="Actual Start / End" value={`${formatDateTime(stage.actualStartedAt)} / ${formatDateTime(stage.actualEndedAt)}`} />
                          </div>
                          <div className="space-y-2">
                            <InfoTile label="Blueprint" value={stage.blueprint?.name ?? '—'} />
                            <InfoTile label="Skill Category" value={stage.blueprint?.skillCategory ?? '—'} />
                            <InfoTile label="Instruction" value={stage.instruction ?? '—'} />
                          </div>
                        </div>
                        {stage.notes && <div className="px-4 pb-4 text-sm text-slate-600">Notes: {stage.notes}</div>}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-slate-200 bg-slate-50">
                          <div className="p-4 border-b lg:border-b-0 lg:border-r border-slate-200">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Stage Faults</p>
                            {stage.faults.length === 0 ? (
                              <EmptyState>No faults recorded for this stage.</EmptyState>
                            ) : (
                              <div className="space-y-2">
                                {stage.faults.map((fault) => (
                                  <div key={fault.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="font-semibold text-slate-900">{fault.title}</p>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fault.severity === 'CRITICAL' ? 'bg-danger-100 text-danger-700 border-danger-200' : 'bg-warning-100 text-warning-700 border-warning-200'}`}>
                                        {fault.severity}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">{fault.description ?? 'No description provided.'}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">Logged {formatRelativeTime(fault.loggedAt)} · {fault.operator?.name ?? 'Unknown operator'}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Stage Scrap & QC</p>
                            <div className="space-y-3">
                              {stage.scrapLogs.length === 0 ? (
                                <EmptyState>No scrap logged for this stage.</EmptyState>
                              ) : (
                                <div className="space-y-2">
                                  {stage.scrapLogs.map((scrap) => (
                                    <div key={scrap.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                      <p className="font-semibold text-slate-900">{scrap.wasteType}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {scrap.quantity} {scrap.unit}
                                        {scrap.notes ? ` · ${scrap.notes}` : ''}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {stage.qcResponses.length === 0 ? (
                                <EmptyState>No QC responses recorded for this stage.</EmptyState>
                              ) : (
                                <div className="space-y-2">
                                  {stage.qcResponses.map((qc) => (
                                    <div key={qc.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                                      <p className="font-semibold text-slate-900">{qc.question.questionText}</p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {qc.passed === null ? 'Not scored' : qc.passed ? 'Pass' : 'Fail'} · {qc.responseText ?? 'No response text'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={<Wrench size={16} className="text-navy-600" />} title="Material Requirements" count={job.materialRequirements.length}>
                {job.materialRequirements.length === 0 ? (
                  <EmptyState>No material requirements were defined for this job.</EmptyState>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3 text-left">Material</th>
                          <th className="px-4 py-3 text-left">Per Unit</th>
                          <th className="px-4 py-3 text-left">Total</th>
                          <th className="px-4 py-3 text-left">Wastage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.materialRequirements.map((material) => (
                          <tr key={material.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-medium text-slate-900">{material.name}</td>
                            <td className="px-4 py-3 text-slate-500">
                              {material.qtyPerUnit} {material.unit}
                            </td>
                            <td className="px-4 py-3 text-slate-500">
                              {material.totalRequired} {material.unit}
                            </td>
                            <td className="px-4 py-3 text-slate-500">{material.wastagePct != null ? `${material.wastagePct}%` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Section icon={<Clock3 size={16} className="text-navy-600" />} title="Downtime Log" count={job.downtimeLogs.length}>
                  {job.downtimeLogs.length === 0 ? (
                    <EmptyState>No downtime has been logged against this job.</EmptyState>
                  ) : (
                    <div className="space-y-2">
                      {job.downtimeLogs.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="font-semibold text-slate-900">{entry.reason}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDateTime(entry.startedAt)} → {formatDateTime(entry.endedAt)}
                          </p>
                          {entry.category && <p className="text-xs text-slate-400 mt-1">Category: {entry.category}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                <Section icon={<ScrollText size={16} className="text-navy-600" />} title="Scrap Log" count={job.scrapLogs.length}>
                  {job.scrapLogs.length === 0 ? (
                    <EmptyState>No scrap has been logged against this job.</EmptyState>
                  ) : (
                    <div className="space-y-2">
                      {job.scrapLogs.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                          <p className="font-semibold text-slate-900">
                            {entry.wasteType}: {entry.quantity} {entry.unit}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatRelativeTime(entry.loggedAt)}{entry.stage ? ` · ${entry.stage.stageName}` : ''}
                          </p>
                          {entry.notes && <p className="text-xs text-slate-400 mt-1">{entry.notes}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>

              <Section icon={<ShieldAlert size={16} className="text-navy-600" />} title="Job Faults" count={job.faults.length}>
                {job.faults.length === 0 ? (
                  <EmptyState>No faults have been reported against this job.</EmptyState>
                ) : (
                  <div className="space-y-2">
                    {job.faults.map((fault) => (
                      <div key={fault.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-900">{fault.title}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fault.severity === 'CRITICAL' ? 'bg-danger-100 text-danger-700 border-danger-200' : 'bg-warning-100 text-warning-700 border-warning-200'}`}>
                            {fault.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {fault.description ?? 'No description provided.'}
                          {fault.stage ? ` · ${fault.stage.stageName}` : ''}
                          {fault.operator?.name ? ` · ${fault.operator.name}` : ''}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Logged {formatRelativeTime(fault.loggedAt)}
                          {fault.resolvedAt ? ` · Resolved ${formatRelativeTime(fault.resolvedAt)}` : ' · Unresolved'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>

      <div className="px-6 py-4 border-t border-slate-200 flex-shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
    </div>
  );

  if (embedded) {
    return shell;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      {shell}
    </div>
  );
}