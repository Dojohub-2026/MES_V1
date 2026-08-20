import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings,
  Circle,
  Loader2,
  Pause,
  AlertOctagon,
  ChevronRight,
  MapPin,
  Clock,
  CalendarClock,
  Package,
  AlertTriangle,
  X,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { api } from '../../../shared/lib/api';
import { connectSocket } from '../../../shared/lib/socket';
import { useAuth } from '../../../contexts/AuthContext';
import type { AssignmentStage, ResolvedFeedback, StageStatus } from '../types';

const statusConfig: Record<
  StageStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  AVAILABLE: {
    label: 'AVAILABLE',
    bg: 'bg-info-100',
    text: 'text-info-800',
    border: 'border-info-300',
    icon: <Circle size={22} className="fill-info-500 text-info-500" strokeWidth={2.5} />,
  },
  RUNNING: {
    label: 'RUNNING',
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    border: 'border-cyan-400',
    icon: <Loader2 size={22} className="text-cyan-600 animate-spin" strokeWidth={2.5} />,
  },
  PAUSED: {
    label: 'PAUSED BY OPERATOR',
    bg: 'bg-warning-100',
    text: 'text-warning-800',
    border: 'border-warning-400',
    icon: <Pause size={22} className="text-warning-700" strokeWidth={2.5} />,
  },
  COMPLETED: {
    label: 'COMPLETED',
    bg: 'bg-success-100',
    text: 'text-success-800',
    border: 'border-success-300',
    icon: <Circle size={22} className="fill-success-500 text-success-500" strokeWidth={2.5} />,
  },
  PENDING: {
    label: 'PENDING',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
    icon: <Circle size={22} className="text-slate-400" strokeWidth={2.5} />,
  },
};

const emergencyStopConfig = {
  label: 'PAUSED BY EMERGENCY STOP',
  bg: 'bg-danger-100',
  text: 'text-danger-800',
  border: 'border-danger-400',
  icon: <AlertOctagon size={22} className="text-danger-600" strokeWidth={2.5} />,
};

function ProcessCard({ stage, onSelect }: { stage: AssignmentStage; onSelect: () => void }) {
  const isEmergencyStop = stage.status === 'PAUSED' && stage.jobStatus === 'PAUSED';
  const config = isEmergencyStop ? emergencyStopConfig : statusConfig[stage.status];

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-2xl border-2 ${
        isEmergencyStop ? 'border-danger-300' : 'border-slate-200'
      } shadow-sm active:scale-[0.98] transition-transform duration-150 overflow-hidden`}
    >
      {isEmergencyStop && (
        <div className="bg-danger-500 text-white text-center py-1.5 text-sm font-bold tracking-wide animate-pulse">
          GLOBAL MANAGER FREEZE ACTIVE
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Package size={20} className="text-navy-600 flex-shrink-0" strokeWidth={2.5} />
          <span className="text-base font-bold text-navy-900">{stage.jobId}</span>
          {stage.productName && (
            <>
              <span className="text-base text-slate-400">·</span>
              <span className="text-base text-slate-600 truncate">{stage.productName}</span>
            </>
          )}
        </div>
        <h3 className="text-xl font-bold text-slate-900 leading-tight mb-1">{stage.stageName}</h3>
        <p className="text-base text-slate-500 mb-4">{stage.jobName}</p>
        <div className="flex items-center gap-4 mb-4 text-base text-slate-600">
          {stage.stationTag && (
            <span className="flex items-center gap-1.5">
              <MapPin size={18} className="text-slate-400" strokeWidth={2.5} />
              {stage.stationTag}
            </span>
          )}
          {stage.estimatedDurationMinutes > 0 && (
            <span className="flex items-center gap-1.5">
              <Clock size={18} className="text-slate-400" strokeWidth={2.5} />
              ~{stage.estimatedDurationMinutes} min
            </span>
          )}
          {stage.scheduledStartAt && (
            <span className="flex items-center gap-1.5">
              <CalendarClock size={18} className="text-slate-400" strokeWidth={2.5} />
              {new Date(stage.scheduledStartAt).toLocaleString()}
            </span>
          )}
        </div>
        <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 ${config.bg} ${config.border}`}>
          <div className="flex items-center gap-2.5">
            {config.icon}
            <span className={`text-base font-bold tracking-wide ${config.text}`}>{config.label}</span>
          </div>
          <ChevronRight size={24} className={config.text} strokeWidth={2.5} />
        </div>
      </div>
    </button>
  );
}

