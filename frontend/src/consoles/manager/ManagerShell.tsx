import { useCallback, useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Wrench,
  Users,
  AlertTriangle,
  //Bell,
  LogOut,
  AlertOctagon,
  //User,
  //ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../shared/lib/api';
import { connectSocket } from '../../shared/lib/socket';
import { EmergencyStopOverlay } from './components/EmergencyStopOverlay';
import { EmergencyStatusBanner, type PausedJob } from './components/EmergencyStatusBanner';
import { GlobalSearch } from './components/GlobalSearch';

const navItems = [
  { to: '/manager', label: 'Operations', icon: <LayoutDashboard size={20} strokeWidth={2.5} />, end: true },
  { to: '/manager/blueprints', label: 'Blueprint Library', icon: <FileText size={20} strokeWidth={2.5} /> },
  { to: '/manager/job-builder', label: 'Job Builder', icon: <Wrench size={20} strokeWidth={2.5} /> },
  { to: '/manager/operator-roster', label: 'Operator Roster', icon: <Users size={20} strokeWidth={2.5} /> },
  { to: '/manager/faults', label: 'Fault Records', icon: <AlertTriangle size={20} strokeWidth={2.5} /> },
];

export function ManagerShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showStopOverlay, setShowStopOverlay] = useState(false);
  const [stopConfirmation, setStopConfirmation] = useState<string | null>(null);
  const [pausedJobs, setPausedJobs] = useState<PausedJob[]>([]);

  const loadPausedJobs = useCallback(() => {
    api
      .get<{ jobs: PausedJob[] }>('/emergency-stop/paused-jobs')
      .then((res) => setPausedJobs(res.data.jobs))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPausedJobs();
    const socket = connectSocket();
    const handleTriggered = () => loadPausedJobs();
    const handleResumed = () => loadPausedJobs();
    socket.on('emergency:triggered', handleTriggered);
    socket.on('emergency:resumed', handleResumed);
    return () => {
      socket.off('emergency:triggered', handleTriggered);
      socket.off('emergency:resumed', handleResumed);
    };
  }, [loadPausedJobs]);

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen flex bg-slate-50">
      <aside className="w-64 bg-navy-950 flex flex-col flex-shrink-0">
        <div className="px-5 py-5 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-white/20">
              <img src="/dojohub_icon.png" alt="Dojo Hub Uganda logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">Dojo Hub Uganda</h1>
              <p className="text-xs text-slate-400 leading-tight">Manager Console</p>
              <p className="text-xs text-slate-400 leading-tight">{user?.name}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-white/10 text-white border border-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-navy-800">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all"
          >
            <LogOut size={20} strokeWidth={2.5} />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
          <GlobalSearch />

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setShowStopOverlay(true)}
              className="flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all border-2 border-danger-700"
            >
              <AlertOctagon size={18} />
              <span className="text-sm tracking-wide">EMERGENCY STOP</span>
            </button>

            {/*<button className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-900 leading-tight">{user?.name}</p>
                <p className="text-xs text-slate-500 leading-tight">Manager</p>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </button>*/}
          </div>
        </header>

        {stopConfirmation && (
          <div className="flex items-center justify-between gap-3 px-6 py-2.5 bg-danger-50 border-b border-danger-200 text-danger-800 text-sm flex-shrink-0">
            <span>{stopConfirmation}</span>
            <button onClick={() => setStopConfirmation(null)} className="text-danger-600 hover:text-danger-800">
              Dismiss
            </button>
          </div>
        )}

        <EmergencyStatusBanner pausedJobs={pausedJobs} onResumed={loadPausedJobs} />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      {showStopOverlay && (
        <EmergencyStopOverlay
          onClose={() => setShowStopOverlay(false)}
          onStopped={(count) => {
            setShowStopOverlay(false);
            setStopConfirmation(
              count === 0
                ? 'No active jobs were running — nothing to stop.'
                : `Emergency stop triggered — ${count} job${count === 1 ? '' : 's'} paused.`
            );
            loadPausedJobs();
          }}
        />
      )}
    </div>
  );
}
