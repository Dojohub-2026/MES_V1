import { useState, useEffect, useRef } from 'react';
import { AlertOctagon, X, Factory, Target, ChevronDown, HandMetal, Loader2 } from 'lucide-react';
import { api } from '../../../shared/lib/api';

type StopScope = 'facility_wide' | 'specific_job';

interface ActiveJob {
  id: string;
  jobId: string;
  name: string;
  line: { lineCode: string; name: string };
}

const REASONS = [
  'Equipment Malfunction',
  'Safety Hazard Detected',
  'Quality Control Failure',
  'Material Contamination',
  'Fire/Smoke Detected',
  'Personnel Injury',
  'Environmental Spill',
  'Utility Failure',
  'Other - Specify in Notes',
];

interface EmergencyStopOverlayProps {
  onClose: () => void;
  onStopped: (stoppedCount: number) => void;
}

export function EmergencyStopOverlay({ onClose, onStopped }: EmergencyStopOverlayProps) {
  const [scope, setScope] = useState<StopScope>('facility_wide');
  const [activeJobs, setActiveJobs] = useState<ActiveJob[] | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progressRef = useRef<number | null>(null);

  useEffect(() => {
    if (scope === 'specific_job' && activeJobs === null) {
      api
        .get<{ jobs: ActiveJob[] }>('/emergency-stop/active-jobs')
        .then((res) => setActiveJobs(res.data.jobs))
        .catch(() => setActiveJobs([]));
    }
  }, [scope, activeJobs]);

  useEffect(
    () => () => {
      if (progressRef.current) clearInterval(progressRef.current);
    },
    []
  );

  const canSubmit = !!reason && (scope === 'facility_wide' || !!selectedJobId);

  // Deliberate friction against an accidental trigger on a destructive
  // action: +2% every 30ms reaches 100% in exactly 1.5s, matching the
  // caption below the button. Changing either the increment or interval
  // changes how long the hold actually takes without changing what the
  // caption tells the manager to expect — keep them in sync.
  const startHold = () => {
    if (!canSubmit || submitting) return;
    setIsHolding(true);
    setHoldProgress(0);
    progressRef.current = window.setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressRef.current!);
          return 100;
        }
        return prev + 2;
      });
    }, 30);
  };

  const endHold = () => {
    setIsHolding(false);
    if (progressRef.current) clearInterval(progressRef.current);
    if (holdProgress >= 100) {
      executeStop();
    } else {
      setHoldProgress(0);
    }
  };

  const executeStop = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await api.post('/emergency-stop', {
        scope,
        jobId: scope === 'specific_job' ? selectedJobId : undefined,
        reason,
        notes: notes.trim(),
      });
      onStopped(data.stoppedCount);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to trigger emergency stop.');
      setSubmitting(false);
      setHoldProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-danger-900/80 backdrop-blur-sm animate-pulse" />
      <div className="absolute inset-4 border-4 border-danger-500 rounded-xl shadow-[0_0_60px_rgba(239,68,68,0.5)] pointer-events-none" />

      <div className="relative w-full max-w-lg bg-danger-950 rounded-card shadow-2xl overflow-hidden border-2 border-danger-600 max-h-[92vh] flex flex-col">
        <div className="px-6 py-5 bg-danger-900 border-b border-danger-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AlertOctagon size={32} className="text-danger-400 animate-pulse" />
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-wide">Emergency Stop Activation</h2>
                <p className="text-danger-300 text-sm mt-0.5">Confirm production halt parameters</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-danger-400 hover:text-white hover:bg-danger-800 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <p className="text-sm text-white bg-danger-800 border border-danger-600 rounded-lg p-3">{error}</p>
          )}

          <div>
            <label className="block text-sm font-semibold text-danger-200 uppercase tracking-wide mb-3">
              Stop Scope <span className="text-danger-400">*</span>
            </label>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  scope === 'facility_wide' ? 'border-danger-500 bg-danger-900/50' : 'border-danger-800/50 hover:border-danger-700'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'facility_wide'}
                  onChange={() => setScope('facility_wide')}
                  className="w-4 h-4 text-danger-600 border-danger-400 focus:ring-danger-500 bg-danger-900"
                />
                <Factory size={20} className="text-danger-400" />
                <div className="flex-1">
                  <span className="font-semibold text-white">Halt Facility-Wide Production</span>
                  <p className="text-xs text-danger-400 mt-0.5">All your lines, all active jobs, immediate shutdown</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  scope === 'specific_job' ? 'border-warning-500 bg-warning-900/30' : 'border-danger-800/50 hover:border-warning-700'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'specific_job'}
                  onChange={() => setScope('specific_job')}
                  className="w-4 h-4 text-warning-600 border-warning-400 focus:ring-warning-500 bg-warning-900"
                />
                <Target size={20} className="text-warning-400" />
                <div className="flex-1">
                  <span className="font-semibold text-white">Halt Specific Active Job Run Only</span>
                  <p className="text-xs text-warning-400 mt-0.5">Stop designated production job, others continue</p>
                </div>
              </label>
            </div>
          </div>

          {scope === 'specific_job' && (
            <div>
              <label className="block text-sm font-semibold text-danger-200 uppercase tracking-wide mb-2">Select Job</label>
              {activeJobs === null ? (
                <div className="flex items-center gap-2 text-sm text-danger-400 py-2">
                  <Loader2 size={16} className="animate-spin" /> Loading active jobs...
                </div>
              ) : activeJobs.length === 0 ? (
                <p className="text-sm text-danger-400">No active jobs on your lines.</p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-4 py-3 bg-danger-900 border-2 border-danger-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-warning-500 focus:ring-2 focus:ring-warning-500/30"
                  >
                    <option value="" className="bg-danger-900">
                      Choose a job...
                    </option>
                    {activeJobs.map((job) => (
                      <option key={job.id} value={job.id} className="bg-danger-900">
                        {job.line.lineCode} — {job.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-danger-400 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-danger-200 uppercase tracking-wide mb-2">
              Reason for Stop <span className="text-danger-400">*</span>
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 bg-danger-900 border-2 border-danger-700 rounded-lg text-white appearance-none cursor-pointer focus:outline-none focus:border-danger-500 focus:ring-2 focus:ring-danger-500/30"
              >
                <option value="" className="bg-danger-900">
                  Select reason...
                </option>
                {REASONS.map((r) => (
                  <option key={r} value={r} className="bg-danger-900">
                    {r}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-danger-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-danger-200 uppercase tracking-wide mb-2">Additional Details</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the situation and any immediate actions taken..."
              className="w-full h-20 px-4 py-3 bg-danger-900 border-2 border-danger-700 rounded-lg text-white placeholder-danger-500 focus:outline-none focus:border-danger-500 focus:ring-2 focus:ring-danger-500/30 resize-none"
            />
          </div>

          <div className="pt-1">
            <button
              type="button"
              onMouseDown={startHold}
              onMouseUp={endHold}
              onMouseLeave={endHold}
              onTouchStart={startHold}
              onTouchEnd={endHold}
              disabled={!canSubmit || submitting}
              className={`w-full relative overflow-hidden py-4 rounded-lg font-bold text-lg uppercase tracking-wider transition-all select-none ${
                !canSubmit
                  ? 'bg-danger-800/50 text-danger-500 cursor-not-allowed'
                  : isHolding
                  ? 'bg-danger-600 text-white'
                  : 'bg-danger-700 hover:bg-danger-600 text-white'
              }`}
            >
              <div className="absolute inset-0 bg-danger-500 transition-all duration-75" style={{ width: `${holdProgress}%` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="relative flex items-center justify-center gap-3">
                {submitting ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <HandMetal size={24} className={isHolding ? 'animate-pulse' : ''} />
                )}
                <span>
                  {submitting ? 'Stopping Production...' : holdProgress >= 100 ? 'Confirmed — Executing...' : isHolding ? 'Continue Holding...' : 'Hold to Confirm Emergency Stop'}
                </span>
              </div>
            </button>
            <p className="text-center text-danger-400 text-xs mt-2">Hold button for 1.5 seconds to confirm activation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