function SettingsSheet({ isOpen, onClose, onSignOut }: { isOpen: boolean; onClose: () => void; onSignOut: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">Settings</h2>
          <button
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200"
          >
            <X size={24} className="text-slate-600" strokeWidth={2.5} />
          </button>
        </div>
        <div className="space-y-3">
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-between px-4 py-4 rounded-xl bg-danger-50 active:bg-danger-100 text-base font-medium text-danger-700"
          >
            Sign Out
            <ChevronRight size={20} className="text-danger-400" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function OperatorHome() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stages, setStages] = useState<AssignmentStage[]>([]);
  const [feedback, setFeedback] = useState<ResolvedFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAllFeedback, setShowAllFeedback] = useState(false);

  const loadAssignments = useCallback(async () => {
    try {
      const { data } = await api.get('/operator/assignments');
      setStages(data.stages);
      setFeedback(data.feedback ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
    const socket = connectSocket();
    const refresh = () => loadAssignments();
    socket.on('emergency:triggered', refresh);
    socket.on('emergency:resumed', refresh);
    socket.on('fault:resolved', refresh);

    // Safety net only — the socket is the primary channel. Keeps the
    // console working if the connection drops (per the "failure isolation"
    // principle: REST still works even when the socket doesn't).
    const interval = setInterval(loadAssignments, 60000);

    return () => {
      socket.off('emergency:triggered', refresh);
      socket.off('emergency:resumed', refresh);
      socket.off('fault:resolved', refresh);
      clearInterval(interval);
    };
  }, [loadAssignments]);

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-slate-200">
            <img src="/dojohub_icon.png" alt="Dojo Hub Uganda logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-navy-900 leading-tight">Dojo Hub</span>
            <span className="text-xs text-slate-500 leading-tight">{user?.name}</span>
          </div>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
        >
          <Settings size={22} className="text-slate-700" strokeWidth={2.5} />
        </button>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">My Assignments</h1>
          <span className="text-base text-slate-500">{stages.length} active</span>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={32} className="text-navy-500 animate-spin" />
            <p className="text-base text-slate-500 mt-3">Loading assignments...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-danger-600" strokeWidth={2.5} />
            </div>
            <p className="text-lg font-bold text-slate-900 mb-1">Connection Error</p>
            <p className="text-base text-slate-500">{error}</p>
          </div>
        )}

        {!loading && !error && stages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Package size={32} className="text-slate-400" strokeWidth={2} />
            </div>
            <p className="text-lg font-bold text-slate-900 mb-1">No Active Assignments</p>
            <p className="text-base text-slate-500">
              Waiting for manager to assign a job. This screen updates automatically.
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          stages.map((stage) => (
            <ProcessCard key={stage.id} stage={stage} onSelect={() => navigate(`/operator/stage/${stage.id}`)} />
          ))}

        {!loading && !error && feedback.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3 px-1">
              <MessageSquare size={16} className="text-navy-600" strokeWidth={2.5} />
              <h3 className="text-sm font-bold text-slate-800">Manager Feedback</h3>
            </div>
            <div className="space-y-2">
              {(showAllFeedback ? feedback : feedback.slice(0, 3)).map((f) => (
                <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-success-500 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        {f.faultTitle}
                        {f.stageName ? ` — ${f.stageName}` : ''}
                      </p>
                      {f.jobName && <p className="text-xs text-slate-500 mt-0.5">{f.jobName}</p>}
                      <div className="mt-2 bg-navy-50 rounded-lg px-2.5 py-2">
                        <p className="text-[11px] font-medium text-navy-600 mb-0.5">{f.resolvedByName}:</p>
                        <p className="text-xs text-slate-700">{f.resolutionNotes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {feedback.length > 3 && (
              <button
                onClick={() => setShowAllFeedback((v) => !v)}
                className="mt-2 text-xs font-semibold text-navy-600 hover:text-navy-700"
              >
                {showAllFeedback ? 'Show less' : `View all ${feedback.length}`}
              </button>
            )}
          </div>
        )}
      </main>

      <SettingsSheet isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onSignOut={handleSignOut} />
    </div>
  );
}
/* Fixing an error      */