import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  Briefcase,
  BarChart3,
  //Bell,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
  { to: '/executive', label: 'Enterprise Overview', icon: <LayoutDashboard size={20} strokeWidth={2.5} />, end: true },
  { to: '/executive/managers', label: 'Manager Accounts', icon: <Users size={20} strokeWidth={2.5} /> },
  { to: '/executive/lines', label: 'Production Lines', icon: <Layers size={20} strokeWidth={2.5} /> },
  { to: '/executive/jobs', label: 'Active Jobs', icon: <Briefcase size={20} strokeWidth={2.5} /> },
  { to: '/executive/analytics', label: 'Historical Analytics', icon: <BarChart3 size={20} strokeWidth={2.5} /> },
];

export function ExecutiveShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
              <p className="text-xs text-slate-400 leading-tight">Executive Console</p>
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
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Welcome back, {user?.name?.split(' ')[0] || 'Director'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              <span className="text-slate-300 mx-2">·</span>
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/*<button className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <Bell size={20} strokeWidth={2.5} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-danger-500 rounded-full" />
            </button>*/}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-100 border border-success-200">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
              <span className="text-sm font-semibold text-success-700">System Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
