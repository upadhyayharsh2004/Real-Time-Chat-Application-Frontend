import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat, resolveAndCacheProfile } from '../context/ChatContext';
import { authApi, messageApi, getMediaUrl } from '../services/api';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import SecureImage from '../components/SecureImage';

export default function DirectMessageView() {
  const { userId } = useParams();
  const uid = Number(userId);
  const { user } = useAuth();
  const { messages, convKey, loadMessages, isOnline, typingUsers, markRead } = useChat();
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const bottomRef = useRef();
  const scrollRef = useRef();
  const key = convKey('dm', uid);
  const msgs = messages[key] || [];
  const typing = typingUsers[key];
  const isTyping = typing && typing.size > 0;
  const online = isOnline(uid);

  useEffect(() => {
    setPartner(null);
    setLoading(true);

    authApi.getProfile(uid)
      .then(p => {
        const profile = p?.user || p?.data || p;

        // FIX: Seed the shared profile cache BEFORE loadMessages() is called.
        // This guarantees that when ChatContext.loadMessages() maps over the
        // fetched messages and looks up profileCache[senderId], it finds a real
        // displayName instead of the "User N" placeholder, so avatars render
        // correctly on the very first load after a refresh.
        if (resolveAndCacheProfile) {
          resolveAndCacheProfile(uid, {
            displayName: profile?.displayName || profile?.DisplayName
              || profile?.userName || profile?.UserName
              || `User ${uid}`,
            avatarUrl: profile?.avatarUrl || profile?.AvatarUrl || null,
          });
        }

        setPartner(profile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadMessages('dm', uid).then(list => {
      if (!list || list.length < 50) setHasMore(false);
    });
  }, [uid]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [msgs.length]);

  useEffect(() => {
    const unread = msgs.filter(m => 
      !(m.isRead ?? m.IsRead) && 
      Number(m.senderId) !== Number(user?.id) && 
      (m.messageId || m.MessageId)
    );
    unread.forEach(m => markRead(m.messageId || m.MessageId));
  }, [msgs, user?.id, markRead]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await messageApi.getDirectMessages(uid, page + 1);
      const list = res?.messages || res?.data || res || [];
      if (list.length < 50) setHasMore(false);
      if (list.length > 0) setPage(p => p + 1);
    } catch {}
    setLoadingMore(false);
  };

  const handleSearch = async () => {
    if (!searchQ.trim()) { setSearchResults(null); return; }
    try {
      const res = await messageApi.searchMessages(searchQ);
      setSearchResults(res?.messages || res?.data || res || []);
    } catch { setSearchResults([]); }
  };

  const partnerName =
    partner?.displayName || partner?.DisplayName ||
    partner?.userName   || partner?.UserName   ||
    partner?.username   || `User ${uid}`;

  const partnerAvatar = partner?.avatarUrl || partner?.AvatarUrl || null;

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.avatar}>
            <SecureImage
              src={getMediaUrl(partnerAvatar)}
              alt=""
              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
              fallback={<span style={S.avatarLetter}>{partnerName[0]?.toUpperCase()}</span>}
            />
            <span style={{ ...S.statusDot, background: online ? 'var(--emerald)' : 'var(--text-3)' }} />
          </div>
          <div>
            <div style={S.headerName}>{loading ? '…' : partnerName}</div>
            <div style={S.headerStatus}>
              {isTyping ? (
                <span style={S.typingText}>typing<TypingDots /></span>
              ) : (
                <span style={{ color: online ? 'var(--emerald)' : 'var(--text-3)' }}>
                  {online ? '● Online' : '○ Offline'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={S.headerActions}>
          <button
            onClick={() => setShowSearch(s => !s)}
            style={{ ...S.actionBtn, ...(showSearch ? S.actionBtnActive : {}) }}
            title="Search messages"
          >
            <SearchIcon />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div style={S.searchBar}>
          <input
            style={S.searchInput}
            placeholder="Search in this conversation…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <button onClick={handleSearch} style={S.searchBtn}>Search</button>
          {searchResults !== null && (
            <button onClick={() => { setSearchResults(null); setSearchQ(''); }} style={S.clearBtn}>
              ✕ Clear
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} style={S.messages}>
        {hasMore && (
          <div style={S.loadMoreWrap}>
            <button onClick={loadMore} style={S.loadMoreBtn} disabled={loadingMore}>
              {loadingMore
                ? <span className="spinner" style={{ width: 14, height: 14 }} />
                : 'Load earlier messages'}
            </button>
          </div>
        )}

        {(searchResults !== null ? searchResults : msgs).length === 0 && !loading && (
          <div style={S.emptyState}>
            <div style={S.emptyIcon}>💬</div>
            <div style={S.emptyTitle}>Start a conversation</div>
            <div style={S.emptySub}>Send your first message to {partnerName}</div>
          </div>
        )}

        {(searchResults !== null ? searchResults : msgs).map((msg, i) => {
          const prev = msgs[i - 1];
          const showDate = !prev || dayChanged(prev.sentAt, msg.sentAt);
          return (
            <React.Fragment key={msg.messageId || i}>
              {showDate && <DateSeparator date={msg.sentAt} />}
              <MessageBubble msg={msg} convKey={key} membersCount={2} />
            </React.Fragment>
          );
        })}

        {isTyping && (
          <div style={S.typingBubble}>
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput type="dm" targetId={uid} />
    </div>
  );
}

function dayChanged(a, b) {
  if (!a || !b) return false;
  return new Date(a).toDateString() !== new Date(b).toDateString();
}

function DateSeparator({ date }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  let label;
  if (d.toDateString() === today.toDateString()) label = 'Today';
  else if (d.toDateString() === yesterday.toDateString()) label = 'Yesterday';
  else label = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 8px', padding: '0 16px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 4 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: '50%', background: 'var(--text-2)',
          display: 'inline-block', animation: `blink 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 },
  avatarLetter: { color: 'white', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font-display)' },
  statusDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--bg-1)' },
  headerName: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-0)' },
  headerStatus: { fontSize: 12, color: 'var(--text-2)', marginTop: 1 },
  typingText: { color: 'var(--text-2)', display: 'flex', alignItems: 'center' },
  headerActions: { display: 'flex', gap: 6 },
  actionBtn: { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', transition: 'all var(--transition)' },
  actionBtnActive: { background: 'var(--accent-dim)', color: 'var(--accent-light)', borderColor: 'var(--border-accent)' },
  searchBar: { display: 'flex', gap: 8, padding: '10px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', alignItems: 'center', flexShrink: 0 },
  searchInput: { flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-0)' },
  searchBtn: { background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  clearBtn: { color: 'var(--text-2)', fontSize: 12, padding: '4px 8px' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 0 },
  loadMoreWrap: { display: 'flex', justifyContent: 'center', padding: '8px 0 16px' },
  loadMoreBtn: { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 16px', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '60px 0' },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  emptySub: { fontSize: 14, color: 'var(--text-2)' },
  typingBubble: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--bg-3)', borderRadius: '16px 16px 16px 4px', width: 'fit-content', marginTop: 4 },
};