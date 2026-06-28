import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { createKudos, getKudosFeed } from '../api/kudos';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

const formatRelative = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function Kudos() {
  const { user } = useAuthStore();
  const [feed, setFeed] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ recipient_id: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadFeed(1);
    apiClient.get('/users/').then(res => setUsers(res.data || [])).catch(() => {});
  }, []);

  const loadFeed = async (pg) => {
    setLoading(true);
    try {
      const res = await getKudosFeed(pg);
      setFeed(pg === 1 ? res.data.items || [] : [...feed, ...(res.data.items || [])]);
      setTotalCount(res.data.total_count || 0);
      setPage(pg);
    } catch {
      toast.error('Failed to load kudos feed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.recipient_id) { toast.error('Please select a recipient'); return; }
    if (!form.message.trim()) { toast.error('Message is required'); return; }
    setSubmitting(true);
    try {
      const res = await createKudos({ recipient_id: parseInt(form.recipient_id), message: form.message });
      setFeed([res.data, ...feed]);
      setTotalCount(prev => prev + 1);
      setShowForm(false);
      setForm({ recipient_id: '', message: '' });
      toast.success('Kudos sent! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send kudos');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.id !== user?.id && u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Kudos Feed</h1>
            <p className="text-muted-foreground mt-1">Celebrating wins, big and small ❤️</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
            {showForm ? '✕ Cancel' : '💌 Give Kudos'}
          </button>
        </div>

        {/* Give Kudos Form */}
        {showForm && (
          <div className="card mb-8 border-pink-200">
            <h2 className="text-lg font-semibold mb-4">Give Kudos 🌟</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Recipient</label>
                <input
                  className="input mb-2"
                  placeholder="Search colleagues..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <div className="border border-border rounded-lg max-h-40 overflow-y-auto bg-card">
                    {filteredUsers.slice(0, 10).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setForm({...form, recipient_id: u.id}); setSearch(u.name); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        {u.name} <span className="text-xs text-muted-foreground">({u.role})</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.recipient_id && !search.includes(' ') && (
                  <p className="text-xs text-primary mt-1">Selected: {users.find(u => u.id === form.recipient_id)?.name}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Message (max 500 chars)</label>
                <textarea
                  className="input h-24 resize-none"
                  maxLength={500}
                  value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  placeholder="What did they do that deserves recognition?"
                />
                <p className="text-xs text-muted-foreground text-right">{form.message.length}/500</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Sending...' : '❤️ Send Kudos'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Feed */}
        {loading && feed.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Loading feed...</div>
        ) : feed.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">❤️</div>
            <h3 className="text-lg font-semibold mb-2">No kudos yet</h3>
            <p className="text-muted-foreground text-sm">Be the first to give recognition!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {feed.map(k => (
              <div key={k.id} className="card group hover:border-pink-200 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {k.sender_name?.[0] || '?'}
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">{k.sender_name}</span>
                    <span className="text-sm text-muted-foreground"> → </span>
                    <span className="text-sm font-semibold text-primary">{k.recipient_name}</span>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">{formatRelative(k.created_at)}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed pl-10">{k.message}</p>
              </div>
            ))}

            {feed.length < totalCount && (
              <div className="text-center mt-4">
                <button
                  onClick={() => loadFeed(page + 1)}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
