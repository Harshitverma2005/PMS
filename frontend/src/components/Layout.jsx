import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, Target, Users, LayoutDashboard,
  Calendar, ClipboardList, Bell, Search,
  Activity, Award, RefreshCw, Flag, UserCheck, Settings, Zap,
  ChevronDown, MoreHorizontal
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { notificationService } from '../api';

const COLORS = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E4E2DC",
  accent: "#2563EB",
  accentDim: "#1D4ED8",
  emerald: "#059669",
  amber: "#D97706",
  rose: "#DC2626",
  violet: "#7C3AED",
  text: "#111111",
  muted: "#6B7280",
  subtle: "#9CA3AF",
};

export default function Layout({ children }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(res.data.unread);
    } catch (e) {
      console.error("Failed to load notifications count", e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  const navItems = [
    { id: "/", label: "Dashboard", icon: LayoutDashboard },
    { id: "/goals", label: "Goals", icon: Target },
    { id: "/probation", label: "Probation", icon: UserCheck, roles: ["manager", "admin"] },
    { id: "/cycles", label: "Review Cycles", icon: RefreshCw, roles: ["manager", "admin"] },
    { id: "/feedback-flags", label: "Feedback & Flags", icon: Flag, roles: ["admin"] },
    { id: "/reports", label: "Reports", icon: Activity, roles: ["manager", "admin"] },
    { id: "/performance", label: "My Reviews", icon: ClipboardList },
    { id: "/teams", label: "Team", icon: Users, roles: ["manager", "admin"] },
    { id: "/users", label: "Users", icon: UserCheck, roles: ["admin"] },
    // Pro features
    { id: "/timeline", label: "My Timeline", icon: Activity },
    { id: "/achievements", label: "Achievements", icon: Award },
    { id: "/kudos", label: "Kudos Feed", icon: Zap },
    { id: "/readiness", label: "Review Readiness", icon: Target, roles: ["manager", "admin"] },
  ];

  const filteredNavItems = navItems.filter(item =>
    !item.roles || item.roles.includes(user?.role)
  );

  const isActive = (path) => location.pathname === path;

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: COLORS.bg, minHeight: "100vh",
      display: "flex", flexDirection: "column",
    }}>
      {/* Top bar */}
      <div style={{
        background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`,
        padding: "0 24px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.violet})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.02em" }}>
            PMS
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Role Badge */}
          <div style={{
            padding: "4px 12px",
            background: user?.role === 'admin'
              ? `${COLORS.violet}15`
              : user?.role === 'manager'
                ? `${COLORS.accent}15`
                : `${COLORS.emerald}15`,
            border: `1px solid ${user?.role === 'admin' ? `${COLORS.violet}40`
              : user?.role === 'manager' ? `${COLORS.accent}40`
                : `${COLORS.emerald}40`
              }`,
            borderRadius: 8,
            fontSize: 11, fontWeight: 700,
            color: user?.role === 'admin' ? COLORS.violet
              : user?.role === 'manager' ? COLORS.accent
                : COLORS.emerald,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {user?.role}
          </div>

          <div onClick={() => navigate('/notifications')} style={{
            width: 32, height: 32, borderRadius: 8,
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            position: "relative",
          }}>
            <Bell size={15} color={COLORS.muted} />
            {unreadCount > 0 && (
              <div style={{
                position: "absolute", top: 6, right: 6,
                width: 8, height: 8, borderRadius: "50%",
                background: COLORS.rose,
                border: `1.5px solid ${COLORS.surface}`,
                boxShadow: `0 0 0 2px ${COLORS.rose}20`,
              }} />
            )}
          </div>

          <div onClick={() => navigate('/goals/new')} style={{
            height: 32, padding: "0 12px", borderRadius: 8,
            background: COLORS.accent, border: "none",
            display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
            boxShadow: `0 4px 12px ${COLORS.accent}33`,
          }}>
            <Zap size={14} color="#fff" />
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>Quick Action</span>
          </div>

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: COLORS.bg, border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "4px 10px",
            cursor: "pointer",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6,
              background: COLORS.accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#fff",
            }}>
              {user?.name?.charAt(0) || 'U'}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
              {user?.name}
            </span>
          </div>
          <button onClick={handleLogout}
            style={{
              background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600,
              color: COLORS.muted, cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            }}>
            <LogOut size={12} /> Logout
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{
          width: 220, background: COLORS.surface,
          borderRight: `1px solid ${COLORS.border}`,
          padding: "16px 10px", display: "flex",
          flexDirection: "column", gap: 2,
          position: "sticky", top: 56, height: "calc(100vh - 56px)",
          overflowY: "auto",
        }}>
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.id);
            return (
              <Link key={item.id} to={item.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 9, cursor: "pointer",
                  textDecoration: "none",
                  background: active ? `${COLORS.accent}12` : "transparent",
                  border: active ? `1px solid ${COLORS.accent}30` : "1px solid transparent",
                }}>
                <Icon size={15} color={active ? COLORS.accent : COLORS.muted} />
                <span style={{
                  fontSize: 13, fontWeight: active ? 600 : 500,
                  color: active ? COLORS.text : COLORS.muted,
                }}>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
