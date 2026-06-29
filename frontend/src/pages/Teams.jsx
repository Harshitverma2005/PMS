import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Edit, Trash2, Users as UsersIcon,
  ShieldCheck, ArrowUpRight, ChevronRight,
  Target, Activity, MoreHorizontal, Zap, RefreshCw, AlertTriangle
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { teamService, userService } from '../api';
import toast from 'react-hot-toast';

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

function unwrapList(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

export default function Teams() {
  const currentUser = useAuthStore((s) => s.user);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const isAdmin = currentUser?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, userRes] = await Promise.all([
        teamService.getAll(),
        userService.getAll().catch(() => ({ data: [] })),
      ]);
      let teamList = unwrapList(teamRes);
      const userList = unwrapList(userRes);
      setUsers(userList);

      // Manager view: only teams they lead
      if (currentUser?.role === 'manager') {
        teamList = teamList.filter(t => t.manager_id === currentUser.id);
      }
      setTeams(teamList);
    } catch (err) {
      toast.error('Failed to load teams');
      setTeams([]);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [currentUser, fetchData]);

  const handleDelete = async (id) => {
    if (!confirm('Dissolve this team? This will unassign all members.')) return;
    try {
      await teamService.delete(id);
      toast.success('Team dissolved');
      fetchData();
    } catch (err) {
      toast.error('Failed to dissolve team');
    }
  };

  // A manager only "sees" their own direct reports; an admin sees the whole team roster.
  const membersOf = (team) =>
    currentUser?.role === 'manager'
      ? users.filter(u => u.manager_id === currentUser.id && u.team_id === team.id)
      : users.filter(u => u.team_id === team.id);

  const memberCount = (team) => membersOf(team).length;

  const totalVisibleMembers = currentUser?.role === 'manager'
    ? users.filter(u => u.manager_id === currentUser.id).length
    : users.length;

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <ShieldCheck size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You do not have permission to view Organizational Squads.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page active" id="page-teams">

        {/* Header */}
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-title">Squads & Brigades</div>
            <div className="page-desc">Organisational structure and cross-functional performance tracking</div>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditingTeam(null); setShowModal(true); }} className="btn btn-primary">
              <Plus size={16} style={{marginRight: '8px'}} /> Form New Squad
            </button>
          )}
        </div>

        {/* Global Performance Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: '24px', marginBottom: '32px' }}>
          {[
            { label: "Active Squads", value: teams.length, icon: UsersIcon, color: 'var(--primary)' },
            { label: "Total Members", value: totalVisibleMembers, icon: ShieldCheck, color: '#10B981' },
            { label: "Managed Teams", value: teams.filter(t => t.manager_id).length, icon: Activity, color: '#8B5CF6' },
          ].map((stat, i) => (
            <div key={i} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: '16px', flexDirection: 'row' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${stat.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <stat.icon size={18} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>{stat.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)' }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Team Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: '24px' }}>
          {(Array.isArray(teams) ? teams : []).map((team) => {
            const count = memberCount(team);
            const teamMembers = membersOf(team);
            const managerName = team.manager?.name || users.find(u => u.id === team.manager_id)?.name || "Unassigned";

            return (
              <div key={team.id}
                className="card"
                style={{
                  padding: '24px', display: "flex", flexDirection: "column", gap: '20px',
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: '4px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>{team.name}</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>LEAD:</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>{managerName}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: '4px' }}>
                    {isAdmin && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); setEditingTeam(team); setShowModal(true); }}
                          className="btn btn-secondary btn-sm" style={{ padding: '6px' }}>
                          <Edit size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(team.id); }}
                          className="btn btn-secondary btn-sm" style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {teamMembers.slice(0, 3).map((m, i) => (
                      <div key={m.id} style={{
                        width: '24px', height: '24px', borderRadius: "50%",
                        background: 'var(--bg)', border: '2px solid var(--card-bg)',
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                        marginLeft: i === 0 ? 0 : '-8px',
                        zIndex: 3 - i,
                      }}>{m.name?.charAt(0)}</div>
                    ))}
                    {count > 3 && (
                      <div style={{
                        width: '24px', height: '24px', borderRadius: "50%",
                        background: 'var(--bg)', border: '2px solid var(--card-bg)',
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)',
                        marginLeft: '-8px', zIndex: 0,
                      }}>+{count - 3}</div>
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '8px' }}>{count} Members</span>
                  </div>
                  <ChevronRight size={14} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>

        {!loading && teams.length === 0 && (
          <div style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '64px', textAlign: "center", color: 'var(--text-muted)' }}>
            No squads formed yet.
          </div>
        )}
        {loading && (
          <div style={{ padding: '64px', textAlign: "center", color: 'var(--text-muted)' }}>
            Loading squads…
          </div>
        )}

        {showModal && (
          <TeamModal
            team={editingTeam}
            users={users}
            takenManagerIds={new Set(teams.filter(t => t.manager_id && t.id !== editingTeam?.id).map(t => t.manager_id))}
            onClose={() => { setShowModal(false); setEditingTeam(null); }}
            onSuccess={() => { setShowModal(false); setEditingTeam(null); fetchData(); }}
          />
        )}
      </div>
    </Layout>
  );
}

function TeamModal({ team, users, takenManagerIds, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: team?.name || '',
    manager_id: team?.manager_id || '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Only managers who don't already lead a team are eligible (one team per manager).
  // The team being edited keeps its current lead as an option.
  const eligibleLeads = (Array.isArray(users) ? users : []).filter(u =>
    (u.role === 'manager' || u.role === 'admin') &&
    (!takenManagerIds?.has(u.id) || u.id === team?.manager_id)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name: formData.name, manager_id: formData.manager_id ? Number(formData.manager_id) : null };
    try {
      if (team) {
        await teamService.update(team.id, payload);
        toast.success('Squad updated');
      } else {
        await teamService.create(payload);
        toast.success('Squad commissioned');
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : (team ? 'Failed to update squad' : 'Failed to create squad'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: COLORS.surface, borderRadius: 20, padding: 32,
        width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 24,
        boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
      }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{team ? 'Reconfigure Squad' : 'Commission New Squad'}</h3>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Define administrative grouping and leadership · one lead per team</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Squad Name</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, outline: "none" }} required
              placeholder="e.g. Engineering Brigade" />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>Operational Lead (Manager)</label>
            <select value={formData.manager_id} onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
              style={{ padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, outline: "none", background: "#fff" }}>
              <option value="">No Lead assigned</option>
              {eligibleLeads.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "12px", borderRadius: 11, border: `1.5px solid ${COLORS.border}`, background: "#fff", color: COLORS.muted, fontWeight: 700, cursor: "pointer" }}>
              Dismiss
            </button>
            <button type="submit" disabled={submitting}
              style={{ flex: 2, padding: "12px", borderRadius: 11, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : 'Confirm Squad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
