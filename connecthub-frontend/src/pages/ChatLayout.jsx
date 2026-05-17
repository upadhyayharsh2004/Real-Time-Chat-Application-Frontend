import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import DirectMessageView from './DirectMessageView';
import RoomView from './RoomView';
import RoomsPanel from './RoomsPanel';
import PeoplePanel from './PeoplePanel';
import NotificationsPanel from './NotificationsPanel';
import ProfilePanel from './ProfilePanel';
import AdminPanel from './AdminPanel';
import WelcomeView from './WelcomeView';

const NAV_ITEMS = [
  { id: 'dm', icon: ChatIcon, label: 'Messages', path: '/' },
  { id: 'rooms', icon: RoomsIcon, label: 'Rooms', path: '/rooms' },
  { id: 'people', icon: PeopleIcon, label: 'People', path: '/people' },
  { id: 'notifications', icon: BellIcon, label: 'Notifications', path: '/notifications', badge: true },
  { id: 'profile', icon: ProfileIcon, label: 'Profile', path: '/profile' },
];
// isliye apna stack rakhte hain
let _historyStack = [window.location.pathname];
let _historyIndex = 0;

export default function ChatLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { notificationCount, recentChats, isOnline } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeNav, setActiveNav] = useState('dm');

  console.log('[ChatLayout] User:', user, 'isAdmin:', isAdmin);

  // ✅ Auto-redirect admin to dashboard if they land on root
  useEffect(() => {
    if (location.pathname === '/' && (isAdmin || user?.role?.toLowerCase() === 'admin' || user?.Role?.toLowerCase() === 'admin' || user?.displayName === 'Platform Admin')) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, user, location.pathname, navigate]);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Jab bhi location change ho (navigate ke through), stack update karo
  useEffect(() => {
    const path = location.pathname;

    // Agar yeh popstate (back/forward) se aaya hai toh stack mat badlo
    // Hum navigate() se jaate hain toh naya entry push karo
    if (_historyStack[_historyIndex] !== path) {
      // Forward history cut karo (jaise browser karta hai)
      _historyStack = _historyStack.slice(0, _historyIndex + 1);
      _historyStack.push(path);
      _historyIndex = _historyStack.length - 1;
    }

    setCanGoBack(_historyIndex > 0);
    setCanGoForward(_historyIndex < _historyStack.length - 1);
  }, [location]);

  // Active nav highlight
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/rooms')) setActiveNav('rooms');
    else if (path.startsWith('/people')) setActiveNav('people');
    else if (path.startsWith('/notifications')) setActiveNav('notifications');
    else if (path.startsWith('/profile')) setActiveNav('profile');
    else if (path.startsWith('/admin')) setActiveNav('admin');
    else setActiveNav('dm');
  }, [location]);

  const navTo = (item) => {
    setActiveNav(item.id);
    navigate(item.path);
  };

  // ── Back button ──────────────────────────────────────────────────────────
  const goBack = () => {
    if (_historyIndex <= 0) return;
    _historyIndex -= 1;
    const target = _historyStack[_historyIndex];
    setCanGoBack(_historyIndex > 0);
    setCanGoForward(true);
    navigate(target);
  };

  // ── Forward button ───────────────────────────────────────────────────────
  const goForward = () => {
    if (_historyIndex >= _historyStack.length - 1) return;
    _historyIndex += 1;
    const target = _historyStack[_historyIndex];
    setCanGoBack(true);
    setCanGoForward(_historyIndex < _historyStack.length - 1);
    navigate(target);
  };

  const myName = user?.displayName || user?.DisplayName || user?.username || user?.UserName || 'U';

  return (
    <div style={S.layout}>
      {/* ── Left icon sidebar ────────────────────────────────────────────── */}
      <nav style={S.sidebar}>
        <div style={S.sideTop}>
          <div style={S.logo}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="var(--accent)" />
              <circle cx="8" cy="10" r="1.2" fill="white" />
              <circle cx="12" cy="10" r="1.2" fill="white" />
              <circle cx="16" cy="10" r="1.2" fill="white" />
            </svg>
          </div>
          {NAV_ITEMS.map(item => (
            <NavBtn key={item.id} item={item} active={activeNav === item.id}
              badge={item.badge && notificationCount > 0 ? notificationCount : 0}
              onClick={() => navTo(item)} />
          ))}
          {/* Admin icon removed as per request — admins land directly on dashboard */}
        </div>
        <div style={S.sideBottom}>
          <button onClick={() => navTo({ id: 'profile', path: '/profile' })} style={S.avatarBtn}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              color: 'white', position: 'relative',
            }}>
              {myName[0].toUpperCase()}
              <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: 'var(--emerald)', border: '2px solid var(--bg-1)' }} />
            </div>
          </button>
          <button onClick={logout} style={S.logoutBtn} title="Sign out">
            <LogoutIcon />
          </button>
        </div>
      </nav>

      {/* ── Left panel (DM list / Rooms / People etc.) ───────────────────── */}
      {!location.pathname.startsWith('/admin') && (
        <div style={S.leftPanel}>
          <Routes>
            <Route path="/" element={<DMListPanel />} />
            <Route path="/dm/:userId" element={<DMListPanel />} />
            <Route path="/rooms/*" element={<RoomsPanel />} />
            <Route path="/people" element={<PeoplePanel />} />
            <Route path="/notifications" element={<NotificationsPanel />} />
            <Route path="/profile" element={<ProfilePanel />} />
          </Routes>
        </div>
      )}

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div style={S.mainWrap}>

        {/* ✅ Back / Forward bar — pura app mein kaam karega */}
        <div style={S.navBar}>
          <button
            onClick={goBack}
            disabled={!canGoBack}
            style={{ ...S.navBtn, ...(canGoBack ? S.navBtnActive : S.navBtnDisabled) }}
            title="Go back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            style={{ ...S.navBtn, ...(canGoForward ? S.navBtnActive : S.navBtnDisabled) }}
            title="Go forward"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Routes */}
        <div style={S.main}>
          <Routes>
            <Route path="/" element={<WelcomeView />} />
            <Route path="/dm/:userId" element={<DirectMessageView />} />
            <Route path="/rooms/room/:roomId" element={<RoomView />} />
            <Route path="/rooms" element={<WelcomeView type="rooms" />} />
            <Route path="/people" element={<WelcomeView type="people" />} />
            <Route path="/notifications" element={<WelcomeView type="notifications" />} />
            <Route path="/profile" element={<WelcomeView type="profile" />} />
            <Route path="/admin/*" element={<AdminPanel />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DMListPanel
// ─────────────────────────────────────────────────────────────────────────────
function DMListPanel() {
  const { recentChats, isOnline, loadRecentChats } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const { authApi, getMediaUrl } = require('../services/api');
  const SecureImage = require('../components/SecureImage').default;
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => { loadRecentChats(); }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authApi.searchUsers(search);
        const list = Array.isArray(res) ? res : (res?.users ?? res?.data ?? res?.items ?? []);
        setSearchResults(Array.isArray(list) ? list : []);
      } catch (_) { setSearchResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const activeId = location.pathname.match(/\/dm\/(\d+)/)?.[1];
  const goToDM = (uid) => { navigate(`/dm/${uid}`); };
  const safeRecentChats = Array.isArray(recentChats) ? recentChats : [];
  const displayList = search.trim() ? searchResults : safeRecentChats;

  return (
    <div style={P.wrap}>
      <div style={P.header}>
        <h2 style={P.title}>Messages</h2>
        <button onClick={() => navigate('/people')} style={P.newBtn} title="New message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
      <div style={P.searchWrap}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input style={P.searchInput} placeholder="Search people…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={P.list}>
        {searching && <div style={P.empty}><span className="spinner" /></div>}
        {!searching && displayList.length === 0 && (
          <div style={P.empty}>{search ? 'No users found' : 'No recent chats'}</div>
        )}
        {displayList.map(item => {
          const uid = item.userId || item.UserId || item.id || item.partnerId || item.senderId;
          const name = item.displayName || item.DisplayName
            || item.userName || item.UserName
            || item.partnerName || item.username || 'Unknown';
          const avatarUrl = item.avatarUrl || item.AvatarUrl || null;
          const isActive = String(uid) === String(activeId);
          const online = isOnline(uid);
          const lastMsg = item.lastMessage || item.LastMessage || item.content || '';
          const lastTime = item.lastMessageAt || item.LastMessageAt || item.sentAt || item.SentAt;

          return (
            <button key={uid} onClick={() => goToDM(uid)} style={{ ...P.chatItem, ...(isActive ? P.chatItemActive : {}) }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'white', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                <SecureImage
                  src={getMediaUrl(avatarUrl)}
                  alt=""
                  style={{ width: 40, height: 40, objectFit: 'cover' }}
                  fallback={name[0]?.toUpperCase()}
                />
                <span style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: online ? 'var(--emerald)' : 'var(--text-3)', border: '2px solid var(--bg-2)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: isActive ? 'var(--accent-light)' : 'var(--text-0)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{name}</span>
                  {lastTime && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginLeft: 4 }}>
                      {new Date(lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {lastMsg || (online ? 'Online' : 'Offline')}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────
function ChatIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>; }
function RoomsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>; }
function PeopleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
function BellIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>; }
function ProfileIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>; }
function AdminIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>; }
function LogoutIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>; }

function NavBtn({ item, active, badge, onClick }) {
  const Icon = item.icon;
  return (
    <button onClick={onClick} title={item.label} style={{ ...NS.btn, ...(active ? NS.btnActive : {}) }}>
      <Icon />
      {badge > 0 && <span style={NS.badge}>{badge > 99 ? '99+' : badge}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const NS = {
  btn: { width: 44, height: 44, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', transition: 'all var(--transition)', position: 'relative' },
  btnActive: { background: 'var(--accent-dim)', color: 'var(--accent-light)' },
  badge: { position: 'absolute', top: 5, right: 5, background: 'var(--rose)', color: 'white', fontSize: 9, fontWeight: 700, borderRadius: 10, padding: '1px 4px', minWidth: 14, textAlign: 'center', border: '1px solid var(--bg-1)' },
};

const S = {
  layout: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: 'var(--sidebar-w)', background: 'var(--bg-1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', flexShrink: 0, gap: 4 },
  sideTop: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 },
  sideBottom: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  logo: { width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarBtn: { cursor: 'pointer' },
  logoutBtn: { color: 'var(--text-3)', padding: 8, borderRadius: 'var(--radius-sm)', transition: 'color var(--transition)' },
  leftPanel: { width: 'var(--left-panel-w)', background: 'var(--bg-1)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' },

  //mainWrap: back/forward bar + main content dono ko wrap karta hai
  mainWrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-0)' },

  //Back/Forward button bar — top mein slim strip
  navBar: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 12px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-1)',
    flexShrink: 0,
  },
  navBtn: {
    width: 28, height: 28, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all var(--transition)',
    border: '1px solid var(--border)',
  },
  navBtnActive: {
    background: 'var(--bg-3)',
    color: 'var(--text-1)',
    cursor: 'pointer',
  },
  navBtnDisabled: {
    background: 'transparent',
    color: 'var(--text-3)',
    opacity: 0.35,
    cursor: 'not-allowed',
    borderColor: '1px solid transparent',
  },

  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
};

const P = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 12px', flexShrink: 0 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  newBtn: { width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-accent)' },
  searchWrap: { margin: '0 12px 10px', position: 'relative' },
  searchInput: { width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px 8px 30px', fontSize: 13, color: 'var(--text-0)' },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  chatItem: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background var(--transition)', marginBottom: 2, textAlign: 'left' },
  chatItemActive: { background: 'var(--accent-dim)' },
  empty: { display: 'flex', justifyContent: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 },
};