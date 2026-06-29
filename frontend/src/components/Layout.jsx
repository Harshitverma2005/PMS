import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Target, Activity, ClipboardList,
  Settings, Bell, Users, BarChart3, ChevronDown,
  Award, Zap, ShieldAlert, RefreshCw, UserCheck, Flag, LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { notificationService } from '../api';

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', member: 'Member' };

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user) || { name: '', role: 'member', email: '' };
  const logout = useAuthStore((s) => s.logout);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Poll unread notification count so the bell badge stays current.
  useEffect(() => {
    let active = true;
    const load = () => notificationService.getUnreadCount()
      .then(res => { if (active) setUnread(res?.data?.unread_count ?? 0); })
      .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    return () => { active = false; clearInterval(t); };
  }, [location.pathname]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.account-switcher')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    navigate('/login');
  };

  // Roles: 'member' (employee), 'manager', 'admin' (HR/admin)
  const navItems = [
    { id: "/", label: "Dashboard", icon: LayoutDashboard, roles: ['member', 'manager', 'admin'] },
    { id: "/goals", label: "Goals", icon: Target, roles: ['member', 'manager', 'admin'] },
    { id: "/achievements", label: "Achievements", icon: Award, roles: ['member', 'manager', 'admin'] },
    { id: "/kudos", label: "Kudos Feed", icon: Zap, roles: ['member', 'manager', 'admin'] },
    // "My Reviews" is a personal page (forms about you). Only members are reviewees —
    // managers/admins never get review forms, so it would always be empty for them.
    { id: "/performance", label: "My Reviews", icon: ClipboardList, roles: ['member'] },
    { id: "/timeline", label: "Performance Timeline", icon: Activity, roles: ['member', 'manager', 'admin'] },
    { id: "/readiness", label: "Review Readiness", icon: ClipboardList, roles: ['member', 'manager', 'admin'] },
    { id: "/workload", label: "Workload Intelligence", icon: Users, roles: ['manager', 'admin'] },
    // Review Studio is where a manager writes the review of their direct reports.
    // Admins are nobody's manager-of-record, so it's always empty for them — managers only.
    { id: "/review-studio", label: "Review Studio", icon: ClipboardList, roles: ['manager'] },
    { id: "/teams", label: "Teams", icon: Users, roles: ['manager', 'admin'] },
    { id: "/probation", label: "Probation", icon: ShieldAlert, roles: ['manager', 'admin'] },
    { id: "/cycles", label: "Review Cycles", icon: RefreshCw, roles: ['manager', 'admin'] },
    { id: "/reports", label: "Reports", icon: BarChart3, roles: ['admin'] },
    { id: "/users", label: "Users", icon: UserCheck, roles: ['admin'] },
    { id: "/feedback-flags", label: "Feedback & Flags", icon: Flag, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(currentUser.role));
  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-[#111827] font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10 relative">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-2 text-blue-600 font-bold text-lg tracking-tight">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            PerformOS
          </div>
        </div>

        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
            Main Menu
          </div>
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.id);
            return (
              <Link 
                key={item.id} 
                to={item.id} 
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} className={active ? "text-blue-600" : "text-gray-400"} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* WORKSPACE INDICATOR IN SIDEBAR */}
        <div className="p-4 m-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Current Workspace</div>
          <div className="text-sm font-medium text-gray-900 capitalize flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              currentUser.role === 'member' ? 'bg-emerald-500' :
              currentUser.role === 'manager' ? 'bg-blue-500' : 'bg-purple-500'
            }`} />
            {ROLE_LABEL[currentUser.role] || currentUser.role} View
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* TOP BAR */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="text-sm text-gray-500 font-medium">
            {filteredNavItems.find(i => isActive(i.id))?.label || 'Overview'}
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/notifications')} className="relative text-gray-400 hover:text-gray-600 transition-colors" title="Notifications">
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border border-white flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            <div className="h-6 w-px bg-gray-200"></div>

            <div className="relative account-switcher">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 hover:bg-gray-50 p-1.5 pr-3 rounded-full transition-colors border border-transparent hover:border-gray-200"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${
                  currentUser.role === 'member' ? 'bg-emerald-500' :
                  currentUser.role === 'manager' ? 'bg-blue-500' : 'bg-purple-500'
                }`}>
                  {currentUser.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-900 leading-none">{currentUser.name}</div>
                  <div className="text-xs text-gray-500 mt-1 capitalize">{ROLE_LABEL[currentUser.role] || currentUser.role}</div>
                </div>
                <ChevronDown size={14} className="text-gray-400 ml-1" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50 transform opacity-100 scale-100 transition-all origin-top-right">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">{currentUser.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{currentUser.email}</div>
                    <div className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {ROLE_LABEL[currentUser.role] || currentUser.role}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut size={16} className="text-gray-400" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
