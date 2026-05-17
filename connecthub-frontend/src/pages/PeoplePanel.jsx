import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, presenceApi, getMediaUrl } from '../services/api';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import SecureImage from '../components/SecureImage';

export default function PeoplePanel() {
  const navigate = useNavigate();
  const { isOnline } = useChat();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('all'); // 'all' | 'online'
  const [onlineIds, setOnlineIds] = useState([]);

  useEffect(() => {
    loadUsers();
    presenceApi.getOnlineUserIds().then(ids => {
      const arr = Array.isArray(ids)
        ? ids
        : (ids?.data ?? ids?.userIds ?? ids?.ids ?? Object.values(ids || {}));
      const filtered = (Array.isArray(arr) ? arr : []).filter(
        id => String(id) !== String(currentUser?.id)
      );
      setOnlineIds(filtered);
    }).catch(() => setOnlineIds([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      let res;
      if (search.trim()) res = await authApi.searchUsers(search);
      else res = await authApi.getActiveUsers();
      const list = Array.isArray(res) ? res : (res?.users ?? res?.data ?? res?.items ?? []);
      const filtered = (Array.isArray(list) ? list : []).filter(u => {
        const uid = u.userId || u.id;
        const role = (u.role || u.Role || '').toLowerCase();
        const dname = (u.displayName || u.DisplayName || '').toLowerCase();
        
        // Final frontend safeguard: Filter out current user AND admins
        return String(uid) !== String(currentUser?.id) && 
               role !== 'admin' && 
               dname !== 'platform admin';
      });
      setUsers(filtered);
    } catch (_) {}
    setLoading(false);
  };

  // Real-time online count — ChatContext ka onlineUsers Set live update hota hai SignalR se
  const onlineCount = users.filter(u => isOnline(u.userId || u.id)).length;

  const displayUsers = tab === 'online'
    ? users.filter(u => isOnline(u.userId || u.id) || onlineIds.includes(u.userId || u.id))
    : users;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h2 style={S.title}>People</h2>
      </div>

      <div style={S.searchWrap}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input style={S.searchInput} placeholder="Search people…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={S.tabs}>
        {['all', 'online'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
            {t === 'all' ? 'All' : `Online (${onlineCount})`}
          </button>
        ))}
      </div>

      <div style={S.list}>
        {loading && <div style={S.empty}><span className="spinner" /></div>}
        {!loading && displayUsers.length === 0 && (
          <div style={S.empty}>{search ? 'No users found' : 'No users yet'}</div>
        )}
        {displayUsers.map(u => {
          const uid = u.userId || u.id;
          const name = u.displayName || u.userName || u.username || `User ${uid}`;
          const online = isOnline(uid) || onlineIds.includes(uid);
          return (
            <div key={uid} style={S.userItem} onClick={() => navigate(`/dm/${uid}`)}>
              <div style={S.avatar}>
                <SecureImage
                  src={getMediaUrl(u.avatarUrl || u.AvatarUrl)}
                  alt={name}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  fallback={<span style={S.avatarLetter}>{name[0]?.toUpperCase()}</span>}
                />
                <span style={{ ...S.statusDot, background: online ? 'var(--emerald)' : 'var(--text-3)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.userName}>{name}</div>
                <div style={S.userHandle}>@{u.userName || u.username || uid}</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); navigate(`/dm/${uid}`); }}
                style={S.msgBtn}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { padding: '20px 16px 12px', flexShrink: 0 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  searchWrap: { margin: '0 12px 8px', position: 'relative' },
  searchInput: { width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px 8px 30px', fontSize: 13, color: 'var(--text-0)' },
  tabs: { display: 'flex', margin: '0 12px 8px', background: 'var(--bg-3)', borderRadius: 8, padding: 3 },
  tab: { flex: 1, padding: '6px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', transition: 'all var(--transition)' },
  tabActive: { background: 'var(--bg-1)', color: 'var(--text-0)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  userItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background var(--transition)', marginBottom: 2 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  avatarLetter: { color: 'white', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' },
  statusDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--bg-1)' },
  userName: { fontSize: 13, fontWeight: 600, color: 'var(--text-0)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  userHandle: { fontSize: 11, color: 'var(--text-3)', marginTop: 1 },
  msgBtn: { width: 30, height: 30, borderRadius: 8, background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 },
  empty: { display: 'flex', justifyContent: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 },
};