import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { goalService, userService, teamService, cycleService, notificationService, feedbackService, probationService, adminService, dashboardService } from '../api';
import { useAuthStore } from "../store/auth";
import toast from "react-hot-toast";
import { readinessService } from '../api';
import { 
  AlertTriangle, ArrowDown, ArrowUp, ArrowRight, CheckCircle, Flag, MessageSquare, Target, TrendingUp, 
  Activity, Zap, BarChart3, Clock, Eye, Edit3, Send, Plus, Percent,
  Bell, Star, FileText, ShieldAlert, ChevronRight, ExternalLink,
  ClipboardCheck, UserCheck, XCircle, RefreshCw, Award
} from 'lucide-react';

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
  cyan: "#0891B2",
  indigo: "#4F46E5",
};

/* ──────────────────────────── Shared Components ──────────────────────────── */

const StatCard = ({ label, value, icon: Icon, trend, trendValue, color, to, subtitle }) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => to && navigate(to)} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: COLORS.card, 
        border: `1.5px solid ${isHovered && to ? color : COLORS.border}`,
        borderRadius: 16, 
        padding: "20px 24px",
        display: "flex", 
        flexDirection: "column", 
        gap: 12,
        boxShadow: isHovered && to ? `0 12px 24px -10px ${color}20` : "0 1px 3px rgba(0,0,0,0.04)",
        cursor: to ? "pointer" : "default",
        transform: isHovered && to ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}10`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} color={color} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: COLORS.text }}>{value}</span>
        {trend && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            fontSize: 12, fontWeight: 700,
            color: trend === 'up' ? COLORS.emerald : COLORS.rose,
          }}>
            {trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {trendValue}
          </div>
        )}
      </div>
      {subtitle && (
        <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.subtle }}>{subtitle}</span>
      )}
    </div>
  );
};

const ProgressBar = ({ progress, color, height = 6 }) => (
  <div style={{ width: "100%", height, background: COLORS.bg, borderRadius: 10, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, Math.max(0, progress || 0))}%`, height: "100%", background: color || COLORS.accent, borderRadius: 10, transition: "width 0.8s ease" }} />
  </div>
);

