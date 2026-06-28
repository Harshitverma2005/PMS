import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserCheck, Clock, Calendar, AlertTriangle, 
  CheckCircle2, ChevronRight, Zap, RefreshCw,
  Search, Filter, ArrowUpRight, BarChart3,
  MoreHorizontal, FileText, UserMinus, ShieldCheck
} from 'lucide-react';
import Layout from '../components/Layout';
import { probationService, userService } from '../api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';

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

export default function Probation() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [probations, setProbations] = useState([]);
  const [users, setUsers] = useState({});
  const [error, setError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError(false);
    setLoading(true);
    try {
      const [probRes, usersRes] = await Promise.all([
        probationService.getAll(),
        userService.getAll()
      ]);
      setProbations(Array.isArray(probRes.data) ? probRes.data : []);
      
      // Create users lookup map
      const usersMap = {};
      if (Array.isArray(usersRes.data)) {
        usersRes.data.forEach(user => {
          usersMap[user.id] = user;
        });
      }
      setUsers(usersMap);
    } catch (error) {
      setError(true);
      toast.error('Failed to load probation data');
    } finally {
      setLoading(false);
    }
  };

  const handleScanTriggers = async () => {
    try {
      // In a real app, this would be a specific admin endpoint
      toast.success('Milestone scan initiated');
      loadData();
    } catch (e) {
      toast.error('Scan failed');
    }
  };

  const filteredProbations = probations.filter(p => {
    const employee = users[p.employee_id];
    return employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
           p.calculated_status?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getStatusColor = (status) => {
    const s = status?.toLowerCase();
    if (s?.includes('on track')) return COLORS.emerald;
    if (s?.includes('overdue')) return COLORS.rose;
    if (s?.includes('pending') || s?.includes('due')) return COLORS.amber;
    if (s?.includes('completed')) return COLORS.accent;
    return COLORS.muted;
  };

  if (loading) return (
    <Layout>
      <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, animation: "spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.muted }}>Synchronizing tracker…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        
        {/* Header Section */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: COLORS.text, letterSpacing: "-0.04em" }}>
              Probation Milestone Tracker
            </h1>
            <p style={{ fontSize: 14, color: COLORS.muted, marginTop: 4 }}>
              Systematic oversight of employee onboarding and cultural integration loops
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {currentUser?.role === 'admin' && (
              <button onClick={handleScanTriggers} style={{
                background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                color: COLORS.text, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                transition: "all 0.2s"
              }}>
                <Zap size={16} color={COLORS.amber} /> Scan Milestones
              </button>
            )}
            <button style={{
              background: COLORS.accent, border: "none",
              padding: "10px 18px", borderRadius: 12, fontSize: 13, fontWeight: 700,
              color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              boxShadow: `0 8px 16px ${COLORS.accent}25`
            }}>
              <Calendar size={16} /> Schedule Export
            </button>
          </div>
        </div>

        {/* Stats Summary Panel */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {[
            { label: "Active Tracking", value: probations.length, icon: UserCheck, color: COLORS.accent },
            { label: "Overdue Actions", value: probations.filter(p => p.calculated_status === 'Overdue').length, icon: AlertTriangle, color: COLORS.rose },
            { label: "Due This Week", value: probations.filter(p => p.calculated_status === 'Pending Form').length, icon: Clock, color: COLORS.amber },
            { label: "Completed Confirmations", value: probations.filter(p => p.calculated_status === 'Completed').length, icon: ShieldCheck, color: COLORS.emerald },
          ].map((stat, i) => (
            <div key={i} style={{
              background: COLORS.card, border: `1.5px solid ${COLORS.border}`,
              borderRadius: 20, padding: "20px", display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${stat.color}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <stat.icon size={20} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.text }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Tracker Table */}
        <div style={{ background: COLORS.card, border: `1.5px solid ${COLORS.border}`, borderRadius: 24, padding: "8px", display: "flex", flexDirection: "column" }}>
          
          {/* Table Toolbar */}
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ position: "relative", width: 320 }}>
              <Search size={16} color={COLORS.subtle} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input 
                type="text" 
                placeholder="Search by employee or status..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px 10px 40px", borderRadius: 12,
                  border: `1.5px solid ${COLORS.border}`, background: COLORS.bg,
                  fontSize: 13, fontWeight: 500, outline: "none", transition: "all 0.2s"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ padding: "10px 16px", borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: "#fff", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: COLORS.muted, cursor: "pointer" }}>
                <Filter size={14} /> Filter Set
              </button>
            </div>
          </div>

          {/* Actual Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: `${COLORS.bg}50` }}>
                  {["Employee", "DOJ", "Day 30", "Day 60", "Day 80", "Lifecycle Status", "Action"].map((h, i) => (
                    <th key={i} style={{
                      textAlign: "left", padding: "16px 20px", fontSize: 10, fontWeight: 800, color: COLORS.subtle,
                      textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: `1px solid ${COLORS.border}`
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProbations.map((prob) => (
                  <tr key={prob.id} style={{ transition: "all 0.15s" }} onMouseEnter={e => e.currentTarget.style.background = `${COLORS.accent}04`} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: COLORS.muted }}>
                          {users[prob.employee_id]?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{users[prob.employee_id]?.name || `Employee #${prob.employee_id}`}</div>
                          <div style={{ fontSize: 11, color: COLORS.muted }}>{users[prob.employee_id]?.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, fontWeight: 600, color: COLORS.muted }}>
                      {prob.date_of_joining}
                    </td>
                    {[30, 60, 80].map(day => {
                      const trigger = prob.triggers?.find(t => t.trigger_day === day);
                      const isDone = trigger?.status === 'submitted';
                      const isPending = trigger?.status === 'triggered';
                      return (
                        <td key={day} style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ height: 6, width: 40, background: isDone ? COLORS.emerald : isPending ? COLORS.amber : COLORS.bg, borderRadius: 3 }} />
                            <div style={{ fontSize: 10, fontWeight: 700, color: isDone ? COLORS.emerald : isPending ? COLORS.amber : COLORS.subtle }}>
                              {isDone ? 'Submitted' : isPending ? 'Pending' : 'Upcoming'}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                      <div style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 8, background: `${getStatusColor(prob.calculated_status)}12`, color: getStatusColor(prob.calculated_status), fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>
                        {prob.calculated_status || 'On Track'}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                      <button 
                        onClick={() => navigate(`/probation/${prob.employee_id}`)}
                        style={{ border: "none", background: COLORS.bg, padding: "8px 12px", borderRadius: 8, color: COLORS.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                      >
                         Fill Form <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProbations.length === 0 && (
            <div style={{ padding: "64px 0", textAlign: "center", color: COLORS.subtle }}>
               <UserCheck size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
               <div style={{ fontSize: 16, fontWeight: 700 }}>No candidates in probation cycle</div>
               <div style={{ fontSize: 13 }}>All team members have completed their integration roadmap.</div>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
