import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  Activity,
  Package,
  AlertTriangle,
  Loader2,
  Layers,
  CheckCircle2,
  Clock,
  FileEdit,
  ArrowRight,
  Send,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { connectSocket } from '../../../shared/lib/socket';
import { ProductionDataPreviewModal } from '../components/ProductionDataPreviewModal';

interface AssignedLine {
  id: string;
  lineCode: string;
  name: string;
  description: string | null;
  targetProduct: string | null;
  targetQuantity: number | null;
  unit: string | null;
  isActive: boolean;
}

interface MetricsData {
  assignedLineCount: number;
  activeJobCount: number;
  unresolvedFaultCount: number;
}

interface JobStage {
  id: string;
  stageOrder: number;
  stageName: string;
  status: 'PENDING' | 'AVAILABLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  stationTag: string | null;
  estimatedDurationMinutes: number;
  operatorName: string | null;
}

interface ActiveJob {
  id: string;
  jobId: string;
  name: string;
  productName: string | null;
  stages: JobStage[];
}

interface DraftJob {
  id: string;
  jobId: string;
  name: string;
  productName: string | null;
  source: 'MANUAL' | 'ERP';
  batchNumber: string | null;
  lineId: string | null;
  stages: JobStage[];
}

interface CompletedJob {
  id: string;
  jobId: string;
  name: string;
  productName: string | null;
  source: 'MANUAL' | 'ERP';
  batchNumber: string | null;
}

interface Alert {
  id: string;
  title: string;
  description: string | null;
  severity: 'MINOR' | 'CRITICAL';
  jobId: string;
  jobName: string;
  operatorName: string | null;
  loggedAt: string;
}

const STAGE_STYLES: Record<JobStage['status'], string> = {
  PENDING: 'bg-slate-100 text-slate-500 border-slate-200',
  AVAILABLE: 'bg-info-100 text-info-700 border-info-200',
  RUNNING: 'bg-navy-100 text-navy-700 border-navy-200',
  PAUSED: 'bg-warning-100 text-warning-700 border-warning-200',
  COMPLETED: 'bg-success-100 text-success-700 border-success-200',
};

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function LineCard({ line, onBuildJob }: { line: AssignedLine; onBuildJob: () => void }) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:border-navy-300 hover:bg-navy-50/30 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-navy-700">{line.lineCode}</span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
            line.isActive ? 'bg-success-100 text-success-700 border-success-200' : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {line.isActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-900">{line.name}</p>
      <p className="text-xs text-slate-500 mt-1">
        {line.targetProduct || 'No product set'}
        {line.targetQuantity ? ` · ${line.targetQuantity.toLocaleString()} ${line.unit ?? ''}` : ''}
      </p>
      <button
        onClick={onBuildJob}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold transition-all active:scale-[0.98]"
      >
        Build Job
      </button>
    </div>
  );
}

