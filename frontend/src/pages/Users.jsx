import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Edit, Trash2, UserPlus, Search, Shield,
  Users as UsersIcon, ChevronUp, ChevronDown, ArrowUpDown
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/auth';
import { userService, teamService } from '../api';
import { UserRole } from '../constants/enums';
import { formatDate } from '../utils/format';
import toast from 'react-hot-toast';

const COLORS = {
  bg: "#F5F4F0", surface: "#FFFFFF", card: "#FFFFFF", border: "#E4E2DC",
  accent: "#2563EB", accentDim: "#1D4ED8", emerald: "#059669", amber: "#D97706",
  rose: "#DC2626", violet: "#7C3AED", text: "#111111", muted: "#6B7280", subtle: "#9CA3AF",
};

function unwrapList(res) {
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

const roleColor = (role) =>
  role === 'admin' ? '#7C3AED' : (role === 'manager' ? 'var(--primary)' : '#10B981');
const roleBg = (role) =>
  role === 'admin' ? 'rgba(124,58,237,0.1)' : (role === 'manager' ? 'var(--primary-light)' : 'rgba(16,185,129,0.1)');

export default function Users() {
  const currentUser = useAuthStore((s) => s.user);
  const [allUsers, setAllUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Filters / sorting
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const isAdmin = currentUser?.role === 'admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, teamsRes] = await Promise.all([
        userService.getAll(),
        teamService.getAll().catch(() => ({ data: [] })),
      ]);
      setAllUsers(unwrapList(usersRes));
      setTeams(unwrapList(teamsRes));
    } catch (err) {
      toast.error('Failed to load users');
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'manager') fetchData();
    else setLoading(false);
  }, [currentUser, fetchData]);

  const teamName = useCallback(
    (id) => teams.find(t => t.id === id)?.name || null,
    [teams]
  );
  const userById = useCallback((id) => allUsers.find(u => u.id === id), [allUsers]);

  const handleDelete = async (id) => {
    if (!confirm('Permanently remove this user? This action cannot be undone.')) return;
    try {
      await userService.delete(id);
      toast.success('User removed from system');
      fetchData();
    } catch (err) {
      toast.error('Failed to remove user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await userService.update(user.id, { is_active: !user.is_active });
      toast.success(user.is_active ? 'User deactivated' : 'User activated');
      fetchData();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const toggleSort = (key) =>
    setSort((s) => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  // Scope: admin sees everyone, manager sees direct reports
  const scoped = useMemo(() => {
    if (currentUser?.role === 'manager') return allUsers.filter(u => u.manager_id === currentUser.id);
    return allUsers;
  }, [allUsers, currentUser]);

  const visibleTeamIds = useMemo(
    () => [...new Set(scoped.map(u => u.team_id).filter(Boolean))],
    [scoped]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = scoped.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (teamFilter !== 'all' && String(u.team_id) !== String(teamFilter)) return false;
      if (!q) return true;
      return [u.name, u.email, u.role, u.department]
        .filter(Boolean).some(v => v.toLowerCase().includes(q));
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let av, bv;
      if (sort.key === 'joined') { av = a.date_of_joining || ''; bv = b.date_of_joining || ''; }
      else { av = (a[sort.key] || '').toString().toLowerCase(); bv = (b[sort.key] || '').toString().toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
    return list;
  }, [scoped, search, roleFilter, teamFilter, sort]);

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <Shield size={48} className="text-gray-300 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2">You do not have permission to view the User Directory.</p>
        </div>
      </Layout>
    );
  }

  const SortHeader = ({ label, k, align = 'left' }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : (sort.dir === 'asc' ? ChevronUp : ChevronDown);
    return (
      <th style={{ textAlign: align, padding: "14px 24px", fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>
        <button onClick={() => toggleSort(k)}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: active ? 'var(--text)' : 'var(--text-muted)', fontWeight: 700, fontSize: '12px', textTransform: "uppercase", fontFamily: "inherit" }}>
          {label} <Icon size={13} />
        </button>
      </th>
    );
  };

  const selectStyle = { padding: "8px 12px", border: '1px solid var(--border)', borderRadius: '10px', background: '#fff', fontSize: '13px', fontWeight: 600, color: 'var(--text)', outline: "none", cursor: "pointer" };

  return (
    <Layout>
      <div className="page active" id="page-users">
        {/* Header */}
        <div className="page-header flex justify-between items-center">
          <div>
            <div className="page-title">User Directory</div>
            <div className="page-desc">Manage roles, access, and team assignments across the platform</div>
          </div>
          {isAdmin && (
            <button onClick={() => { setEditingUser(null); setShowModal(true); }} className="btn btn-primary">
              <UserPlus size={16} style={{ marginRight: '8px' }} /> Add New User
            </button>
          )}
        </div>

        {/* Toolbar: search + filters */}
        <div style={{ display: "flex", alignItems: "center", gap: '12px', padding: "12px 16px", background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', marginBottom: '24px', flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220 }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, role, or department..."
              style={{ border: "none", background: "none", fontSize: '13px', flex: 1, outline: "none", color: 'var(--text)' }}
            />
          </div>

          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>

          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={selectStyle}>
            <option value="all">All teams</option>
            {visibleTeamIds.map(tid => (
              <option key={tid} value={tid}>{teamName(tid) || `Team #${tid}`}</option>
            ))}
          </select>

          <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>{filtered.length} USERS</span>
        </div>

        {/* Table */}
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  <SortHeader label="User Details" k="name" />
                  <SortHeader label="Role" k="role" />
                  <th style={{ textAlign: "left", padding: "14px 24px", fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Department</th>
                  <th style={{ textAlign: "left", padding: "14px 24px", fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Manager</th>
                  <SortHeader label="Joined" k="joined" />
                  <th style={{ textAlign: "left", padding: "14px 24px", fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Status</th>
                  {isAdmin && <th style={{ textAlign: "right", padding: "14px 24px", fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: "uppercase" }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}
                    onClick={() => { if (isAdmin) { setEditingUser(user); setShowModal(true); } }}
                    style={{ borderBottom: '1px solid var(--border)', transition: "background 0.2s", cursor: isAdmin ? "pointer" : "default" }}
                    className="user-row"
                  >
                    <td style={{ padding: "16px 24px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: '14px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: roleColor(user.role), display: "flex", alignItems: "center", justifyContent: "center", fontSize: '14px', fontWeight: 700, color: "#fff" }}>{user.name?.charAt(0)?.toUpperCase()}</div>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{user.name}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <div className="badge" style={{ background: roleBg(user.role), color: roleColor(user.role), textTransform: "capitalize" }}>{user.role}</div>
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      {user.department ? (
                        <div style={{ display: "flex", alignItems: "center", gap: '8px' }}>
                          <UsersIcon size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{user.department}</span>
                          {teamName(user.team_id) && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· {teamName(user.team_id)}</span>}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No assignment</span>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                        {userById(user.manager_id)?.name || "Unmanaged"}
                      </span>
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: '13px', color: 'var(--text-muted)' }}>
                      {user.date_of_joining ? formatDate(user.date_of_joining) : '—'}
                    </td>
                    <td style={{ padding: "16px 24px" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (isAdmin) handleToggleActive(user); }}
                        disabled={!isAdmin}
                        title={isAdmin ? 'Toggle active status' : ''}
                        className="badge"
                        style={{
                          background: user.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)',
                          color: user.is_active ? '#059669' : '#DC2626',
                          border: "none", cursor: isAdmin ? "pointer" : "default", fontFamily: "inherit",
                        }}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: "16px 24px", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: '8px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setEditingUser(user); setShowModal(true); }}
                            className="btn btn-secondary btn-sm" style={{ padding: '6px' }}>
                            <Edit size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDelete(user.id); }}
                            className="btn btn-secondary btn-sm" style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && filtered.length === 0 && (
              <div style={{ padding: '64px', textAlign: "center", color: 'var(--text-muted)' }}>
                {search || roleFilter !== 'all' || teamFilter !== 'all'
                  ? 'No users match your filters.'
                  : (currentUser?.role === 'manager' ? 'No direct reports found.' : 'No users found.')}
              </div>
            )}
            {loading && (
              <div style={{ padding: '64px', textAlign: "center", color: 'var(--text-muted)' }}>Loading users…</div>
            )}
            <style>{`.user-row:hover { background: var(--bg); }`}</style>
          </div>
        </div>

        {showModal && (
          <UserModal
            user={editingUser}
            users={allUsers}
            teams={teams}
            onClose={() => setShowModal(false)}
            onSuccess={() => { setShowModal(false); fetchData(); }}
          />
        )}
      </div>
    </Layout>
  );
}

function UserModal({ user, users, teams, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || UserRole.EMPLOYEE,
    manager_id: user?.manager_id || '',
    team_id: user?.team_id || '',
    department: user?.department || '',
    date_of_joining: user?.date_of_joining || '',
    is_active: user?.is_active ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      manager_id: formData.manager_id ? Number(formData.manager_id) : null,
      team_id: formData.team_id ? Number(formData.team_id) : null,
      department: formData.department || null,
      date_of_joining: formData.date_of_joining || null,
      is_active: formData.is_active,
    };
    if (formData.password) payload.password = formData.password;
    try {
      if (user) {
        await userService.update(user.id, payload);
        toast.success('User record updated');
      } else {
        await userService.create(payload);
        toast.success('New user provisioned');
      }
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : (user ? 'Failed to update user' : 'Failed to create user'));
    } finally {
      setSubmitting(false);
    }
  };

  const label = (t) => <label style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase" }}>{t}</label>;
  const inputStyle = { padding: "10px 14px", border: `1.5px solid ${COLORS.border}`, borderRadius: 10, fontSize: 13, outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: COLORS.surface, borderRadius: 20, padding: 32, width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{user ? "Update User" : "Provision New Access"}</h3>
          <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>Configuration for platform identity and roles</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {label("Full Name")}
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={inputStyle} required />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {label("Email")}
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={inputStyle} required />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {label(user ? "New Password (leave blank to keep)" : "Password")}
            <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} style={inputStyle} required={!user} placeholder={user ? "••••••••" : ""} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {label("Role")}
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} style={{ ...inputStyle, background: "#fff" }}>
                {Object.values(UserRole).map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {label("Department")}
              <input type="text" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} style={inputStyle} placeholder="e.g. Engineering" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {label("Manager")}
              <select value={formData.manager_id} onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })} style={{ ...inputStyle, background: "#fff" }}>
                <option value="">No Manager</option>
                {(Array.isArray(users) ? users : []).filter(u => u.id !== user?.id && (u.role === 'manager' || u.role === 'admin')).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {label("Team")}
              {formData.role === 'member' ? (
                <input
                  type="text" disabled
                  value={(() => {
                    const mgr = (users || []).find(u => String(u.id) === String(formData.manager_id));
                    const t = (teams || []).find(tm => tm.id === mgr?.team_id);
                    return t ? t.name : 'Follows manager';
                  })()}
                  style={{ ...inputStyle, background: COLORS.bg, color: COLORS.muted }}
                  title="Members inherit their manager's team"
                />
              ) : (
                <select value={formData.team_id} onChange={(e) => setFormData({ ...formData, team_id: e.target.value })} style={{ ...inputStyle, background: "#fff" }}>
                  <option value="">No Team</option>
                  {(Array.isArray(teams) ? teams : []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {label("Date of Joining")}
              <input type="date" value={formData.date_of_joining} onChange={(e) => setFormData({ ...formData, date_of_joining: e.target.value })} style={inputStyle} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: COLORS.text, padding: "10px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} style={{ width: 16, height: 16, accentColor: COLORS.accent }} />
              Active account
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 11, border: `1.5px solid ${COLORS.border}`, background: "#fff", color: COLORS.muted, fontWeight: 700, cursor: "pointer" }}>Dismiss</button>
            <button type="submit" disabled={submitting} style={{ flex: 2, padding: "12px", borderRadius: 11, border: "none", background: COLORS.accent, color: "#fff", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : 'Confirm & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
