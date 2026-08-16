import { useCallback, useEffect, useState } from 'react';
import {
  Briefcase, Package, User, Wrench, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, PlayCircle, PauseCircle, FileEdit, XCircle,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { formatDate } from '../../../shared/lib/formatters';
import { connectSocket } from '../../../shared/lib/socket';

interface JobStage {
  id: string;
  stageOrder: number;
  stageName: string;
  status: 'PENDING' | 'AVAILABLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED';
  stationTag: string | null;
  estimatedDurationMinutes: number;
  operatorName: string | null;
}

interface Job {
  id: string;
  jobId: string;
  name: string;
  productName: string | null;
  targetQuantity: number;
  unit: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  line: { id: string; lineCode: string; name: string; managerName: string | null } | null;
  stages: JobStage[];
  openFaultCount: number;
  criticalFaultCount: number;
}

const statusConfig: Record<Job['status'], { label: string; badge: string; icon: React.ReactNode }> = {
  DRAFT: { label: 'Draft', badge: 'bg-slate-100 text-slate-600 border-slate-200', icon: <FileEdit size={12} strokeWidth={2.5} /> },
  ACTIVE: { label: 'Active', badge: 'bg-success-100 text-success-700 border-success-200', icon: <PlayCircle size={12} strokeWidth={2.5} /> },
  PAUSED: { label: 'Paused', badge: 'bg-warning-100 text-warning-700 border-warning-200', icon: <PauseCircle size={12} strokeWidth={2.5} /> },
  COMPLETED: { label: 'Completed', badge: 'bg-navy-100 text-navy-700 border-navy-200', icon: <CheckCircle2 size={12} strokeWidth={2.5} /> },
  CANCELLED: { label: 'Cancelled', badge: 'bg-danger-100 text-danger-700 border-danger-200', icon: <XCircle size={12} strokeWidth={2.5} /> },
};

function StatCard({ icon, value, label, accent }: { icon: React.ReactNode; value: number; label: string; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/50 shadow-card p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[job.status];
  const completedStages = job.stages.filter((s) => s.status === 'COMPLETED').length;
  const totalStages = job.stages.length;
  const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/50 shadow-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Package size={15} className="text-navy-500 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{job.jobId}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                {cfg.icon}
                {cfg.label}
              </span>
              {job.criticalFaultCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-danger-100 text-danger-700 border-danger-200">
                  <AlertTriangle size={11} strokeWidth={2.5} />
                  {job.criticalFaultCount} critical
                </span>
              )}
              {job.openFaultCount > 0 && job.criticalFaultCount === 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-warning-100 text-warning-700 border-warning-200">
                  <AlertTriangle size={11} strokeWidth={2.5} />
                  {job.openFaultCount} open
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-900 mt-1.5 truncate">{job.name}</p>
            {job.productName && <p className="text-xs text-slate-500 mt-0.5">{job.productName} · {job.targetQuantity.toLocaleString()} {job.unit}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3 flex-wrap">
          {job.line && (
            <span className="flex items-center gap-1.5">
              <Wrench size={12} strokeWidth={2.5} />
              {job.line.lineCode} — {job.line.name}
            </span>
          )}
          {job.line?.managerName && (
            <span className="flex items-center gap-1.5">
              <User size={12} strokeWidth={2.5} />
              {job.line.managerName}
            </span>
          )}
          {job.scheduledStartAt && (
            <span className="flex items-center gap-1.5">
              <Clock size={12} strokeWidth={2.5} />
              {formatDate(job.scheduledStartAt)}
            </span>
          )}
        </div>

        {totalStages > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
              <span>{completedStages} of {totalStages} stages complete</span>
              <span className="font-semibold">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-navy-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-semibold text-navy-600 hover:text-navy-700"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide stage pipeline' : `View stage pipeline (${totalStages})`}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {job.stages.map((stage) => (
            <div key={stage.id} className="flex items-center gap-3 px-5 py-2.5">
              <span className="text-xs font-bold text-slate-300 w-5 flex-shrink-0">{stage.stageOrder + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{stage.stageName}</p>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  {stage.operatorName ? (
                    <>
                      <User size={11} />
                      {stage.operatorName}
                    </>
                  ) : (
                    'Unassigned'
                  )}
                  {stage.stationTag && (
                    <>
                      <span className="text-slate-300">·</span>
                      {stage.stationTag}
                    </>
                  )}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                stage.status === 'COMPLETED' ? 'bg-success-100 text-success-700 border-success-200'
                : stage.status === 'RUNNING' ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                : stage.status === 'PAUSED' ? 'bg-warning-100 text-warning-700 border-warning-200'
                : stage.status === 'AVAILABLE' ? 'bg-info-100 text-info-700 border-info-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {stage.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActiveJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | Job['status']>('all');

  const loadJobs = useCallback(() => {
    return api.get<{ jobs: Job[] }>('/executive/jobs')
      .then((res) => {
        setJobs(res.data.jobs);
        setError(null);
      })
      .catch((err) => setError(err?.response?.data?.message || 'Failed to load jobs.'));
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Live updates — this page previously only ever showed a snapshot from
  // page load; it never refreshed on its own. Refetch silently in the
  // background whenever something that changes a job's state happens on
  // the floor, without flashing the loading state over data already on
  // screen.
  useEffect(() => {
    const socket = connectSocket();
    const refresh = () => {
      loadJobs().catch(() => {});
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
  }, [loadJobs]);

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700">
        <AlertTriangle size={20} strokeWidth={2.5} />{error}
      </div>
    );
  }

  if (!jobs) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 size={28} className="animate-spin" strokeWidth={2.5} />
      </div>
    );
  }

  const counts = {
    ACTIVE: jobs.filter((j) => j.status === 'ACTIVE').length,
    DRAFT: jobs.filter((j) => j.status === 'DRAFT').length,
    PAUSED: jobs.filter((j) => j.status === 'PAUSED').length,
    COMPLETED: jobs.filter((j) => j.status === 'COMPLETED').length,
    CANCELLED: jobs.filter((j) => j.status === 'CANCELLED').length,
  };

  const filtered = statusFilter === 'all' ? jobs : jobs.filter((j) => j.status === statusFilter);

  const tabs: { key: 'all' | Job['status']; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'DRAFT', label: 'Draft' },
    { key: 'PAUSED', label: 'Paused' },
    { key: 'COMPLETED', label: 'Completed' },
    { key: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Active Jobs</h2>
        <p className="text-base text-slate-500 mt-1">Plant-wide visibility into every production job across all lines.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<PlayCircle size={20} className="text-success-700" strokeWidth={2.5} />} value={counts.ACTIVE} label="Active" accent="bg-success-100" />
        <StatCard icon={<FileEdit size={20} className="text-slate-700" strokeWidth={2.5} />} value={counts.DRAFT} label="Draft" accent="bg-slate-100" />
        <StatCard icon={<PauseCircle size={20} className="text-warning-700" strokeWidth={2.5} />} value={counts.PAUSED} label="Paused" accent="bg-warning-100" />
        <StatCard icon={<CheckCircle2 size={20} className="text-navy-700" strokeWidth={2.5} />} value={counts.COMPLETED} label="Completed" accent="bg-navy-100" />
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === tab.key ? 'bg-navy-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-2xl border border-slate-200/50">
          <Briefcase size={48} className="text-slate-300 mb-4" />
          <h3 className="font-medium text-slate-600 mb-2">
            {jobs.length === 0 ? 'No jobs created yet' : 'No jobs match this filter'}
          </h3>
          <p className="text-sm text-slate-400 max-w-sm">
            {jobs.length === 0
              ? 'Once a manager builds and activates a production run in Job Builder, it will appear here in real time.'
              : 'Try a different status filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
