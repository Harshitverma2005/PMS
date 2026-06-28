import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { createAchievement, getAchievements } from '../api/achievements';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'technical_impact', label: 'Technical Impact', color: 'bg-blue-100 text-blue-700' },
  { value: 'cost_savings', label: 'Cost Savings', color: 'bg-green-100 text-green-700' },
  { value: 'delivery', label: 'Delivery', color: 'bg-orange-100 text-orange-700' },
  { value: 'leadership', label: 'Leadership', color: 'bg-purple-100 text-purple-700' },
  { value: 'collaboration', label: 'Collaboration', color: 'bg-pink-100 text-pink-700' },
];

const getCategoryStyle = (cat) => CATEGORIES.find(c => c.value === cat)?.color || 'bg-gray-100 text-gray-700';
const getCategoryLabel = (cat) => CATEGORIES.find(c => c.value === cat)?.label || cat;

export default function Achievements() {
  const { user } = useAuthStore();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', category: 'technical_impact',
    evidence_url: '', goal_id: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    loadAchievements();
    apiClient.get('/goals/').then(res => setGoals(res.data || [])).catch(() => {});
  }, []);

  const loadAchievements = async () => {
    setLoading(true);
    try {
      const res = await getAchievements();
      setAchievements(res.data || []);
    } catch {
      toast.error('Failed to load achievements');
    } finally {
      setLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (form.title.length > 200) errs.title = 'Title must be at most 200 characters';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (form.description.length > 2000) errs.description = 'Max 2000 characters';
    if (form.evidence_url && !form.evidence_url.startsWith('http')) {
      errs.evidence_url = 'Must be a valid HTTP/HTTPS URL';
    }
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        evidence_url: form.evidence_url || null,
        goal_id: form.goal_id ? parseInt(form.goal_id) : null,
      };
      const res = await createAchievement(payload);
      setAchievements([res.data, ...achievements]);
      setShowForm(false);
      setForm({ title: '', description: '', category: 'technical_impact', evidence_url: '', goal_id: '' });
      setErrors({});
      toast.success('Achievement logged! 🌟');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to log achievement');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Achievements</h1>
            <p className="text-muted-foreground mt-1">Your immutable, append-only evidence log</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? '✕ Cancel' : '+ Log Achievement'}
          </button>
        </div>

        {/* Log Achievement Form */}
        {showForm && (
          <div className="card mb-8 border-primary/30">
            <h2 className="text-lg font-semibold mb-4">Log New Achievement</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Title *</label>
                <input
                  className={`input ${errors.title ? 'border-red-400' : ''}`}
                  maxLength={200}
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="e.g. Reduced API latency by 40%"
                />
                {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Description *</label>
                <textarea
                  className={`input h-24 resize-none ${errors.description ? 'border-red-400' : ''}`}
                  maxLength={2000}
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Describe the impact and what you did..."
                />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Category *</label>
                  <select className="input" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Evidence URL (optional)</label>
                  <input
                    className={`input ${errors.evidence_url ? 'border-red-400' : ''}`}
                    value={form.evidence_url}
                    onChange={e => setForm({...form, evidence_url: e.target.value})}
                    placeholder="https://..."
                  />
                  {errors.evidence_url && <p className="text-xs text-red-500 mt-1">{errors.evidence_url}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Linked Goal (optional)</label>
                  <select className="input" value={form.goal_id} onChange={e => setForm({...form, goal_id: e.target.value})}>
                    <option value="">None</option>
                    {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Logging...' : '⭐ Log Achievement'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Achievements Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading achievements...</div>
        ) : achievements.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">🏆</div>
            <h3 className="text-lg font-semibold mb-2">No achievements yet</h3>
            <p className="text-muted-foreground text-sm">Start logging your work wins to build your evidence trail</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {achievements.map(a => (
              <div key={a.id} className="card group">
                <div className="flex items-start justify-between mb-3">
                  <span className={`badge text-xs font-medium px-2 py-0.5 rounded-full ${getCategoryStyle(a.category)}`}>
                    {getCategoryLabel(a.category)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(a.created_at)}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {a.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-3 mb-3">{a.description}</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {a.evidence_url && (
                    <a
                      href={a.evidence_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      🔗 Evidence
                    </a>
                  )}
                  {a.goal_id && (
                    <span className="text-xs text-muted-foreground">🎯 Linked to goal #{a.goal_id}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
