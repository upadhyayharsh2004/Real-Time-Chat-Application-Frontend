import React, { useState, useEffect, useCallback } from 'react';
import { authApi, messageApi, roomApi, notificationApi, presenceApi, adminRoomApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'home', label: 'Dashboard', icon: '⚡' },
  { id: 'users', label: 'Users', icon: '👤' },
  { id: 'rooms', label: 'Rooms', icon: '💬' },
  { id: 'messages', label: 'Messages', icon: '📨' },
  { id: 'presence', label: 'Presence', icon: '🟢' },
  { id: 'broadcast', label: 'Broadcast', icon: '📢' },
];

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab] = useState('home');

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.badge}>ADMIN</div>
          <h2 style={S.title}>Control Panel</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
          >
            <span style={{ fontSize: 13 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>
        {tab === 'home' && <DashboardTab onNavigate={setTab} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'rooms' && <RoomsTab />}
        {tab === 'messages' && <MessagesTab />}
        {tab === 'presence' && <PresenceTab />}
        {tab === 'broadcast' && <BroadcastTab />}
      </div>
    </div>
  );
}

// ─── Dashboard Home ───────────────────────────────────────────────────────────
function DashboardTab({ onNavigate }) {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState({ onlineUsers: 0, activeConnections: 0, totalRooms: 0, totalUsers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      presenceApi.getConnectionCount(),
      presenceApi.getOnlineUserIds(),
      authApi.getUsersByRole('User'), // Fetch only non-admin users for total count
      roomApi.getPublicRooms(1, 1),
    ]).then(([conns, onlineIds, users, rooms]) => {
      const connData = conns.status === 'fulfilled' ? conns.value : null;
      const onlineData = onlineIds.status === 'fulfilled' ? onlineIds.value : null;
      const userData = users.status === 'fulfilled' ? users.value : null;
      const roomData = rooms.status === 'fulfilled' ? rooms.value : null;

      const rawIds = Array.isArray(onlineData?.data) ? onlineData.data : Array.isArray(onlineData) ? onlineData : [];
      const adminId = currentUser?.userId || currentUser?.id;
      const isAdminOnline = rawIds.some(id => String(id) === String(adminId));

      const rawCount = connData?.data?.activeConnections ?? connData?.activeConnections ?? connData ?? 0;

      setStats({
        activeConnections: isAdminOnline ? Math.max(0, rawCount - 1) : rawCount,
        onlineUsers: rawIds.filter(id => String(id) !== String(adminId)).length,
        totalUsers: userData?.data?.length ?? userData?.users?.length ?? userData?.length ?? 0,
        totalRooms: roomData?.data?.totalCount ?? roomData?.totalCount ?? 0,
      });
    }).finally(() => setLoading(false));
  }, [currentUser]);

  const cards = [
    { label: 'Online Users', value: stats.onlineUsers, icon: '🟢', color: 'var(--emerald)', bg: 'var(--emerald-dim)', nav: 'presence' },
    { label: 'Active Connections', value: stats.activeConnections, icon: '🔗', color: 'var(--accent-light)', bg: 'var(--accent-dim)', nav: 'presence' },
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'var(--sky)', bg: 'rgba(56,189,248,0.12)', nav: 'users' },
    { label: 'Total Rooms', value: stats.totalRooms, icon: '💬', color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)', nav: 'rooms' },
  ];

  const quickActions = [
    { icon: '👤', label: 'Manage Users', desc: 'Deactivate, reactivate, view all', tab: 'users' },
    { icon: '💬', label: 'Manage Rooms', desc: 'Delete rooms, view members', tab: 'rooms' },
    { icon: '📨', label: 'View Messages', desc: 'Read any chat, delete messages', tab: 'messages' },
    { icon: '🟢', label: 'Live Presence', desc: 'See who is online right now', tab: 'presence' },
    { icon: '📢', label: 'Broadcast', desc: 'Send system-wide notification', tab: 'broadcast' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome */}
      <div style={S.welcomeBox}>
        <div style={{ fontSize: 22 }}>👋</div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-0)' }}>
            Welcome, Super Admin
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            Full platform control — proceed with caution
          </div>
        </div>
      </div>

      {/* Stats */}
      {loading ? <Loader /> : (
        <div style={S.statsGrid}>
          {cards.map(c => (
            <button key={c.label} onClick={() => onNavigate(c.nav)} style={{ ...S.statCard, cursor: 'pointer' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{c.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <div style={S.sectionLabel}>Quick Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {quickActions.map(a => (
            <button key={a.tab} onClick={() => onNavigate(a.tab)} style={S.actionRow}>
              <div style={S.actionIcon}>{a.icon}</div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{a.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.desc}</div>
              </div>
              <div style={{ fontSize: 16, color: 'var(--text-3)' }}>›</div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | active | inactive
  const [busy, setBusy] = useState(null);  // userId being actioned

  const load = async () => {
    setLoading(true);
    try {
      // Admin endpoint — gets ALL users by role, or fallback to active
      let data = [];
      try {
        const r = await authApi.getUsersByRole('User');
        data = r?.data || r?.users || r || [];
      } catch {
        const r = await authApi.getActiveUsers();
        data = r?.data || r?.users || r || [];
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch (_) {
      setUsers([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deactivate = async (id) => {
    if (!window.confirm('Deactivate this user? They will lose access.')) return;
    setBusy(id);
    try {
      await authApi.deactivateAccount(id);
      setUsers(u => u.map(x => (x.userId || x.id) === id ? { ...x, isActive: false } : x));
    } catch (e) { alert(e.message); }
    setBusy(null);
  };

  const reactivate = async (id) => {
    if (!window.confirm('Reactivate this user?')) return;
    setBusy(id);
    try {
      await authApi.reactivateAccount(id);
      setUsers(u => u.map(x => (x.userId || x.id) === id ? { ...x, isActive: true } : x));
    } catch (e) { alert(e.message); }
    setBusy(null);
  };

  const changeRole = async (id, currentRole) => {
    const newRole = currentRole === 'Admin' ? 'User' : 'Admin';
    if (!window.confirm(`Change role to ${newRole}?`)) return;
    setBusy(id);
    try {
      await authApi.changeUserRole(id, newRole);
      setUsers(u => u.map(x => (x.userId || x.id) === id ? { ...x, role: newRole } : x));
    } catch (e) { alert(e.message); }
    setBusy(null);
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || (u.displayName || u.userName || '').toLowerCase().includes(search.toLowerCase())
      || (u.email || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'active' ? u.isActive !== false : u.isActive === false);
    return matchSearch && matchFilter;
  });

  return (
    <div>
      {/* Search + filter row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          style={{ ...S.searchInput, margin: 0, flex: 1 }}
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {['all', 'active', 'inactive'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...S.filterBtn, ...(filter === f ? S.filterActive : {}) }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState text="No users found" />
      ) : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>User</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Role</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => {
              const uid = u.userId || u.id;
              const isActive = u.isActive !== false;
              const isBusy = busy === uid;
              return (
                <tr key={uid} style={{ ...S.tr, opacity: isBusy ? 0.5 : 1 }}>
                  <td style={S.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ ...S.miniAvatar, background: isActive ? 'var(--accent)' : 'var(--text-3)' }}>
                        {(u.displayName || u.userName || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-0)' }}>{u.displayName || u.userName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>@{u.userName || uid}</div>
                      </div>
                    </div>
                  </td>
                  <td style={S.td}><span style={{ fontSize: 12, color: 'var(--text-2)' }}>{u.email || '—'}</span></td>
                  <td style={S.td}>
                    <span style={{ fontSize: 11, color: 'var(--sky)', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                      {u.role || 'User'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: isActive ? 'var(--emerald)' : 'var(--rose)',
                      background: isActive ? 'var(--emerald-dim)' : 'rgba(244,63,94,0.1)',
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isActive ? (
                        <button onClick={() => deactivate(uid)} disabled={isBusy} style={S.dangerSmall}>
                          Deactivate
                        </button>
                      ) : (
                        <button onClick={() => reactivate(uid)} disabled={isBusy} style={S.successSmall}>
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={() => changeRole(uid, u.role)}
                        disabled={isBusy || !isActive}
                        style={S.infoSmall}
                      >
                        Set as {u.role === 'Admin' ? 'User' : 'Admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Rooms Tab ────────────────────────────────────────────────────────────────
function RoomsTab() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // roomId with members visible
  const [members, setMembers] = useState({});   // { roomId: [...] }

  const load = async () => {
    setLoading(true);
    try {
      const r = await adminRoomApi.getAllRooms(1, 100);
      setRooms(Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : []);
    } catch {
      try {
        const r = await roomApi.getPublicRooms(1, 100);
        setRooms(r?.data || r?.rooms || r || []);
      } catch { setRooms([]); }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteRoom = async (id) => {
    if (!window.confirm('Deactivate this room?')) return;
    try {
      await adminRoomApi.deleteRoom(id);
      setRooms(rs => rs.map(r => (r.roomId || r.id) === id ? { ...r, isActive: false } : r));
    } catch (e) { alert(e.message); }
  };

  const reactivateRoom = async (id) => {
    if (!window.confirm('Reactivate this room?')) return;
    try {
      await adminRoomApi.reactivateRoom(id);
      setRooms(rs => rs.map(r => (r.roomId || r.id) === id ? { ...r, isActive: true } : r));
    } catch (e) { alert(e.message); }
  };

  const toggleMembers = async (id) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    try {
      const res = await adminRoomApi.getMembers(id);
      const raw = res?.data || res?.members || res || [];

      // Resolve names for each member
      const resolved = await Promise.all(
        raw.map(async m => {
          try {
            const p = await authApi.getProfile(m.userId);
            const user = p?.data || p?.user || p;
            return {
              ...m,
              name: user?.displayName || user?.userName || `User ${m.userId}`,
              avatarUrl: user?.avatarUrl || null
            };
          } catch {
            return { ...m, name: `User ${m.userId}` };
          }
        })
      );

      setMembers(m => ({ ...m, [id]: resolved }));
    } catch {
      setMembers(m => ({ ...m, [id]: [] }));
    }
  };

  return (
    <div>
      {loading ? <Loader /> : rooms.length === 0 ? <EmptyState text="No rooms found" /> : (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Room</th>
              <th style={S.th}>Type</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Members</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map(r => {
              const rid = r.roomId || r.id;
              const isExpanded = expanded === rid;
              return (
                <React.Fragment key={rid}>
                  <tr style={S.tr}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-0)' }}>{r.name || r.roomName}</div>
                      {r.description && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{r.description.slice(0, 50)}</div>}
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: 11, color: 'var(--sky)', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                        {r.roomType || 'Public'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: r.isActive !== false ? 'var(--emerald)' : 'var(--rose)',
                        background: r.isActive !== false ? 'var(--emerald-dim)' : 'rgba(244,63,94,0.1)',
                        padding: '2px 8px', borderRadius: 10,
                      }}>
                        {r.isActive !== false ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{r.memberCount || 0}</span>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => toggleMembers(rid)} style={S.infoSmall}>
                          {isExpanded ? 'Hide' : 'Members'}
                        </button>
                        {r.isActive !== false ? (
                          <button onClick={() => deleteRoom(rid)} style={S.dangerSmall}>Deactivate</button>
                        ) : (
                          <button onClick={() => reactivateRoom(rid)} style={S.successSmall}>Reactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: 'var(--bg-2)' }}>
                      <td colSpan={4} style={{ padding: '8px 12px' }}>
                        {!members[rid] ? (
                          <Loader />
                        ) : members[rid].length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No members</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {members[rid].map(m => (
                              <span key={m.userId || m.id} style={S.memberChip}>
                                {m.name || m.displayName || m.userName || `User ${m.userId}`}
                                {m.role === 'Admin' && <span style={{ color: 'var(--accent-light)', marginLeft: 4 }}>★</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Messages Tab ─────────────────────────────────────────────────────────────
function MessagesTab() {
  const [mode, setMode] = useState('direct'); // direct | room
  const [userId1, setUserId1] = useState('');
  const [userId2, setUserId2] = useState('');
  const [roomId, setRoomId] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMessages = async () => {
    setError(''); setResults([]);
    if (mode === 'direct' && (!userId1.trim() || !userId2.trim())) {
      setError('Both User IDs are required'); return;
    }
    if (mode === 'room' && !roomId.trim()) {
      setError('Room ID is required'); return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const baseUrl = process.env.REACT_APP_API_URL || 'https://connecthub-gateway-arvx.onrender.com';
      let url = mode === 'direct'
        ? `${baseUrl}/api/admin/messages/direct?senderId=${userId1}&receiverId=${userId2}`
        : `${baseUrl}/api/admin/messages/room/${roomId}`;

      // Fetch messages and users list in parallel to resolve names
      const [msgRes, userRes] = await Promise.all([
        fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(x => x.json()),
        authApi.getUsersByRole('User')
      ]);

      const msgs = msgRes?.data || msgRes?.messages || msgRes || [];
      const userList = userRes?.data || userRes?.users || userRes || [];

      // Create name map
      const nameMap = {};
      userList.forEach(u => {
        nameMap[u.userId || u.id] = u.displayName || u.userName || u.email;
      });

      setResults(msgs.map(m => ({
        ...m,
        senderName: nameMap[m.senderId] || `User ${m.senderId}`
      })));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const deleteMsg = async (id) => {
    try {
      const baseUrl = process.env.REACT_APP_API_URL || 'https://connecthub-gateway-arvx.onrender.com';
      await fetch(`${baseUrl}/api/admin/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setResults(r => r.filter(x => x.messageId !== id));
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['direct', 'room'].map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setResults([]); setError(''); }}
            style={{ ...S.filterBtn, ...(mode === m ? S.filterActive : {}) }}
          >
            {m === 'direct' ? '👤 Direct Chat' : '💬 Room Chat'}
          </button>
        ))}
      </div>

      {/* Input fields */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {mode === 'direct' ? (
          <>
            <input style={S.smallInput} placeholder="Sender User ID" value={userId1} onChange={e => setUserId1(e.target.value)} />
            <input style={S.smallInput} placeholder="Receiver User ID" value={userId2} onChange={e => setUserId2(e.target.value)} />
          </>
        ) : (
          <input style={{ ...S.smallInput, flex: 1 }} placeholder="Room ID" value={roomId} onChange={e => setRoomId(e.target.value)} />
        )}
        <button onClick={fetchMessages} style={S.searchBtn} disabled={loading}>
          {loading ? '…' : 'Load Messages'}
        </button>
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      {results.length > 0 && (
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Content</th>
              <th style={S.th}>From</th>
              <th style={S.th}>Date</th>
              <th style={S.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {results.map(m => (
              <tr key={m.messageId} style={S.tr}>
                <td style={S.td}>
                  <span style={{ fontSize: 12, color: 'var(--text-0)' }}>
                    {m.isDeleted ? <em style={{ color: 'var(--text-3)' }}>[deleted]</em> : (m.content?.slice(0, 80) + (m.content?.length > 80 ? '…' : ''))}
                  </span>
                </td>
                <td style={S.td}><span style={{ fontSize: 12, color: 'var(--text-2)' }}>{m.senderName}</span></td>
                <td style={S.td}><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.sentAt ? new Date(m.sentAt).toLocaleString() : '—'}</span></td>
                <td style={S.td}>
                  {!m.isDeleted && (
                    <button onClick={() => deleteMsg(m.messageId)} style={S.dangerSmall}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && results.length === 0 && !error && (
        <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
          Enter IDs above and click "Load Messages"
        </div>
      )}
    </div>
  );
}

// ─── Presence Tab ─────────────────────────────────────────────────────────────
function PresenceTab() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [conns, onlineInfo, onlineIds, allUsers] = await Promise.allSettled([
        presenceApi.getConnectionCount(),
        presenceApi.getOnlineUsersInfo(),
        presenceApi.getOnlineUserIds(),
        authApi.getUsersByRole('User'), // To resolve names
      ]);

      const connVal = conns.status === 'fulfilled' ? conns.value : null;
      const infoVal = onlineInfo.status === 'fulfilled' ? onlineInfo.value : null;
      const idsVal = onlineIds.status === 'fulfilled' ? onlineIds.value : null;
      const usersVal = allUsers.status === 'fulfilled' ? allUsers.value : null;

      const rawIds = Array.isArray(idsVal?.data) ? idsVal.data : Array.isArray(idsVal) ? idsVal : [];
      const rawInfo = infoVal?.data || infoVal || [];
      const userList = usersVal?.data || usersVal?.users || usersVal || [];

      // Create a name map
      const nameMap = {};
      userList.forEach(u => {
        nameMap[u.userId || u.id] = u.displayName || u.userName || u.email;
      });

      const adminId = currentUser?.userId || currentUser?.id;

      const isAdminOnline = rawIds.some(id => String(id) === String(adminId));
      const rawCount = connVal?.data?.activeConnections ?? connVal?.activeConnections ?? connVal ?? 0;

      setData({
        count: isAdminOnline ? Math.max(0, rawCount - 1) : rawCount,
        userInfo: rawInfo
          .filter(u => String(u.userId) !== String(adminId))
          .map(u => ({ ...u, name: nameMap[u.userId] || `User ${u.userId}` })),
        userIds: rawIds
          .filter(id => String(id) !== String(adminId))
          .map(id => ({ id, name: nameMap[id] || `User ${id}` })),
      });
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (_) { }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Header with refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={S.sectionLabel}>Live Platform Presence</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastRefresh && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Updated {lastRefresh}</span>}
          <button onClick={load} disabled={loading} style={S.infoSmall}>
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {loading ? <Loader /> : !data ? <EmptyState text="Could not load presence data" /> : (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={S.statCard}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🟢</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--emerald)' }}>
                {data.userIds.length}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Online Users</div>
            </div>
            <div style={S.statCard}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🔗</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: 'var(--accent-light)' }}>
                {data.count}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>Active Connections</div>
            </div>
          </div>

          {/* Online user IDs */}
          {data.userIds.length > 0 && (
            <div>
              <div style={S.sectionLabel}>Online User IDs</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {data.userIds.map(u => (
                  <span key={u.id} style={{ ...S.memberChip, color: 'var(--emerald)', background: 'var(--emerald-dim)' }}>
                    🟢 {u.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detailed info if available */}
          {Array.isArray(data.userInfo) && data.userInfo.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={S.sectionLabel}>Connection Details</div>
              <table style={{ ...S.table, marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={S.th}>User</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {data.userInfo.slice(0, 20).map((u, i) => (
                    <tr key={u.userId || i} style={S.tr}>
                      <td style={S.td}><span style={{ fontSize: 12, color: 'var(--text-1)' }}>{u.name}</span></td>
                      <td style={S.td}>
                        <span style={{ fontSize: 11, color: 'var(--emerald)', background: 'var(--emerald-dim)', padding: '2px 7px', borderRadius: 8, fontWeight: 600 }}>
                          Online
                        </span>
                      </td>
                      <td style={S.td}><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{u.connectedAt ? new Date(u.connectedAt).toLocaleTimeString() : '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Broadcast Tab ────────────────────────────────────────────────────────────
function BroadcastTab() {
  const { user: currentUser } = useAuth();
  const [form, setForm] = useState({ title: '', message: '' });
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok, msg }

  const send = async (e) => {
    e.preventDefault();
    setSending(true); setFeedback(null);
    try {
      // 1. Fetch all users to get their IDs for the bulk notification
      let allUsers = [];
      try {
        const r1 = await authApi.getUsersByRole('User');
        const r2 = await authApi.getUsersByRole('Admin');
        allUsers = [
          ...(Array.isArray(r1?.data) ? r1.data : Array.isArray(r1) ? r1 : []),
          ...(Array.isArray(r2?.data) ? r2.data : Array.isArray(r2) ? r2 : [])
        ];
      } catch (err) {
        console.error('Failed to fetch users for broadcast:', err);
        // Fallback to active users if role-based fetch fails
        const r = await authApi.getActiveUsers();
        allUsers = r?.data || r?.users || r || [];
      }

      const recipientIds = allUsers
        .filter(u => {
          const role = (u.role || u.Role || '').toLowerCase();
          const uid = u.userId || u.id;
          const currentId = currentUser?.userId || currentUser?.id;
          // Exclude admins and the person sending it
          return role !== 'admin' && String(uid) !== String(currentId);
        })
        .map(u => u.userId || u.id)
        .filter(id => id); // Remove any null/undefined

      if (recipientIds.length === 0) {
        throw new Error('No users found to send broadcast to.');
      }

      // 2. Send the bulk notification
      await notificationApi.sendBulk({
        title: form.title,
        message: form.message,
        recipientIds: recipientIds
      });

      setFeedback({ ok: true, msg: `✅ Broadcast sent to ${recipientIds.length} users!` });
      setForm({ title: '', message: '' });
    } catch (e) {
      setFeedback({ ok: false, msg: `❌ Error: ${e.message}` });
    }
    setSending(false);
  };

  return (
    <div>
      <div style={{ ...S.welcomeBox, marginBottom: 16 }}>
        <div style={{ fontSize: 20 }}>📢</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>Platform Broadcast</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Sends a notification to every user on the platform</div>
        </div>
      </div>

      {feedback && (
        <div style={{
          background: feedback.ok ? 'var(--emerald-dim)' : 'rgba(244,63,94,0.1)',
          border: `1px solid ${feedback.ok ? 'var(--emerald)' : 'var(--rose)'}`,
          borderRadius: 8, padding: '10px 14px',
          color: feedback.ok ? 'var(--emerald)' : 'var(--rose)',
          fontSize: 13, marginBottom: 16,
        }}>
          {feedback.msg}
        </div>
      )}

      <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={S.label}>Title</label>
        <input
          style={S.input}
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g. System Maintenance"
          required
        />
        <label style={S.label}>Message</label>
        <textarea
          style={{ ...S.input, resize: 'vertical', minHeight: 120 }}
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Your message to all users…"
          required
        />
        <button type="submit" disabled={sending} style={S.broadcastBtn}>
          {sending
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : '📢 Send Platform-wide Broadcast'}
        </button>
      </form>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <span className="spinner" style={{ width: 28, height: 28 }} />
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 14 }}>
      {text}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-0)' },
  header: { padding: '24px 32px 16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  badge: {
    fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--accent-light)',
    background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
    borderRadius: 8, padding: '4px 10px', textTransform: 'uppercase'
  },
  title: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-0)', letterSpacing: '-0.02em' },

  tabs: { display: 'flex', overflowX: 'auto', padding: '0 28px 12px', gap: 6, flexShrink: 0 },
  tab: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12,
    fontSize: 14, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap',
    transition: 'all 0.2s ease', border: '1px solid transparent'
  },
  tabActive: { background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--border-accent)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },

  content: { flex: 1, overflowY: 'auto', padding: '20px 32px 60px' },

  // Dashboard
  welcomeBox: {
    display: 'flex', alignItems: 'center', gap: 18, background: 'linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)',
    border: '1px solid var(--border)', borderRadius: 16, padding: '20px 24px',
    boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)'
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 },
  statCard: {
    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16,
    padding: '24px 16px', textAlign: 'center', transition: 'all 0.2s ease',
    display: 'flex', flexDirection: 'column', alignItems: 'center'
  },
  sectionLabel: { fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 12 },
  actionRow: {
    display: 'flex', alignItems: 'center', gap: 16, background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s ease',
    width: '100%', textAlign: 'left'
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 12, background: 'var(--bg-4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0
  },

  // Tables
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' },
  th: { fontSize: 11, fontWeight: 800, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 12px 12px', textAlign: 'left' },
  tr: { background: 'var(--bg-2)', borderRadius: 12 },
  td: { padding: '16px 12px', verticalAlign: 'middle', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' },
  tdLeft: { borderLeft: '1px solid var(--border)', borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
  tdRight: { borderRight: '1px solid var(--border)', borderTopRightRadius: 12, borderBottomRightRadius: 12 },

  miniAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 },

  // Buttons
  dangerSmall: { fontSize: 12, fontWeight: 700, color: '#ff4d4d', background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' },
  successSmall: { fontSize: 12, fontWeight: 700, color: 'var(--emerald)', background: 'var(--emerald-dim)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' },
  infoSmall: { fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s' },
  filterBtn: { fontSize: 12, fontWeight: 700, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', whiteSpace: 'nowrap' },
  filterActive: { color: 'var(--accent-light)', background: 'var(--accent-dim)', border: '1px solid var(--border-accent)' },
  searchBtn: { background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },

  // Inputs
  searchInput: { width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', fontSize: 14, color: 'var(--text-0)', marginBottom: 16 },
  smallInput: { flex: 1, minWidth: 150, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-0)' },
  label: { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, display: 'block' },
  input: { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', fontSize: 14, color: 'var(--text-0)', outline: 'none' },
  broadcastBtn: { background: 'var(--accent)', color: 'white', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', border: 'none', boxShadow: '0 4px 14px var(--accent-dim)' },

  // Misc
  memberChip: { fontSize: 12, fontWeight: 600, color: 'var(--text-1)', background: 'var(--bg-4)', padding: '4px 12px', borderRadius: 24, border: '1px solid var(--border)' },
  errorBox: { background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 12, padding: '12px 16px', color: '#fb7185', fontSize: 14, marginBottom: 16 },
};