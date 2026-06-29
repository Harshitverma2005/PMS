import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { getTimeline } from '../api/timeline';
import { userService } from '../api';
import { Target, Activity, Award, MessageSquare, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';

const getIconForType = (type = '') => {
  if (type.includes('goal') || type.includes('Goal')) return { icon: Target, color: 'bg-blue-50 text-blue-600 border-blue-200' };
  if (type.includes('achievement') || type.includes('Achievement')) return { icon: Award, color: 'bg-amber-50 text-amber-600 border-amber-200' };
  if (type.includes('feedback') || type.includes('Feedback') || type.includes('kudos') || type.includes('Kudos')) return { icon: MessageSquare, color: 'bg-purple-50 text-purple-600 border-purple-200' };
  if (type.includes('approved') || type.includes('Approved')) return { icon: CheckCircle, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
  return { icon: Activity, color: 'bg-gray-50 text-gray-600 border-gray-200' };
};

const formatType = (type = '') => type.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export default function Timeline() {
  const currentUser = useAuthStore((s) => s.user);
  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  const [members, setMembers] = useState([]);
  const [selectedId, setSelectedId] = useState(currentUser?.id || null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Managers/admins pick whose timeline to view, scoped to who they can read.
  useEffect(() => {
    if (!isManager || !currentUser?.id) return;
    (async () => {
      try {
        const res = await userService.getAll();
        const all = unwrapList(res.data);
        const isLegacy = (u) => (u.email || '').endsWith('@opstree.com');
        const scoped = currentUser.role === 'admin'
          ? all.filter(u => u.role === 'member' && u.is_active !== false && !isLegacy(u))
          : all.filter(u => u.manager_id === currentUser.id);
        scoped.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        // Managers can also view their own timeline; admins only their members.
        const list = currentUser.role === 'manager'
          ? [{ id: currentUser.id, name: `${currentUser.name} (you)` }, ...scoped]
          : scoped;
        setMembers(list);
        if (list.length) setSelectedId(list[0].id);
      } catch {
        toast.error('Failed to load members');
      }
    })();
  }, [isManager, currentUser]);

  // Load the selected employee's timeline.
  useEffect(() => {
    const target = isManager ? selectedId : currentUser?.id;
    if (!target) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const res = await getTimeline(target);
        if (!active) return;
        const d = res.data;
        const list = Array.isArray(d) ? d : (d?.events || d?.items || []);
        const sorted = [...list].sort((a, b) => new Date(b.timestamp || b.event_date) - new Date(a.timestamp || a.event_date));
        setEvents(sorted);
      } catch (err) {
        if (active) { toast.error('Failed to load timeline'); setEvents([]); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [selectedId, isManager, currentUser?.id]);

  const selectedName = members.find(m => String(m.id) === String(selectedId))?.name;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Performance Timeline</h1>
            <p className="text-gray-500 mt-2">
              {isManager ? 'A chronological history of performance events for your team.' : 'A chronological history of all your performance events and evidence.'}
            </p>
          </div>
          {isManager && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Viewing</span>
              {members.length === 0 ? (
                <span className="text-sm text-gray-500">No members</span>
              ) : (
                <select
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="relative border-l-2 border-gray-100 ml-6 space-y-10 py-4">
            {loading ? (
              <div className="text-center text-gray-500 py-12">Loading timeline...</div>
            ) : events.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No timeline events{selectedName ? ` for ${selectedName}` : ''} yet.</div>
            ) : (
              events.map((event) => {
                const { icon: Icon, color } = getIconForType(event.event_type);
                const dateObj = new Date(event.timestamp || event.event_date);
                return (
                  <div key={event.id} className="relative pl-12 hover:bg-gray-50/50 p-4 rounded-2xl transition-colors -ml-4 group">
                    <div className={`absolute top-5 -left-[45px] w-12 h-12 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 ${color}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{event.title || formatType(event.event_type)}</h3>
                      <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full w-max">
                        {isNaN(dateObj) ? '' : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mt-3 group-hover:bg-white group-hover:border-gray-200 transition-colors">
                      {(event.summary || event.description) && (
                        <p className="text-gray-700 font-medium">{event.summary || event.description}</p>
                      )}
                      {event.metadata?.progress !== undefined && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600 mb-1">Progress updated to {event.metadata.progress}%</p>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${event.metadata.progress}%` }} />
                          </div>
                        </div>
                      )}
                      {event.metadata?.text && (
                        <p className="text-gray-700 italic border-l-2 border-purple-200 pl-3 py-1 mt-2">"{event.metadata.text}"</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