export function Operations() {
  const navigate = useNavigate();
  const [lines, setLines] = useState<AssignedLine[] | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [jobs, setJobs] = useState<ActiveJob[] | null>(null);
  const [draftJobs, setDraftJobs] = useState<DraftJob[] | null>(null);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<Record<string, { ok: boolean; message: string } | undefined>>({});
  const [previewJob, setPreviewJob] = useState<{ id: string; name: string } | null>(null);

  // Draft jobs include ones with no line yet (e.g. an unmatched ERP work
  // order) — the backend shows those to every manager. Active/completed
  // jobs are strictly scoped to lines this manager actually owns.
  const loadAll = useCallback(() => {
    return Promise.all([
      api.get<{ lines: AssignedLine[] }>('/manager/lines'),
      api.get<MetricsData>('/manager/metrics'),
      api.get<{ jobs: ActiveJob[] }>('/manager/jobs'),
      api.get<{ jobs: DraftJob[] }>('/manager/jobs?status=DRAFT'),
      api.get<{ jobs: CompletedJob[] }>('/manager/jobs?status=COMPLETED'),
      api.get<{ alerts: Alert[] }>('/manager/alerts'),
    ])
      .then(([linesRes, metricsRes, jobsRes, draftJobsRes, completedJobsRes, alertsRes]) => {
        setLines(linesRes.data.lines);
        setMetrics(metricsRes.data);
        setJobs(jobsRes.data.jobs);
        setDraftJobs(draftJobsRes.data.jobs);
        setCompletedJobs(completedJobsRes.data.jobs);
        setAlerts(alertsRes.data.alerts);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Failed to load your operations data.');
      });
  }, []);

  const handleSendToErp = async (jobId: string) => {
    setSendingId(jobId);
    setSendResult((prev) => ({ ...prev, [jobId]: undefined }));
    try {
      const res = await api.post<{ message: string }>(`/manager/jobs/${jobId}/send-to-erp`);
      setSendResult((prev) => ({ ...prev, [jobId]: { ok: true, message: res.data.message } }));
    } catch (err: any) {
      setSendResult((prev) => ({
        ...prev,
        [jobId]: { ok: false, message: err?.response?.data?.message || 'Failed to send production data to ERP.' },
      }));
    } finally {
      // Closes the preview modal either way — success or failure both drop
      // back to the card, where sendResult renders the outcome inline.
      setSendingId(null);
      setPreviewJob(null);
    }
  };

  useEffect(() => {
    loadAll();

    const socket = connectSocket();
    const refresh = () => loadAll();
    socket.on('stage:updated', refresh);
    socket.on('batch:logged', refresh);
    socket.on('fault:reported', refresh);
    socket.on('emergency:triggered', refresh);
    socket.on('emergency:resumed', refresh);

    return () => {
      socket.off('stage:updated', refresh);
      socket.off('batch:logged', refresh);
      socket.off('fault:reported', refresh);
      socket.off('emergency:triggered', refresh);
      socket.off('emergency:resumed', refresh);
    };
  }, [loadAll]);

  const handleDismiss = async (id: string) => {
    setDismissingId(id);
    try {
      await api.patch(`/manager/faults/${id}/resolve`);
      setAlerts((prev) => prev?.filter((a) => a.id !== id) ?? null);
      setMetrics((prev) => (prev ? { ...prev, unresolvedFaultCount: Math.max(0, prev.unresolvedFaultCount - 1) } : prev));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to dismiss alert.');
    } finally {
      setDismissingId(null);
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700">
        <AlertTriangle size={20} strokeWidth={2.5} />
        {error}
      </div>
    );
  }

  if (!lines || !metrics || !jobs || !draftJobs || !completedJobs || !alerts) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={28} className="animate-spin" strokeWidth={2.5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/50 shadow-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <Factory size={20} className="text-navy-600" strokeWidth={2.5} />
            <h3 className="font-bold text-slate-900">Your Assigned Production Lines</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Select a line to build a production job and orchestrate process workflows.</p>

          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package size={36} className="text-slate-300 mb-3" strokeWidth={2} />
              <p className="text-sm font-semibold text-slate-700">No Lines Assigned</p>
              <p className="text-xs text-slate-500 mt-1">Ask an executive to assign a production line to your account.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {lines.map((line) => (
                <LineCard key={line.id} line={line} onBuildJob={() => navigate('/manager/job-builder')} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/50 shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={20} className="text-navy-600" strokeWidth={2.5} />
            <h3 className="font-bold text-slate-900">Manager Metrics</h3>
          </div>
          <div className="space-y-3">
            <MetricRow label="Your Assigned Lines" value={metrics.assignedLineCount} />
            <MetricRow label="Active Production Jobs" value={metrics.activeJobCount} />
            <MetricRow label="Unresolved Faults" value={metrics.unresolvedFaultCount} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/50 shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers size={20} className="text-navy-600" strokeWidth={2.5} />
              <h3 className="font-bold text-slate-900">Live Job Monitor</h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {jobs.length} active job{jobs.length === 1 ? '' : 's'}
            </span>
          </div>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={36} className="text-success-500 mb-3" strokeWidth={2} />
              <p className="text-sm font-semibold text-slate-700">No Active Jobs</p>
              <p className="text-xs text-slate-500 mt-1">Build a job from one of your assigned lines to see it here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2 text-sm">
                      <Package size={14} className="text-slate-400" />
                      <span className="font-mono text-xs text-slate-500">{job.jobId}</span>
                      <span className="font-semibold text-slate-900">{job.name}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {job.stages.filter((s) => s.status === 'COMPLETED').length} / {job.stages.length} stages
                    </span>
                  </div>
                  {job.stages.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400 italic">No process stages built for this job yet.</p>
                  ) : (
                    job.stages.map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STAGE_STYLES[stage.status]}`}>
                            {stage.status}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{stage.stageName}</p>
                            <p className="text-xs text-slate-400">
                              {stage.operatorName ?? 'Unassigned'}
                              {stage.stationTag ? ` · ${stage.stationTag}` : ''}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">~{stage.estimatedDurationMinutes} min</span>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/50 shadow-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={20} className="text-warning-600" strokeWidth={2.5} />
            <h3 className="font-bold text-slate-900">Live Manager Alerts</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Unresolved faults, sorted newest first.</p>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 size={36} className="text-success-500 mb-3" strokeWidth={2} />
              <p className="text-sm font-semibold text-slate-700">All Clear</p>
              <p className="text-xs text-slate-500 mt-1">No unresolved faults right now.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border ${
                    alert.severity === 'CRITICAL' ? 'bg-danger-50 border-danger-200' : 'bg-warning-50 border-warning-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                      {alert.description && <p className="text-xs text-slate-500 mt-0.5">{alert.description}</p>}
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(alert.loggedAt).toLocaleTimeString()} · {alert.jobId}
                        {alert.operatorName ? ` · ${alert.operatorName}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      disabled={dismissingId === alert.id}
                      className="text-xs font-semibold text-navy-600 hover:text-navy-700 underline underline-offset-2 disabled:opacity-50 flex-shrink-0"
                    >
                      {dismissingId === alert.id ? 'Dismissing…' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/50 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileEdit size={20} className="text-navy-600" strokeWidth={2.5} />
            <h3 className="font-bold text-slate-900">Draft Jobs</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {draftJobs.length} draft{draftJobs.length === 1 ? '' : 's'}
          </span>
        </div>

        {draftJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileEdit size={36} className="text-slate-300 mb-3" strokeWidth={2} />
            <p className="text-sm font-semibold text-slate-700">No Draft Jobs</p>
            <p className="text-xs text-slate-500 mt-1">Jobs saved as drafts, or received from the ERP, appear here to finish building.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {draftJobs.map((job) => (
              <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-xs text-slate-500">{job.jobId}</span>
                  {job.source === 'ERP' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-100 text-info-700">ERP</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
                {job.batchNumber && <p className="text-xs text-slate-500 mt-0.5">Batch {job.batchNumber}</p>}
                <p className="text-xs text-slate-400 mt-1">{job.stages.length} stage{job.stages.length === 1 ? '' : 's'} built</p>
                {!job.lineId && (
                  <p className="text-xs text-warning-600 mt-1 font-medium">No production line assigned yet</p>
                )}
                <button
                  onClick={() => navigate(`/manager/job-builder?jobId=${job.id}`)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold transition-all active:scale-[0.98]"
                >
                  Continue in Job Builder
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/50 shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Send size={20} className="text-navy-600" strokeWidth={2.5} />
            <h3 className="font-bold text-slate-900">Completed Jobs — ERP Delivery</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {completedJobs.length} completed
          </span>
        </div>

        {completedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CheckCircle2 size={36} className="text-slate-300 mb-3" strokeWidth={2} />
            <p className="text-sm font-semibold text-slate-700">No Completed Jobs Yet</p>
            <p className="text-xs text-slate-500 mt-1">Once a job finishes, ERP-sourced jobs can have their production data sent here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completedJobs.map((job) => {
              const result = sendResult[job.id];
              return (
                <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-slate-500">{job.jobId}</span>
                    {job.source === 'ERP' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-info-100 text-info-700">ERP</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">{job.name}</p>
                  {job.batchNumber && <p className="text-xs text-slate-500 mt-0.5">Batch {job.batchNumber}</p>}

                  {job.source !== 'ERP' ? (
                    <p className="text-xs text-slate-400 mt-3 italic">Not an ERP work order — nothing to report back.</p>
                  ) : (
                    <>
                      <button
                        onClick={() => setPreviewJob({ id: job.id, name: job.name })}
                        disabled={sendingId === job.id}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {sendingId === job.id ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            Preview & Send to ERP
                            <Send size={14} />
                          </>
                        )}
                      </button>
                      {result && (
                        <p className={`text-xs mt-2 font-medium ${result.ok ? 'text-success-600' : 'text-danger-600'}`}>
                          {result.message}
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewJob && (
        <ProductionDataPreviewModal
          jobId={previewJob.id}
          jobName={previewJob.name}
          onClose={() => setPreviewJob(null)}
          onSend={() => handleSendToErp(previewJob.id)}
          sending={sendingId === previewJob.id}
        />
      )}
    </div>
  );
}
