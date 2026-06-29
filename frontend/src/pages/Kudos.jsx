import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/auth';
import { getKudosFeed, createKudos } from '../api/kudos';
import { userService } from '../api';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

const formatRelative = (ts) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const initials = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

export default function Kudos() {
  const currentUser = useAuthStore((s) => s.user);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ recipientId: '', message: '' });
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' or 'received'

  const [kudos, setKudos] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadFeed = useCallback(async () => {
    try {
      const res = await getKudosFeed();
      setKudos(res.data?.items || []);
    } catch (err) {
      toast.error('Failed to load kudos feed');
      setKudos([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [feedRes, usersRes] = await Promise.all([
          getKudosFeed(),
          userService.getAll(),
        ]);
        if (!active) return;
        setKudos(feedRes.data?.items || []);
        setUsers(usersRes.data || []);
      } catch (err) {
        if (active) toast.error('Failed to load kudos');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.recipientId) { toast.error('Please select a recipient'); return; }
    if (!form.message.trim()) { toast.error('Message is required'); return; }

    setSubmitting(true);
    try {
      await createKudos({ recipient_id: form.recipientId, message: form.message.trim() });
      setShowForm(false);
      setForm({ recipientId: '', message: '' });
      toast.success('Kudos sent! 🎉');
      await loadFeed();
    } catch (err) {
      toast.error('Failed to send kudos');
    } finally {
      setSubmitting(false);
    }
  };

  const eligibleUsers = users.filter((u) => (u.id ?? u.user_id) !== currentUser?.id);

  // Resolve sender / recipient names from the kudos item (nested objects) or user lookup.
  const resolveName = (nested, id) => {
    if (nested?.name) return nested.name;
    const u = users.find((x) => (x.id ?? x.user_id) === id);
    return u?.name || 'Someone';
  };

  const enriched = kudos.map((k) => {
    const senderId = k.sender?.id ?? k.sender_id;
    const recipientId = k.recipient?.id ?? k.recipient_id;
    return {
      ...k,
      _senderId: senderId,
      _recipientId: recipientId,
      _senderName: resolveName(k.sender, senderId),
      _recipientName: resolveName(k.recipient, recipientId),
    };
  });

  const displayKudos = activeTab === 'feed'
    ? enriched
    : enriched.filter((k) => k._recipientId === currentUser?.id);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Kudos & Recognition</h1>
            <p className="text-gray-500 mt-2">Celebrate wins and recognize your peers' great work.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors flex items-center gap-2">
            {showForm ? 'Cancel' : '💌 Give Kudos'}
          </button>
        </div>

        {/* Give Kudos Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden mb-8 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-pink-50 border-b border-pink-100">
              <h3 className="font-bold text-pink-900 flex items-center gap-2">Give Kudos 🌟</h3>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Select Recipient</label>
                  <select
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-pink-500 outline-none transition-all"
                    value={form.recipientId}
                    onChange={e => setForm({...form, recipientId: e.target.value})}
                  >
                    <option value="">Choose a colleague...</option>
                    {eligibleUsers.map(u => (
                      <option key={u.id ?? u.user_id} value={u.id ?? u.user_id}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
                  <textarea
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-pink-500 outline-none transition-all min-h-[100px] resize-none"
                    maxLength={500}
                    value={form.message}
                    onChange={e => setForm({...form, message: e.target.value})}
                    placeholder="What did they do that deserves recognition?"
                  />
                  <p className="text-xs text-gray-500 text-right mt-1">{form.message.length}/500</p>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="bg-pink-600 hover:bg-pink-700 disabled:bg-pink-300 text-white px-6 py-2 rounded-xl font-medium shadow-sm transition-colors">
                    {submitting ? 'Sending...' : 'Send Kudos'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'feed' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('feed')}
          >
            Company Feed
          </button>
          <button
            className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'received' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('received')}
          >
            My Kudos Received
          </button>
        </div>

        {/* Feed */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm text-gray-500">
            Loading kudos...
          </div>
        ) : displayKudos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <h3 className="text-lg font-bold text-gray-900">No kudos yet</h3>
            <p className="text-gray-500 mt-1">Be the first to give recognition!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayKudos.map(k => (
              <div key={k.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-400 flex items-center justify-center text-white font-bold shadow-sm">
                    {initials(k._senderName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{k._senderName}</span>
                      <span className="text-gray-400 text-sm">gave kudos to</span>
                      <span className="font-bold text-pink-600">{k._recipientName}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{formatRelative(k.created_at)}</div>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed ml-12 p-4 bg-pink-50/50 rounded-xl border border-pink-100/50">
                  "{k.message}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