const StatusPill = ({ status, size = "sm" }) => {
  const config = {
    [GoalStatus.DRAFT]: { bg: `${COLORS.subtle}18`, text: COLORS.muted, label: "Draft" },
    [GoalStatus.ACTIVE]: { bg: `${COLORS.accent}12`, text: COLORS.accent, label: "Active" },
    [GoalStatus.COMPLETED]: { bg: `${COLORS.emerald}12`, text: COLORS.emerald, label: "Completed" },
    [GoalStatus.PENDING_APPROVAL]: { bg: `${COLORS.amber}12`, text: COLORS.amber, label: "Pending Approval" },
    [GoalStatus.AWAITING_FEEDBACK]: { bg: `${COLORS.violet}12`, text: COLORS.violet, label: "Awaiting Feedback" },
    [GoalStatus.SCORED]: { bg: `${COLORS.emerald}24`, text: COLORS.emerald, label: "Scored" },
    [GoalStatus.REJECTED]: { bg: `${COLORS.rose}12`, text: COLORS.rose, label: "Rejected" },
    "approved": { bg: `${COLORS.emerald}12`, text: COLORS.emerald, label: "Approved" },
    "pending": { bg: `${COLORS.amber}12`, text: COLORS.amber, label: "Pending" },
    "rejected": { bg: `${COLORS.rose}12`, text: COLORS.rose, label: "Rejected" },
    "submitted": { bg: `${COLORS.accent}12`, text: COLORS.accent, label: "Submitted" },
    "not_submitted": { bg: `${COLORS.subtle}14`, text: COLORS.muted, label: "Not Submitted" },
  };
  const c = config[status] || { bg: COLORS.bg, text: COLORS.muted, label: status || "—" };
  const pad = size === "sm" ? "3px 8px" : "4px 12px";
  const fs = size === "sm" ? 10 : 11;
  return (
    <div style={{
      display: "inline-flex", padding: pad, borderRadius: 6,
      background: c.bg, color: c.text,
      fontSize: fs, fontWeight: 700, letterSpacing: "-0.01em",
      whiteSpace: "nowrap",
    }}>
      {c.label}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle, action, color = COLORS.accent }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}10`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, letterSpacing: "-0.02em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    {action}
  </div>
);

const LevelPill = ({ level }) => {
  const config = {
    company: { bg: `${COLORS.accent}12`, text: COLORS.accent, label: "Company" },
    team: { bg: `${COLORS.violet}12`, text: COLORS.violet, label: "Team" },
    individual: { bg: `${COLORS.cyan}12`, text: COLORS.cyan, label: "Individual" },
  };
  const c = config[level] || { bg: COLORS.bg, text: COLORS.muted, label: level || "—" };
  return (
    <div style={{
      display: "inline-flex", padding: "3px 8px", borderRadius: 6,
      background: c.bg, color: c.text,
      fontSize: 10, fontWeight: 700,
    }}>
      {c.label}
    </div>
  );
};

/* ──────────────────────────── Notification Item ──────────────────────────── */

const NotificationItem = ({ notification, onClick }) => {
  const iconMap = {
    goal_approved: { icon: CheckCircle, color: COLORS.emerald },
    goal_rejected: { icon: XCircle, color: COLORS.rose },
    review_due: { icon: Clock, color: COLORS.amber },
    feedback_pending: { icon: MessageSquare, color: COLORS.violet },
    goal_submitted: { icon: Send, color: COLORS.accent },
    probation_started: { icon: ShieldAlert, color: COLORS.rose },
  };
  
  const typeConfig = iconMap[notification.type] || { icon: Bell, color: COLORS.accent };
  const Icon = typeConfig.icon;
  const isUnread = !notification.is_read;
  
  return (
    <div 
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "12px 16px", borderRadius: 12,
        background: isUnread ? `${COLORS.accent}04` : "transparent",
        border: `1px solid ${isUnread ? `${COLORS.accent}20` : COLORS.border}`,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: `${typeConfig.color}10`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={14} color={typeConfig.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: isUnread ? 700 : 500, color: COLORS.text, lineHeight: 1.4 }}>{notification.message}</div>
        <div style={{ fontSize: 10, color: COLORS.subtle, marginTop: 4 }}>
          {new Date(notification.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      {isUnread && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.accent, flexShrink: 0, marginTop: 6 }} />
      )}
    </div>
  );
};

/* ──────────────────────────── Main Dashboard ──────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [performanceForms, setPerformanceForms] = useState([]);
  const [myProbation, setMyProbation] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [readiness, setReadiness] = useState(null);
  
  const currentUser = useAuthStore((state) => state.user);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      if (currentUser?.role === 'admin') {
        const [adminRes, notificationsRes] = await Promise.all([
          adminService.getDashboard().catch(() => ({ data: {} })),
          notificationService.getAll().catch(() => ({ data: [] }))
        ]);
        setAdminData(adminRes.data);
        setNotifications(notificationsRes.data || []);
      } else if (currentUser?.role === 'manager') {
        const [teamRes, notificationsRes, goalsRes] = await Promise.all([
          dashboardService.getTeam().catch(() => ({ data: {} })),
          notificationService.getAll().catch(() => ({ data: [] })),
          goalService.getAll().catch(() => ({ data: [] }))
        ]);
        setTeamData(teamRes.data);
        setNotifications(notificationsRes.data || []);
        setGoals(goalsRes.data || []);
      } else {
        const [goalsRes, notificationsRes, performanceRes, probationRes, readinessRes] = await Promise.all([
          goalService.getAll().catch(() => ({ data: [] })),
          notificationService.getAll().catch(() => ({ data: [] })),
          feedbackService.getAll().catch(() => ({ data: [] })),
          probationService.getMe(currentUser.id).then(r => r.data).catch(() => null),
          readinessService.getReadiness(currentUser.id).catch(() => ({ data: null }))
        ]);
        setGoals(Array.isArray(goalsRes.data) ? goalsRes.data : []);
        setNotifications(notificationsRes.data || []);
        setPerformanceForms(performanceRes.data || []);
        setMyProbation(probationRes || null);
        setReadiness(readinessRes.data || null);
      }
    } catch (error) {
      console.error("Dashboard Load Error:", error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─── Derived Stats ─── */
  const stats = useMemo(() => {
    const safeGoals = Array.isArray(goals) ? goals : [];
    const activeGoals = safeGoals.filter(g => g.status === GoalStatus.ACTIVE || g.status === GoalStatus.AWAITING_FEEDBACK);
    const completedCount = safeGoals.filter(g => g.status === GoalStatus.COMPLETED || g.completion_pct === 100).length;
    const avgComp = safeGoals.length > 0 
      ? Math.round(safeGoals.reduce((acc, g) => acc + (g.completion_pct || 0), 0) / safeGoals.length) 
      : 0;
    const pendingApprovals = safeGoals.filter(g => g.status === GoalStatus.PENDING_APPROVAL).length;
    
    const safeForms = Array.isArray(performanceForms) ? performanceForms : [];
    const pendingReviews = safeForms.filter(f => f.status === 'pending' || !f.submitted_at).length;
    const submittedReviews = safeForms.filter(f => f.status === 'submitted' || f.submitted_at).length;
    const lastForm = safeForms.length > 0 ? safeForms[safeForms.length - 1] : null;

    return {
      total: safeGoals.length,
      activeGoals: activeGoals.length,
      completed: completedCount,
      remaining: safeGoals.length - completedCount,
      atRisk: safeGoals.filter(g => g.is_at_risk).length,
      avgCompletion: avgComp,
      pendingApprovals,
      pendingReviews,
      submittedReviews,
      totalReviews: safeForms.length,
      lastReviewRating: lastForm?.overall_rating || lastForm?.rating || null,
      hasProbation: !!myProbation,
      probationStatus: myProbation?.status || null,
    };
  }, [goals, performanceForms, myProbation]);

  /* ─── Notification categorization ─── */
  const categorizedNotifications = useMemo(() => {
    const safeNotifs = Array.isArray(notifications) ? notifications : [];
    return {
      all: safeNotifs.slice(0, 6),
      unread: safeNotifs.filter(n => !n.is_read).length,
    };
  }, [notifications]);

  /* ─── Loading State ─── */
  if (loading || !currentUser) return (
    <Layout>
      <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted }}>Loading your dashboard…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );

  /* ═══════════════════════════ ADMIN DASHBOARD ═══════════════════════════ */
  if (currentUser.role === 'admin') {
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: COLORS.text, letterSpacing: "-0.04em" }}>Strategic Command Center</h1>
              <p style={{ fontSize: 14, color: COLORS.muted, marginTop: 4 }}>Organizational health & execution telemetry</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ background: `${COLORS.accent}10`, color: COLORS.accent, padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={16} /> System Online
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            <StatCard label="Org Performance" value={`${adminData?.total_goals ? Math.round((adminData.completed_goals / adminData.total_goals) * 100) : 0}%`} icon={TrendingUp} color={COLORS.accent} trend="up" trendValue="Global Avg" />
            <StatCard label="Open Review Cycles" value={adminData?.open_review_cycles || 0} icon={MessageSquare} color={COLORS.amber} trendValue="Cycles" to="/cycles" />
            <StatCard label="Open Flags" value={adminData?.pending_escalations || 0} icon={Flag} color={COLORS.rose} trendValue="Requires Review" to="/feedback-flags" />
            <StatCard label="Probation Active" value={adminData?.probation_in_progress || 0} icon={AlertTriangle} color={COLORS.violet} trendValue="In Progress" to="/probation" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Clock size={20} color={COLORS.accent} />
                    <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.03em" }}>Active Cycle Monitor</span>
                  </div>
                  <StatusPill status={adminData?.active_cycle?.name || "No Active Cycle"} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div style={{ padding: "20px", background: COLORS.bg, borderRadius: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{adminData?.active_cycle?.name || 'Annual Strategy Loop'}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.accent }}>{adminData?.feedback?.completion_rate || 0}% Complete</span>
                    </div>
                    <ProgressBar progress={adminData?.feedback?.completion_rate || 0} color={COLORS.accent} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ padding: "16px", border: `1px solid ${COLORS.border}`, borderRadius: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 8 }}>PROBATION TRACK</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{adminData?.probation_in_progress || 0} <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 500 }}>Active</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <BarChart3 size={20} color={COLORS.emerald} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.03em" }}>Goal Distribution</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                  <div style={{ padding: "20px", background: `${COLORS.accent}08`, borderRadius: 18, border: `1px solid ${COLORS.accent}15` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.accent, marginBottom: 8 }}>TOTAL</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>{adminData?.total_goals || 0}</div>
                  </div>
                  <div style={{ padding: "20px", background: `${COLORS.violet}08`, borderRadius: 18, border: `1px solid ${COLORS.violet}15` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.violet, marginBottom: 8 }}>ACTIVE</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>{adminData?.active_goals || 0}</div>
                  </div>
                  <div style={{ padding: "20px", background: `${COLORS.emerald}08`, borderRadius: 18, border: `1px solid ${COLORS.emerald}15` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.emerald, marginBottom: 8 }}>COMPLETED</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>{adminData?.completed_goals || 0}</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                  <Zap size={20} color={COLORS.rose} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.03em" }}>Escalation Queue</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ padding: "14px 18px", background: `${COLORS.rose}08`, borderRadius: 16, border: `1px solid ${COLORS.rose}15`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.rose }}>Pending Escalations ({adminData?.pending_escalations || 0})</div>
                    <AlertTriangle size={16} color={COLORS.rose} />
                  </div>
                  <div style={{ padding: "14px 18px", background: `${COLORS.amber}08`, borderRadius: 16, border: `1px solid ${COLORS.amber}15`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.amber }}>At Risk Goals ({adminData?.at_risk_goals || 0})</div>
                    <Clock size={16} color={COLORS.amber} />
                  </div>
                </div>
              </div>
              <div style={{ background: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentDim} 100%)`, borderRadius: 24, padding: 28, color: "white" }}>
                 <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Report Center</h3>
                 <button onClick={() => navigate('/reports')} style={{ width: "100%", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "12px", color: "white", fontWeight: 700, cursor: "pointer" }}>
                    GO TO REPORTS
                 </button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  /* ═══════════════════════════ MANAGER DASHBOARD ═══════════════════════════ */
  if (currentUser.role === 'manager' && teamData) {
    return (
      <Layout>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: COLORS.text, letterSpacing: "-0.04em" }}>Team Command Center</h1>
              <p style={{ fontSize: 14, color: COLORS.muted, marginTop: 4 }}>Managing <span style={{ fontWeight: 700, color: COLORS.text }}>{teamData.team_name}</span> Performance & Approvals</p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
               <button onClick={() => navigate('/goals/new')} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: `0 4px 14px ${COLORS.accent}25` }}>
                  <Plus size={16} /> New Team Objective
               </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20 }}>
            <StatCard label="Team Progress" value={`${teamData.team_completion_pct}%`} icon={TrendingUp} color={COLORS.emerald} trend="up" trendValue="Avg Completion" />
            <StatCard label="Pending Approvals" value={teamData.pending_approvals_count} icon={Clock} color={COLORS.amber} subtitle="Goal submissions" />
            <StatCard label="Pending Reviews" value={teamData.pending_reviews?.length || 0} icon={ClipboardCheck} color={COLORS.violet} subtitle="Forms to complete" />
            <StatCard label="Flagged" value={teamData.flagged_members?.length || 0} icon={Flag} color={COLORS.rose} subtitle="Requires attention" />
            <StatCard label="In Probation" value={teamData.probation_members?.length || 0} icon={ShieldAlert} color={COLORS.rose} subtitle="Team PIPs" />
          </div>

          {/* Main Content */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              {/* Team Performance Table */}
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 28 }}>
                <SectionHeader icon={UserCheck} title="Team Performance" subtitle="Activity & completion per member" color={COLORS.accent} />
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        {["Member", "Goals", "Completion", "Status", ""].map((h, i) => (
                          <th key={i} style={{ textAlign: "left", padding: "12px", fontSize: 10, fontWeight: 700, color: COLORS.subtle, textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${COLORS.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamData.members?.map((member, idx) => (
                        <tr key={member.user_id} style={{ borderBottom: idx === teamData.members.length - 1 ? "none" : `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: "16px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 10, background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: COLORS.muted }}>{member.name.charAt(0)}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{member.name}</div>
                            </div>
                          </td>
                          <td style={{ padding: "16px 12px" }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{member.total_goals} goals</div>
                            <div style={{ fontSize: 10, color: COLORS.subtle }}>{member.active} active</div>
                          </td>
                          <td style={{ padding: "16px 12px", width: 140 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <ProgressBar progress={member.avg_completion_pct} color={COLORS.emerald} height={5} />
                              <span style={{ fontSize: 11, fontWeight: 700 }}>{member.avg_completion_pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "16px 12px" }}>
                            {member.at_risk > 0 ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.rose, fontSize: 11, fontWeight: 700 }}>
                                <AlertTriangle size={12} /> At Risk
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.emerald, fontSize: 11, fontWeight: 700 }}>
                                <CheckCircle size={12} /> On Track
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "16px 12px", textAlign: "right" }}>
                            <button onClick={() => navigate(`/users/${member.user_id}`)} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: COLORS.subtle }}>
                               <ExternalLink size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval Queue */}
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 28 }}>
                 <SectionHeader icon={Clock} title="Approval Queue" subtitle="Strategies awaiting your sign-off" color={COLORS.amber} />
                 {!teamData.pending_approvals || teamData.pending_approvals.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: COLORS.subtle, background: COLORS.bg, borderRadius: 16, border: `1px dashed ${COLORS.border}` }}>
                       <CheckCircle size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
                       <div style={{ fontSize: 13, fontWeight: 600 }}>All goal submissions reviewed</div>
                    </div>
                 ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                       {(teamData.pending_approvals || []).map(goal => (
                          <div key={goal.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", background: COLORS.bg, borderRadius: 16, border: `1px solid ${COLORS.border}` }}>
                             <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${COLORS.amber}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                   <Target size={20} color={COLORS.amber} />
                                </div>
                                <div>
                                   <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{goal.title}</div>
                                   <div style={{ fontSize: 12, color: COLORS.muted }}>Request by <span style={{ fontWeight: 600 }}>{goal.assignee_name}</span> • {goal.weightage}% weight</div>
                                </div>
                             </div>
                             <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => navigate(`/goals/${goal.id}`)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Review Detail</button>
                                <button onClick={async () => {
                                  try {
                                    await goalService.approve(goal.id);
                                    toast.success("Goal approved!");
                                    loadData();
                                  } catch (e) { toast.error("Approval failed"); }
                                }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: COLORS.emerald, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                                <button onClick={async () => {
                                  const reason = prompt("Enter rejection rationale (optional):");
                                  if (reason === null) return; // User cancelled
                                  try {
                                    await goalService.reject(goal.id, reason);
                                    toast.success("Goal rejected");
                                    loadData();
                                  } catch (e) { toast.error("Rejection failed"); }
                                }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: COLORS.rose, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reject</button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
            </div>

            {/* Sidebar Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
               {/* Reviews Section */}
               <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: 24 }}>
                  <SectionHeader icon={ClipboardCheck} title="Reviews Hub" subtitle="Self & Manager assessments" color={COLORS.violet} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                     {teamData.pending_reviews?.map(review => (
                        <div key={review.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px", background: COLORS.bg, borderRadius: 10 }}>
                           <div>
                              <div style={{ fontSize: 12, fontWeight: 700 }}>{review.employee_name}</div>
                              <div style={{ fontSize: 10, color: COLORS.subtle }}>{review.type.replace('_', ' ')} • {review.status}</div>
                           </div>
                           <button onClick={() => navigate(`/performance/form/${review.id}`)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                              Finish
                           </button>
                        </div>
                     ))}
                     {(!teamData.pending_reviews?.length) && (
                        <div style={{ textAlign: "center", padding: "20px", color: COLORS.subtle, fontSize: 12 }}>All review cycles caught up.</div>
                     )}
                  </div>
               </div>

            </div>
          </div>
        </div>
      </Layout>
    );
  }

  /* ═══════════════════════════ EMPLOYEE / MEMBER DASHBOARD ═══════════════════════════ */
  
  const safeGoals = Array.isArray(goals) ? goals : [];

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        
        {/* ─── Header ─── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: COLORS.text, letterSpacing: "-0.03em", margin: 0 }}>
              {currentUser.role === 'manager' ? 'Team Performance Hub' : 'My Dashboard'}
            </h1>
            <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
              Welcome back, <span style={{ fontWeight: 700, color: COLORS.text }}>{currentUser.name}</span> — here's your performance snapshot
            </p>
          </div>
          <button
            onClick={() => navigate('/goals/new')}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: COLORS.accent, color: "#fff",
              border: "none", borderRadius: 12, padding: "10px 20px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              boxShadow: `0 4px 14px ${COLORS.accent}30`,
              transition: "all 0.2s ease",
            }}
          >
            <Plus size={16} /> Create Goal
          </button>
        </div>

        {/* ─── Summary Cards ─── */}
        <div style={{ display: "grid", gridTemplateColumns: stats.hasProbation ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 20 }}>
          <StatCard 
            label="Active Goals" 
            value={stats.activeGoals} 
            icon={Target} 
            color={COLORS.accent}
            to="/goals"
            subtitle={`${stats.total} total goals`}
          />
          <StatCard 
            label="Goals Completion" 
            value={`${stats.avgCompletion}%`} 
            icon={TrendingUp} 
            color={COLORS.emerald}
            trend={stats.avgCompletion >= 50 ? 'up' : 'down'}
            trendValue={`${stats.completed}/${stats.total} done`}
          />
          {currentUser.role !== 'member' && (
            <StatCard 
              label="Pending Reviews" 
              value={stats.pendingReviews} 
              icon={ClipboardCheck} 
              color={COLORS.violet}
              to="/performance"
              subtitle={`${stats.submittedReviews} submitted`}
            />
          )}
          <StatCard 
            label="Pending Approvals" 
            value={stats.pendingApprovals} 
            icon={Clock} 
            color={COLORS.amber}
            to="/goals"
            subtitle="Goals awaiting manager review"
          />
          {stats.hasProbation && (
            <StatCard 
              label="Probation Status" 
              value={stats.probationStatus === 'active' ? 'Active' : stats.probationStatus || '—'}
              icon={ShieldAlert} 
              color={COLORS.rose}
              to="/probation"
              subtitle="Performance improvement plan"
            />
          )}
        </div>

        {/* ─── Main Content Grid ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24 }}>
          
          {/* ─── Left Column ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* ═══ GOALS TABLE ═══ */}
            <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 20, padding: 24, overflow: "hidden" }}>
              <SectionHeader 
                icon={Target} 
                title="My Goals" 
                subtitle={`${safeGoals.length} goals tracked`}
                color={COLORS.accent}
                action={
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => navigate('/goals')} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 8, padding: "6px 14px",
                      fontSize: 11, fontWeight: 700, color: COLORS.muted, cursor: "pointer",
                    }}>
                      View All <ArrowRight size={12} />
                    </button>
                  </div>
                }
              />
              
              {safeGoals.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <Target size={40} color={COLORS.subtle} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.muted }}>No goals yet</div>
                  <div style={{ fontSize: 12, color: COLORS.subtle, marginTop: 4 }}>Create your first goal to get started</div>
                  <button onClick={() => navigate('/goals/new')} style={{
                    marginTop: 16, background: COLORS.accent, color: "#fff",
                    border: "none", borderRadius: 8, padding: "8px 20px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>
                    <Plus size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
                    Create Goal
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
                    gap: 16 
                  }}>
                    {safeGoals.slice(0, 4).map((goal) => (
                      <div 
                        key={goal.id}
                        onClick={() => navigate(`/goals/${goal.id}`)}
                        style={{
                          padding: 20, background: COLORS.bg, borderRadius: 16,
                          border: `1px solid ${COLORS.border}`, cursor: "pointer",
                          transition: "all 0.2s ease", display: "flex", flexDirection: "column", gap: 12
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = COLORS.accent + "40";
                          e.currentTarget.style.transform = "translateY(-2px)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = COLORS.border;
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: COLORS.accent, textTransform: "uppercase" }}>{goal.level}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: COLORS.text }}>{goal.title}</span>
                          </div>
                          <StatusPill status={goal.status} size="sm" />
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 700, color: COLORS.muted }}>
                            <span>Completion</span>
                            <span>{goal.completion_pct || 0}%</span>
                          </div>
                          <ProgressBar progress={goal.completion_pct || 0} color={COLORS.accent} height={4} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 6, background: "#fff", border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: COLORS.accent }}>
                              {goal.owner?.name?.charAt(0) || "U"}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.muted }}>{goal.owner?.name || "Unassigned"}</span>
                          </div>
                          <ChevronRight size={14} color={COLORS.subtle} />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {safeGoals.length > 4 && (
                    <button 
                      onClick={() => navigate('/goals')}
                      style={{
                        width: "100%", padding: "12px", background: "transparent",
                        border: `1.5px dashed ${COLORS.border}`, borderRadius: 12,
                        color: COLORS.accent, fontSize: 12, fontWeight: 700, 
                        cursor: "pointer", transition: "0.2s"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `${COLORS.accent}05`}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      Explore All {safeGoals.length} Strategic Objectives <ArrowRight size={12} style={{ marginLeft: 6, verticalAlign: "middle" }} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ═══ READINESS SECTION ═══ */}
            {readiness && (
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 20, padding: 24 }}>
                <SectionHeader 
                  icon={Activity} 
                  title="Review Readiness" 
                  subtitle="Your preparedness for the upcoming performance cycle"
                  color={readiness.score >= 70 ? COLORS.emerald : readiness.score >= 40 ? COLORS.amber : COLORS.rose}
                />
                
                <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                   <div style={{
                      width: 100, height: 100, borderRadius: "50%",
                      background: `conic-gradient(${readiness.score >= 70 ? COLORS.emerald : readiness.score >= 40 ? COLORS.amber : COLORS.rose} ${readiness.score}%, ${COLORS.bg} 0)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative"
                   }}>
                      <div style={{
                         position: "absolute", inset: 8, background: COLORS.card, borderRadius: "50%",
                         display: "flex", alignItems: "center", justifyContent: "center",
                         flexDirection: "column"
                      }}>
                         <span style={{ fontSize: 24, fontWeight: 900, color: COLORS.text }}>{readiness.score}</span>
                         <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted }}>SCORE</span>
                      </div>
                   </div>
                   
                   <div style={{ flex: 1 }}>
                      {readiness.score === 100 ? (
                         <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.emerald, background: `${COLORS.emerald}10`, padding: 16, borderRadius: 12 }}>
                            <CheckCircle size={24} />
                            <span style={{ fontSize: 14, fontWeight: 700 }}>You are review-ready — great work!</span>
                         </div>
                      ) : (
                         <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>RECOMMENDED ACTIONS:</div>
                            {readiness.prompts.map((prompt, i) => (
                               <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: COLORS.text, background: COLORS.bg, padding: 10, borderRadius: 8 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.amber, marginTop: 6, flexShrink: 0 }} />
                                  <span>{prompt}</span>
                               </div>
                            ))}
                         </div>
                      )}
                   </div>
                </div>
              </div>
            )}

            {/* ═══ FEEDBACK / REVIEWS SECTION ═══ */}
            {currentUser.role !== 'member' && (
              <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 20, padding: 24 }}>
                <SectionHeader 
                  icon={MessageSquare} 
                  title="Feedback & Reviews" 
                  subtitle="Your performance review history"
                  color={COLORS.violet}
                  action={
                    <button onClick={() => navigate('/performance')} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                      borderRadius: 8, padding: "6px 14px",
                      fontSize: 11, fontWeight: 700, color: COLORS.muted, cursor: "pointer",
                    }}>
                      My Reviews <ArrowRight size={12} />
                    </button>
                  }
                />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
                  {/* Self Feedback Status */}
                  <div style={{ padding: "16px", background: COLORS.bg, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <FileText size={14} color={COLORS.accent} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Self Feedback</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>
                      {stats.submittedReviews > 0 ? 'Submitted' : 'Pending'}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.subtle, marginTop: 4 }}>
                      {stats.submittedReviews}/{stats.totalReviews} forms completed
                    </div>
                  </div>

                  {/* Manager Feedback Status */}
                  <div style={{ padding: "16px", background: COLORS.bg, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <UserCheck size={14} color={COLORS.emerald} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Manager Review</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>
                      {stats.pendingReviews > 0 ? `${stats.pendingReviews} Pending` : 'All Done'}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.subtle, marginTop: 4 }}>
                      Evaluator assessments
                    </div>
                  </div>

                  {/* Last Rating */}
                  <div style={{ padding: "16px", background: COLORS.bg, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Star size={14} color={COLORS.amber} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Last Rating</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>
                      {stats.lastReviewRating
                        ? stats.lastReviewRating.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.subtle, marginTop: 4 }}>
                      Most recent cycle
                    </div>
                  </div>
                </div>

                {/* Review History */}
                {performanceForms.length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Review History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {performanceForms.slice(0, 4).map((form, idx) => (
                        <div 
                          key={form.id || idx} 
                          onClick={() => navigate(`/performance/form/${form.id}`)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "10px 14px", borderRadius: 10,
                            border: `1px solid ${COLORS.border}`, cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${COLORS.violet}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <ClipboardCheck size={13} color={COLORS.violet} />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                                {form.cycle_name || form.review_cycle?.name || `Review #${form.id}`}
                              </div>
                              <div style={{ fontSize: 10, color: COLORS.subtle }}>
                                {form.submitted_at ? `Submitted ${new Date(form.submitted_at).toLocaleDateString()}` : 'Not submitted'}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <StatusPill status={form.submitted_at ? 'submitted' : 'pending'} size="sm" />
                            <ChevronRight size={14} color={COLORS.subtle} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {performanceForms.length === 0 && (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <MessageSquare size={32} color={COLORS.subtle} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 12, color: COLORS.muted }}>No review forms assigned yet</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Right Column ─── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* ═══ PERFORMANCE SNAPSHOT ═══ */}
            <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 20, padding: 24 }}>
              <SectionHeader icon={BarChart3} title="Performance Snapshot" color={COLORS.emerald} />
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Completion Ring */}
                <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px", background: COLORS.bg, borderRadius: 14 }}>
                  <div style={{ position: "relative", width: 64, height: 64 }}>
                    <svg width={64} height={64} viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={32} cy={32} r={26} fill="none" stroke={COLORS.border} strokeWidth={6} />
                      <circle cx={32} cy={32} r={26} fill="none" stroke={COLORS.emerald} strokeWidth={6}
                        strokeDasharray={`${(stats.avgCompletion / 100) * 163.36} 163.36`}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dasharray 1s ease" }}
                      />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>{stats.avgCompletion}%</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>Overall Completion</div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{stats.completed} of {stats.total} goals completed</div>
                  </div>
                </div>

                {/* Stat Bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Active", count: stats.activeGoals, total: stats.total, color: COLORS.accent },
                    { label: "Completed", count: stats.completed, total: stats.total, color: COLORS.emerald },
                    { label: "At Risk", count: stats.atRisk, total: stats.total, color: COLORS.rose },
                    { label: "Pending Approval", count: stats.pendingApprovals, total: stats.total, color: COLORS.amber },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted }}>{item.label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{item.count}</span>
                      </div>
                      <ProgressBar progress={item.total > 0 ? (item.count / item.total) * 100 : 0} color={item.color} height={4} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ PROBATION CARD (if applicable) ═══ */}
            {myProbation && (
              <div style={{
                background: `linear-gradient(135deg, ${COLORS.rose}08, ${COLORS.amber}08)`,
                border: `1.5px solid ${COLORS.rose}25`,
                borderRadius: 20, padding: 24,
              }}>
                <SectionHeader icon={ShieldAlert} title="Probation Status" color={COLORS.rose} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>Status</span>
                    <StatusPill status={myProbation.status || 'active'} />
                  </div>
                  {myProbation.reason && (
                    <div style={{ fontSize: 12, color: COLORS.muted, padding: "10px 12px", background: "rgba(255,255,255,0.6)", borderRadius: 10 }}>
                      <span style={{ fontWeight: 700 }}>Reason:</span> {myProbation.reason}
                    </div>
                  )}
                  <button onClick={() => navigate('/probation')} style={{
                    background: COLORS.rose, color: "#fff", border: "none",
                    borderRadius: 10, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    View Details <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}

            </div>
          </div>
        </div>
      </Layout>
  );
}

/* ──────────────────────────── Goal Table Row ──────────────────────────── */

function GoalRow({ goal, isLast, navigate }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const approvalStatus = goal.status === GoalStatus.DRAFT ? 'not_submitted'
    : goal.status === GoalStatus.PENDING_APPROVAL ? 'pending'
    : goal.status === GoalStatus.REJECTED ? 'rejected'
    : 'approved';

  return (
    <tr
      onClick={() => navigate(`/goals/${goal.id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: "pointer",
        background: isHovered ? `${COLORS.accent}04` : "transparent",
        transition: "background 0.15s ease",
      }}
    >
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`, maxWidth: 200 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {goal.title}
        </div>
        {goal.description && (
          <div style={{ fontSize: 10, color: COLORS.subtle, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
            {goal.description}
          </div>
        )}
      </td>
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}` }}>
        <LevelPill level={goal.goal_type || goal.level} />
      </td>
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{goal.weightage || '—'}%</span>
      </td>
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}`, minWidth: 120 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProgressBar progress={goal.completion_pct || 0} color={
            (goal.completion_pct || 0) >= 75 ? COLORS.emerald 
            : (goal.completion_pct || 0) >= 40 ? COLORS.amber 
            : COLORS.rose
          } />
          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.text, minWidth: 28, textAlign: "right" }}>
            {goal.completion_pct || 0}%
          </span>
        </div>
      </td>
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}` }}>
        <StatusPill status={goal.status} size="sm" />
      </td>
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}` }}>
        <StatusPill status={approvalStatus} size="sm" />
      </td>
      <td style={{ padding: "12px", borderBottom: isLast ? "none" : `1px solid ${COLORS.border}` }}>
        <ChevronRight size={14} color={COLORS.subtle} />
      </td>
    </tr>
  );
}
