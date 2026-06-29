import { useEffect, useState } from 'react';
import { 
  Bell, CheckCircle, Clock, Target, 
  MessageSquare, Shield, Zap, Trash2, 
  Search, Filter, Inbox
} from 'lucide-react';
import Layout from '../components/Layout';
import { notificationService } from '../api';
import { formatDate } from '../utils/format';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const COLORS = {
  bg: "#F5F4F0",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E4E2DC",
  accent: "#2563EB",
  emerald: "#059669",
  amber: "#D97706",
  rose: "#DC2626",
  violet: "#7C3AED",
  text: "#111111",
  muted: "#6B7280",
  subtle: "#9CA3AF",
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationService.getAll();
      const payload = res?.data;
      const list = Array.isArray(payload)
        ? payload
        : (payload?.data ?? payload?.items ?? []);
      setNotifications(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error('Strategic inbox inaccessible');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await notificationService.markRead(id);
      // Refetch to stay in sync with backend read state.
      loadNotifications();
    } catch (e) {
      toast.error('Signal update failed');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllRead();
      toast.success('Strategy cleared');
      loadNotifications();
    } catch (e) {
      toast.error('Bulk update failed');
    }
  };

  const getIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('goal')) return { icon: Target, color: COLORS.accent };
    if (t.includes('review') || t.includes('feedback')) return { icon: MessageSquare, color: COLORS.violet };
    if (t.includes('probation')) return { icon: Shield, color: COLORS.amber };
    if (t.includes('score')) return { icon: Zap, color: COLORS.emerald };
    return { icon: Bell, color: COLORS.muted };
  };

  if (loading) return (
    <Layout>
      <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${COLORS.border}`, borderTopColor: COLORS.accent, animation: "spin 1s linear infinite" }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Layout>
      <div className="page active" id="page-notifications">
        
        {/* Header */}
        <div className="page-header flex justify-between items-center" style={{ marginBottom: '24px' }}>
          <div style={{ display: "flex", alignItems: "center", gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'var(--primary-light)',
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Inbox size={24} color="var(--primary)" />
            </div>
            <div>
              <div className="page-title">Strategic Inbox</div>
              <div className="page-desc">{unreadCount} unread deployment alerts</div>
            </div>
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="btn btn-secondary" style={{ display: "flex", alignItems: "center", gap: '8px' }}>
              <CheckCircle size={15} /> Mark all as read
            </button>
          )}
        </div>

        {/* Notif List */}
        <div style={{ display: "flex", flexDirection: "column", gap: '12px' }}>
          {notifications.map((n) => {
            const { icon: CategoryIcon, color } = getIcon(n.notification_type);
            return (
              <div 
                key={n.id} 
                onClick={() => {
                  if (!n.is_read) markAsRead(n.id);
                  if (n.action_url) navigate(n.action_url);
                }}
                className="card"
                style={{
                  padding: "20px 24px",
                  display: "flex", alignItems: "flex-start", gap: '20px',
                  cursor: "pointer", position: "relative",
                  transition: "all 0.2s",
                  border: n.is_read ? '1px solid var(--border)' : `1px solid ${color}`,
                  boxShadow: n.is_read ? "none" : `0 4px 15px -4px ${color}33`,
                }}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: `${color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <CategoryIcon size={20} color={color} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: '4px' }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>{n.title}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>{formatDate(n.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: "95%", whiteSpace: "pre-line" }}>{n.message}</p>
                </div>
                {!n.is_read && (
                  <div style={{
                    width: '8px', height: '8px', borderRadius: "50%", background: color,
                    marginTop: '6px',
                  }} />
                )}
              </div>
            );
          })}

          {notifications.length === 0 && (
            <div style={{
              padding: "80px 40px", textAlign: "center",
              background: 'var(--bg)', borderRadius: '16px',
              border: '2px dashed var(--border)',
              display: "flex", flexDirection: "column", alignItems: "center", gap: '16px',
            }}>
              <Bell size={48} color="var(--text-muted)" style={{ opacity: 0.5 }} />
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>Strategy Silent</div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Your strategic signal is clear. No new alerts detected.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
