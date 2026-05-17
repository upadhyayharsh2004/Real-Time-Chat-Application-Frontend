import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, roomApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { hubManager, HubState } from '../services/signalr';

const TYPE_ICON = {
  MESSAGE: '💬',
  MENTION: '@',
  ROOM_INVITE: '🏠',
  ROLE_CHANGE: '🔑',
  PLATFORM: '📢',
};

const TYPE_COLOR = {
  MESSAGE: 'var(--accent)',
  MENTION: 'var(--amber)',
  ROOM_INVITE: 'var(--emerald)',
  ROLE_CHANGE: 'var(--sky)',
  PLATFORM: 'var(--rose)',
};

export default function NotificationsPanel() {
  const { user } = useAuth();
  const { setNotificationCount } = useChat();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [inviteLoading, setInviteLoading] = useState({});

  // ── Refs to avoid stale closures ──────────────────────────────────────────
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const isSetupDone = useRef(false);

  // ── Load from API ─────────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser?.id) return;
    try {
      const res = await notificationApi.getByRecipient(currentUser.id);
      const list = res?.notifications || res?.data || res || [];
      const safeList = Array.isArray(list) ? list : [];
      setNotifications(safeList);
      const unread = safeList.filter(n => !n.isRead).length;
      setNotificationCount(unread);
    } catch (_) {}
    setLoading(false);
  }, [setNotificationCount]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    loadNotifications();
  }, [user?.id, loadNotifications]);

  // ── SignalR realtime setup ─────────────────────────────────────────────────
  // Backend sends:
  //   "NotificationCount" → number (on connect, mark read, new notif)
  //   "ReceiveNotification" → NOT sent by this backend (hub doesn't use it)
  //
  // Strategy: when NotificationCount changes → reload from API
  // This is the only reliable way since backend doesn't push full object.
  useEffect(() => {
    if (!user?.id) return;
    if (isSetupDone.current) return;

    let cancelled = false;
    let retryTimer = null;

    const trySetup = () => {
      if (cancelled) return;

      const hub = hubManager.get('notifications');
      if (!hub || hub.state !== HubState.Connected) {
        retryTimer = setTimeout(trySetup, 1000);
        return;
      }

      // Remove old handlers first — prevent duplicates
      hub.off('NotificationCount');
      hub.off('ReceiveNotification');

      // NotificationCount → reload full list from API
      hub.on('NotificationCount', (count) => {
        const n = typeof count === 'object' ? (count?.unreadCount ?? 0) : (count ?? 0);
        setNotificationCount(n);
        // Reload to get the actual new notifications
        loadNotifications();
      });

      // ReceiveNotification — backend doesn't send object but keep for future
      hub.on('ReceiveNotification', (notif) => {
        if (!notif || typeof notif !== 'object' || !notif.notificationId) {
          // No object → just reload
          loadNotifications();
          return;
        }
        // If backend ever sends full object, add it directly (no duplicate)
        setNotifications(prev => {
          if (prev.find(n => n.notificationId === notif.notificationId)) return prev;
          const updated = [notif, ...prev];
          setNotificationCount(updated.filter(n => !n.isRead).length);
          return updated;
        });
      });

      // Re-register on reconnect
      hubManager.onReconnected('notifications', () => {
        isSetupDone.current = false;
        trySetup();
      });

      isSetupDone.current = true;
    };

    trySetup();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, loadNotifications, setNotificationCount]);

  // ── Mark read ─────────────────────────────────────────────────────────────
  const markRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.notificationId === id ? { ...n, isRead: true } : n));
      setNotificationCount(prev => Math.max(0, prev - 1));
    } catch (_) {}
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setNotificationCount(0);
    } catch (_) {}
  };

  const deleteNotif = async (id) => {
    try {
      await notificationApi.deleteNotification(id);
      setNotifications(prev => {
        const updated = prev.filter(n => n.notificationId !== id);
        setNotificationCount(updated.filter(n => !n.isRead).length);
        return updated;
      });
    } catch (_) {}
  };

  // ── Accept / Decline invite ───────────────────────────────────────────────
  const handleInviteResponse = async (n, action) => {
    setInviteLoading(prev => ({ ...prev, [n.notificationId]: action }));
    try {
      await roomApi.respondToInvite(n.relatedId, { accept: action === 'accept' }); // backend expects { accept: bool }
      setNotifications(prev => prev.map(x =>
        x.notificationId === n.notificationId
          ? { ...x, isRead: true, inviteResolved: action === 'accept' ? 'accepted' : 'declined' }
          : x
      ));
      setNotificationCount(prev => Math.max(0, prev - 1));
      if (action === 'accept') {
        window.dispatchEvent(new CustomEvent('room:joined', { detail: { roomId: n.relatedId } }));
      }
      // PERSIST: mark this invite notification as read so buttons disappear on refresh
      markRead(n.notificationId);
    } catch (err) {
      alert(err?.message || 'Could not respond to invite.');
    }
    setInviteLoading(prev => ({ ...prev, [n.notificationId]: null }));
  };

  const handleClick = (n) => {
    if (n.type === 'ROOM_INVITE') return;
    if (!n.isRead) markRead(n.notificationId);
    if (n.type === 'MESSAGE' && n.relatedId) navigate(`/dm/${n.senderId}`);
  };

  const displayList = tab === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h2 style={S.title}>Notifications</h2>
        {unreadCount > 0 && (
          <button onClick={markAllRead} style={S.markAllBtn}>Mark all read</button>
        )}
      </div>

      <div style={S.tabs}>
        {['all', 'unread'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      <div style={S.list}>
        {loading && <div style={S.empty}><span className="spinner" /></div>}
        {!loading && displayList.length === 0 && (
          <div style={S.empty}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13 }}>
              {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </div>
          </div>
        )}

        {displayList.map(n => {
          const icon = TYPE_ICON[n.type] || '🔔';
          const color = TYPE_COLOR[n.type] || 'var(--text-2)';
          const isInvite = n.type === 'ROOM_INVITE' && !n.title?.toLowerCase().includes('joined');
          const resolved = n.inviteResolved;
          const btnLoading = inviteLoading[n.notificationId];

          return (
            <div
              key={n.notificationId}
              style={{ ...S.notifItem, ...(n.isRead ? {} : S.notifUnread), cursor: isInvite ? 'default' : 'pointer' }}
              onClick={() => handleClick(n)}
            >
              <div style={{ ...S.notifIcon, background: color + '20', color }}>
                <span style={{ fontSize: n.type === 'MENTION' ? 14 : 18 }}>{icon}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.notifTitle}>{n.title || n.type}</div>
                <div style={S.notifMsg}>{n.message}</div>
                <div style={S.notifTime}>{timeAgo(n.sentAt)}</div>

                {isInvite && !resolved && !n.isRead && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleInviteResponse(n, 'accept'); }}
                      disabled={!!btnLoading}
                      style={S.acceptBtn}
                    >
                      {btnLoading === 'accept' ? '…' : '✓ Accept'}
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleInviteResponse(n, 'decline'); }}
                      disabled={!!btnLoading}
                      style={S.declineBtn}
                    >
                      {btnLoading === 'decline' ? '…' : '✕ Decline'}
                    </button>
                  </div>
                )}

                {isInvite && resolved === 'accepted' && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--emerald)', fontWeight: 600 }}>✓ Joined the room</div>
                )}
                {isInvite && resolved === 'declined' && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>✕ Invite declined</div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                {!n.isRead && <span style={S.unreadDot} />}
                <button
                  onClick={e => { e.stopPropagation(); deleteNotif(n.notificationId); }}
                  style={S.deleteBtn}
                >✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(t) {
  if (!t) return '';
  const diff = Date.now() - new Date(t).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(t).toLocaleDateString();
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 12px', flexShrink: 0 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  markAllBtn: { fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 },
  tabs: { display: 'flex', margin: '0 12px 8px', background: 'var(--bg-3)', borderRadius: 8, padding: 3 },
  tab: { flex: 1, padding: '6px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', transition: 'all var(--transition)' },
  tabActive: { background: 'var(--bg-1)', color: 'var(--text-0)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  notifItem: { display: 'flex', gap: 10, padding: '10px', borderRadius: 'var(--radius)', transition: 'background var(--transition)', marginBottom: 2, borderLeft: '3px solid transparent' },
  notifUnread: { background: 'rgba(108,99,255,0.06)', borderLeftColor: 'var(--accent)' },
  notifIcon: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text-0)' },
  notifMsg: { fontSize: 12, color: 'var(--text-2)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  notifTime: { fontSize: 11, color: 'var(--text-3)', marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 },
  deleteBtn: { fontSize: 12, color: 'var(--text-3)', padding: '2px 4px', borderRadius: 4 },
  acceptBtn: { fontSize: 11, fontWeight: 700, color: 'white', background: 'var(--emerald)', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  declineBtn: { fontSize: 11, fontWeight: 700, color: 'var(--text-1)', background: 'var(--bg-4)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-3)', fontSize: 13 },
};