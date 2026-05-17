import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useNavigate } from 'react-router-dom';

const TIPS = {
  default: {
    icon: '💬',
    title: 'Welcome to ConnectHub',
    sub: 'Select a conversation from the left to start messaging, or search for someone to chat with.',
    actions: [{ label: 'Find People', path: '/people' }, { label: 'Browse Rooms', path: '/rooms' }],
  },
  rooms: {
    icon: '#',
    title: 'Explore Chat Rooms',
    sub: 'Join public rooms or create your own private group. Click a room on the left to open it.',
    actions: [],
  },
  people: {
    icon: '👥',
    title: 'Connect with People',
    sub: 'Search for users and start direct conversations. Click on any person to message them.',
    actions: [],
  },
  notifications: {
    icon: '🔔',
    title: 'Notifications',
    sub: 'Your notifications appear in the left panel. Stay up to date with messages, mentions, and room invites.',
    actions: [],
  },
  profile: {
    icon: '👤',
    title: 'Your Profile',
    sub: 'View and edit your profile information in the left panel.',
    actions: [],
  },
  admin: {
    icon: '🛡',
    title: 'Admin Dashboard',
    sub: 'Manage users, rooms, messages and view platform analytics from the left panel.',
    actions: [],
  },
};

export default function WelcomeView({ type = 'default' }) {
  const { user } = useAuth();
  const { recentChats, isOnline } = useChat();
  const navigate = useNavigate();
  const tip = TIPS[type] || TIPS.default;

  const safeChats = Array.isArray(recentChats) ? recentChats : [];
  const stats = [
    { label: 'Recent chats', value: safeChats.length },
    { label: 'Active now', value: safeChats.filter(c => isOnline(c.userId || c.partnerId)).length },
  ];

  return (
    <div style={S.wrap}>
      <div style={S.bg} />
      <div style={S.card} className="animate-fade">
        {/* Logo mark */}
        <div style={S.iconWrap}>
          <span style={S.icon}>{tip.icon}</span>
        </div>

        <h1 style={S.title}>
          {type === 'default' ? `Hey, ${user?.displayName || user?.username || 'there'} 👋` : tip.title}
        </h1>
        <p style={S.sub}>{tip.sub}</p>

        {type === 'default' && (
          <div style={S.statsRow}>
            {stats.map(s => (
              <div key={s.label} style={S.statBox}>
                <div style={S.statValue}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {tip.actions.length > 0 && (
          <div style={S.actions}>
            {tip.actions.map(a => (
              <button key={a.label} onClick={() => navigate(a.path)} style={S.actionBtn}>
                {a.label}
              </button>
            ))}
          </div>
        )}

        {type === 'default' && (
          <div style={S.features}>
            {[
              { icon: '⚡', label: 'Real-time messaging via SignalR' },
              { icon: '🔒', label: 'JWT-secured API endpoints' },
              { icon: '📁', label: 'File & media sharing' },
              { icon: '🌐', label: '6 microservices architecture' },
            ].map(f => (
              <div key={f.label} style={S.feature}>
                <span style={S.featureIcon}>{f.icon}</span>
                <span style={S.featureLabel}>{f.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-0)', position: 'relative', overflow: 'hidden',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(108,99,255,0.07) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 480, padding: '40px 32px',
    background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20, background: 'var(--accent-dim)',
    border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 24px', fontSize: 32,
  },
  icon: { lineHeight: 1 },
  title: {
    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color: 'var(--text-0)',
    marginBottom: 10,
  },
  sub: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 24 },
  statsRow: { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 },
  statBox: {
    flex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '12px',
  },
  statValue: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--accent-light)' },
  statLabel: { fontSize: 11, color: 'var(--text-3)', marginTop: 2 },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 },
  actionBtn: {
    background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '10px 20px',
    fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)',
  },
  features: { display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' },
  feature: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
    background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border)',
  },
  featureIcon: { fontSize: 16, flexShrink: 0 },
  featureLabel: { fontSize: 13, color: 'var(--text-1)' },
};
