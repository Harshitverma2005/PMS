import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { getTimeline, exportTimeline } from '../api/timeline';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

const EVENT_ICONS = {
  goal_created: '🎯',
  goal_approved: '✅',
  goal_completed: '🏆',
  goal_archived: '📦',
  progress_updated: '📈',
  feedback_submitted: '💬',
  achievement_logged: '⭐',
  kudos_received: '❤️',
  checkin_submitted: '📋',
  goal_status_changed: '🔄',
};

const EVENT_TYPES = [
  { value: '', label: 'All Events' },
  { value: 'goal_created', label: 'Goal Created' },
  { value: 'goal_approved', label: 'Goal Approved' },
  { value: 'goal_completed', label: 'Goal Completed' },
  { value: 'goal_archived', label: 'Goal Archived' },
  { value: 'progress_updated', label: 'Progress Updated' },
  { value: 'feedback_submitted', label: 'Feedback Submitted' },
  { value: 'achievement_logged', label: 'Achievement Logged' },
  { value: 'kudos_received', label: 'Kudos Received' },
  { value: 'checkin_submitted', label: 'Check-in Submitted' },
];

export default function Timeline() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const PAGE_SIZE = 20;

  useEffect(() => {
    if (isManager) {
      apiClient.get('/users/').then(res => {
        const reports = (res.data || []).filter(u => u.manager_id === user.id);
        setEmployees(reports);
      }).catch(() => {});
    } else {
      setSelectedEmployee(user?.id);
    }
  }, [isManager, user]);

  const fetchTimeline = useCallback(async (empId, pg = 1) => {
    if (!empId) return;
    setLoading(true);
    try {
      const params = { page: pg, page_size: PAGE_SIZE };
      if (typeFilter) params.type = typeFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await getTimeline(empId, params);
      setEvents(pg === 1 ? res.data.events : [...events, ...res.data.events]);
      setTotalCount(res.data.total_count);
      setPage(pg);
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error("You don't have permission to do that");
      } else {
        toast.error('Failed to load timeline');
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, startDate, endDate]);

  useEffect(() => {
    if (selectedEmployee) fetchTimeline(selectedEmployee, 1);
  }, [selectedEmployee, typeFilter, startDate, endDate]);

  const handleExport = async () => {
    try {
      await exportTimeline(selectedEmployee, {
        type: typeFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
    } catch {
      toast.error('Export failed');
    }
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Performance Timeline</h1>
            <p className="text-muted-foreground mt-1">A unified, chronological feed of all performance-relevant events</p>
          </div>
          {selectedEmployee && (
            <button
              onClick={handleExport}
              className="btn btn-secondary flex items-center gap-2"
            >
              📥 Export CSV
            </button>
          )}
        </div>

        {/* Employee picker for managers */}
        {isManager && (
          <div className="card mb-6">
            <label className="text-sm font-semibold text-foreground mb-2 block">View Timeline For</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedEmployee(user?.id)}
                className={`btn text-xs ${selectedEmployee === user?.id ? 'btn-primary' : 'btn-secondary'}`}
              >
                My Timeline
              </button>
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedEmployee(emp.id)}
                  className={`btn text-xs ${selectedEmployee === emp.id ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {emp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Event Type</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="input"
              >
                {EVENT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" />
            </div>
          </div>
        </div>

        {/* Timeline */}
        {!selectedEmployee ? (
          <div className="card text-center py-12 text-muted-foreground">Select an employee to view their timeline</div>
        ) : loading && events.length === 0 ? (
          <div className="card text-center py-12">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-muted-foreground">Loading timeline...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="card text-center py-12 text-muted-foreground">No timeline events found</div>
        ) : (
          <div>
            <p className="text-sm text-muted-foreground mb-4">{totalCount} events total</p>
            <ol className="relative border-l border-border ml-4">
              {events.map((event) => (
                <li key={event.id} className="mb-8 ml-6">
                  <span className="absolute -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-lg border border-primary/20">
                    {EVENT_ICONS[event.event_type] || '📌'}
                  </span>
                  <div className="card p-4 ml-2">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
                      <time className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {formatDate(event.timestamp)}
                      </time>
                    </div>
                    <span className="badge bg-primary/10 text-primary border-primary/20 text-xs mb-2">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    {event.summary && (
                      <p className="text-xs text-muted-foreground mt-2">{event.summary}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {/* Load more */}
            {events.length < totalCount && (
              <div className="text-center mt-4">
                <button
                  onClick={() => fetchTimeline(selectedEmployee, page + 1)}
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
