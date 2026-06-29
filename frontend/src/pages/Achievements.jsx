import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { getAchievements, createAchievement } from '../api/achievements';
import { userService } from '../api';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

const CATEGORIES = [
  { value: 'technical_impact', label: 'Technical Impact' },
  { value: 'cost_savings', label: 'Cost Savings' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'collaboration', label: 'Collaboration' },
];
const getCategoryLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat;

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function Achievements() {
  const currentUser = useAuthStore((s) => s.user);
  const isManager = ['manager', 'admin'].includes(currentUser?.role);

  const [achievements, setAchievements] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'technical_impact', evidence_url: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Managers pick which employee to log/view for (direct reports; admin -> all members).
  useEffect(() => {
    if (!isManager) return;
    (async () => {
      try {
        const res = await userService.getAll();
        const all = unwrapList(res.data);
        // Admin recognises employees (members), excluding legacy @opstree.com seed
        // accounts; a manager only their direct reports.
        const isLegacy = (u) => (u.email || '').endsWith('@opstree.com');
        const team = (currentUser?.role === 'admin'
          ? all.filter(u => u.role === 'member' && u.is_active !== false && !isLegacy(u))
          : all.filter(u => u.manager_id === currentUser.id)
        ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setReports(team);
        if (team.length) setSelectedEmployee(String(team[0].id));
      } catch {
        toast.error('Failed to load employees');
      }
    })();
  }, [isManager, currentUser]);

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    try {
      if (isManager) {
        if (!selectedEmployee) { setAchievements([]); return; }
        const res = await getAchievements({ employee_id: Number(selectedEmployee) });
        setAchievements(unwrapList(res.data));
      } else {
        const res = await getAchievements();
        setAchievements(unwrapList(res.data).filter(a => a.employee_id === currentUser?.id));
      }
    } catch (err) {
      toast.error('Failed to load achievements');
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  }, [isManager, selectedEmployee, currentUser]);

  useEffect(() => { loadAchievements(); }, [loadAchievements]);

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (form.title.length > 200) errs.title = 'Title must be at most 200 characters';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (form.description.length > 2000) errs.description = 'Max 2000 characters';
    if (form.evidence_url && !form.evidence_url.startsWith('http')) errs.evidence_url = 'Must be a valid HTTP/HTTPS URL';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) { toast.error('Select an employee first'); return; }
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await createAchievement({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        evidence_url: form.evidence_url || null,
        employee_id: Number(selectedEmployee),
      });
      setShowForm(false);
      setForm({ title: '', description: '', category: 'technical_impact', evidence_url: '' });
      setErrors({});
      toast.success('Achievement logged for the employee 🌟');
      await loadAchievements();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to log achievement');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const selectedName = reports.find(r => String(r.id) === String(selectedEmployee))?.name;

  return (
    <Layout>
      <div className="page active" id="page-achievements">
        <div className="page-header flex justify-between items-center">
          <div>
            <div className="page-title">Achievements</div>
            <div className="page-desc">
              {isManager
                ? 'Recognise your team — logged achievements are read-only and appear in the employee’s timeline'
                : 'Your immutable, append-only recognition log'}
            </div>
          </div>
          {isManager && reports.length > 0 && (
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? '✕ Cancel' : '+ Log Achievement'}
            </button>
          )}
        </div>

        {/* Manager: choose whose achievements to view / log for */}
        {isManager && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Employee</span>
              {reports.length === 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{currentUser?.role === 'admin' ? 'No employees found.' : 'You have no direct reports.'}</span>
              ) : (
                <select
                  value={selectedEmployee}
                  onChange={e => { setSelectedEmployee(e.target.value); setShowForm(false); }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', fontWeight: 600, minWidth: '220px' }}
                >
                  {reports.map(r => <option key={r.id} value={r.id}>{r.name} ({r.email})</option>)}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Log form (managers only) */}
        {isManager && showForm && selectedEmployee && (
          <div className="card mb-24" style={{ border: '1px solid var(--primary-light)' }}>
            <div className="card-header">
              <div className="card-header-title">Log Achievement for {selectedName}</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Title *</label>
                  <input
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: errors.title ? '1px solid #DC2626' : '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px' }}
                    maxLength={200} value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Reduced API latency by 40%"
                  />
                  {errors.title && <p style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>{errors.title}</p>}
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Description *</label>
                  <textarea
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: errors.description ? '1px solid #DC2626' : '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px', minHeight: '100px', resize: 'none' }}
                    maxLength={2000} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe the impact and what they did..."
                  />
                  {errors.description && <p style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>{errors.description}</p>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Category *</label>
                    <select style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px' }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Evidence URL (optional)</label>
                    <input
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: errors.evidence_url ? '1px solid #DC2626' : '1px solid var(--border)', background: 'var(--bg)', fontSize: '13px' }}
                      value={form.evidence_url}
                      onChange={e => setForm({ ...form, evidence_url: e.target.value })}
                      placeholder="https://..."
                    />
                    {errors.evidence_url && <p style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>{errors.evidence_url}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn btn-primary">
                    {submitting ? 'Logging...' : '⭐ Log Achievement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Read-only note for employees */}
        {!isManager && (
          <div className="card" style={{ marginBottom: '16px', background: 'var(--primary-light)', border: 'none' }}>
            <div className="card-body" style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
              These achievements are recorded by your manager and shown in your performance timeline. They are read-only.
            </div>
          </div>
        )}

        {/* Achievements grid */}
        {loading ? (
          <div className="card text-center" style={{ padding: '60px 0' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading achievements...</div>
          </div>
        ) : achievements.length === 0 ? (
          <div className="card text-center" style={{ padding: '60px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '8px' }}>No achievements yet</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {isManager ? `Log ${selectedName || 'this employee'}’s wins to build their evidence trail` : 'Your manager hasn’t logged any achievements yet'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {achievements.map(a => (
              <div key={a.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-12">
                    <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>{getCategoryLabel(a.category)}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(a.created_at)}</span>
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{a.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>{a.description}</div>
                  {a.evidence_url && (
                    <a href={a.evidence_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>🔗 Evidence</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
