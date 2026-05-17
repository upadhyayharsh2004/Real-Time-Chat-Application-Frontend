import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { roomApi, mediaApi, authApi, getMediaUrl } from '../services/api';
import { hubManager, HubState } from '../services/signalr';
import MessageBubble from '../components/MessageBubble';
import MessageInput from '../components/MessageInput';
import SecureImage from '../components/SecureImage';

export default function RoomView() {
  console.log('[RoomView] Rendering...');
  const { roomId } = useParams();
  const rid = Number(roomId);
  const { user, isAdmin: isPlatformAdmin } = useAuth();
  const { messages, convKey, loadMessages, setActiveRoomId, clearRoomUnread } = useChat();
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const bottomRef = useRef();
  const key = convKey('room', rid);
  const msgs = messages[key] || [];

  const isRoomAdmin = members.find(
    m => (Number(m.userId) === Number(user?.id)) && m.role === 'ADMIN'
  );

  const canManage = isRoomAdmin || isPlatformAdmin;

  const isSoleAdmin = isRoomAdmin && members.filter(m => m.role === 'ADMIN').length === 1;
  const otherMembers = members.filter(
    m => Number(m.userId) !== Number(user?.id)
  );

  const resolveMembers = async (rawMembers) => {
    const resolved = await Promise.all(
      rawMembers.map(async (m) => {
        const existingName = m.displayName || m.userName || m.username || '';
        if (existingName && !existingName.startsWith('User ')) return m;
        try {
          const res = await authApi.getProfile(m.userId);
          const p = res?.data || res?.user || res;
          const splitCamelCase = (name) => {
            if (!name || name.includes(' ')) return name;
            return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
          };
          const candidates = [
            p?.displayName || p?.DisplayName || '',
            p?.userName || p?.UserName || '',
          ].map(s => splitCamelCase(s.trim())).filter(Boolean);
          const fullName = candidates.find(s => s.includes(' '));
          const displayName = fullName || candidates[0] || `User ${m.userId}`;
          return { ...m, displayName, avatarUrl: p?.avatarUrl || p?.AvatarUrl || null };
        } catch {
          return m;
        }
      })
    );
    setMembers(resolved);
  };

  // ── Load room data + SignalR join ─────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      roomApi.getRoom(rid).then(r => {
        const d = r?.room || r?.data || r;
        setRoom(d);
        setEditName(d?.name || '');
        setEditDesc(d?.description || '');
      }),
      roomApi.getMembers(rid).then(async r => {
        const raw = r?.members || r?.data || r || [];
        setMembers(raw);
        resolveMembers(raw);
      }),
    ]).catch(() => { }).finally(() => setLoading(false));

    loadMessages('room', rid);
    setActiveRoomId(rid);
    clearRoomUnread(rid);

    return () => {
      setActiveRoomId(null);
    };
  }, [rid, setActiveRoomId, clearRoomUnread, loadMessages]);

  useEffect(() => {
    const handleMemberUpdate = (e) => {
      if (Number(e.detail.roomId) === rid) {
        console.log(`[RoomView] Member update received for room ${rid}, refreshing...`);
        // Refresh members list (this updates the header count via members.length)
        roomApi.getMembers(rid).then(async r => {
          const raw = r?.members || r?.data || r || [];
          setMembers(raw);
          resolveMembers(raw);
          // Also update the room object's memberCount so RoomsPanel subtitle refreshes
          setRoom(prev => prev ? { ...prev, memberCount: raw.length } : prev);
        }).catch(() => { });
      }
    };
    window.addEventListener('room:member-update', handleMemberUpdate);
    return () => window.removeEventListener('room:member-update', handleMemberUpdate);
  }, [rid]);

  // ── Auto-scroll on new messages ───────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  // ── Mark messages as read ─────────────────────────────────────
  useEffect(() => {
    if (msgs.length === 0) return;
    msgs.forEach(msg => {
      if (!msg.isRead && Number(msg.senderId) !== Number(user?.id)) {
        // markRead(msg.messageId); // uncomment when markRead is available
      }
    });
  }, [msgs.length, key]);

  const loadMedia = async () => {
    try {
      const res = await mediaApi.getByRoom(rid);
      setMediaFiles(res?.files || res?.data || res || []);
    } catch (_) { }
  };

  const handleLeaveClick = () => setLeaveModal(true);

  const handleLeaveConfirm = async () => {
    setLeaveLoading(true);
    try {
      await roomApi.leaveRoom(rid);
      window.dispatchEvent(new CustomEvent('room:left', { detail: { roomId: rid } }));
      window.location.href = '/rooms';
    } catch (err) {
      setLeaveLoading(false);
      setLeaveModal(false);
      const msg = err?.response?.data?.message || err?.message || 'Could not leave room.';
      alert(msg);
    }
  };

  // ── FIXED: Handle invite with 409 conflict handling ───────────
  const handleInvite = async (searchUser) => {
    try {
      await roomApi.inviteUser(rid, { invitedUserId: searchUser.userId || searchUser.id });
      // We no longer add to `members` here. 
      // The InviteBar component tracks this in `invitedIds` locally to filter them out of subsequent searches.
      // Once they accept, SignalR will trigger a refresh of the members list.
    } catch (err) {
      const status = err?.response?.status;
      if (status === 409) {
        alert('This user is already a member of the room.');
      } else {
        const msg = err?.response?.data?.message || err?.message || 'Could not invite user.';
        alert(msg);
      }
    }
  };

  const handleUpdateRoom = async () => {
    try {
      await roomApi.updateRoom(rid, { name: editName, description: editDesc });
      setRoom(r => ({ ...r, name: editName, description: editDesc }));
      setEditMode(false);
      window.dispatchEvent(new CustomEvent('room:updated', {
        detail: { roomId: rid, name: editName, description: editDesc }
      }));
    } catch (_) { }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await roomApi.removeMember(rid, userId);
      setMembers(m => m.filter(x => Number(x.userId) !== Number(userId)));
    } catch (_) { }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await roomApi.changeMemberRole(rid, userId, role);
      setMembers(m => m.map(x => Number(x.userId) === Number(userId) ? { ...x, role } : x));
    } catch (_) { }
  };

  const roomName = room?.name || `Room ${rid}`;

  const leaveModalMessage = () => {
    if (isSoleAdmin && otherMembers.length === 0)
      return 'You are the last member. Leaving will permanently delete this room and all its messages.';
    if (isSoleAdmin)
      return `You are the only admin. Leaving will automatically promote ${otherMembers[0]?.displayName || otherMembers[0]?.userName || 'the next member'} to admin.`;
    return 'Are you sure you want to leave this room?';
  };

  return (
    <div style={S.wrap}>
      {leaveModal && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <div style={S.modalTitle}>Leave #{roomName}?</div>
            <div style={S.modalBody}>{leaveModalMessage()}</div>
            <div style={S.modalActions}>
              <button onClick={() => setLeaveModal(false)} style={S.modalCancelBtn} disabled={leaveLoading}>Cancel</button>
              <button onClick={handleLeaveConfirm} style={S.modalLeaveBtn} disabled={leaveLoading}>
                {leaveLoading ? 'Leaving…' : 'Leave Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.roomIcon}><HashIcon /></div>
          <div>
            {editMode ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={S.editInput} />
                <button onClick={handleUpdateRoom} style={S.saveBtn}>Save</button>
                <button onClick={() => setEditMode(false)} style={{ color: 'var(--text-2)', fontSize: 12 }}>✕</button>
              </div>
            ) : (
              <div style={S.roomName}>{loading ? '…' : roomName}</div>
            )}
            <div style={S.roomMeta}>{members.length} members · {room?.roomType || 'PUBLIC'}</div>
          </div>
        </div>
        <div style={S.headerActions}>
          {canManage && (
            <button onClick={() => setEditMode(e => !e)} style={{ ...S.iconBtn, ...(editMode ? S.iconBtnActive : {}) }} title="Edit room">
              <EditIcon />
            </button>
          )}
          {canManage && (
            <button onClick={() => setShowInvite(s => !s)} style={{ ...S.iconBtn, ...(showInvite ? S.iconBtnActive : {}) }} title="Invite member">
              <PlusIcon />
            </button>
          )}
          <button onClick={() => { setShowMedia(s => !s); if (!showMedia) loadMedia(); setShowMembers(false); }} style={{ ...S.iconBtn, ...(showMedia ? S.iconBtnActive : {}) }} title="Media gallery">
            <ImageIcon />
          </button>
          <button onClick={() => { setShowMembers(s => !s); setShowMedia(false); }} style={{ ...S.iconBtn, ...(showMembers ? S.iconBtnActive : {}) }} title="Members">
            <MembersIcon />
          </button>
          <button onClick={handleLeaveClick} style={S.leaveBtn} title="Leave room">Leave</button>
        </div>
      </div>

      <div style={S.body}>
        <div style={S.msgCol}>
          {/* FIXED: pass members so InviteBar can filter out existing members */}
          {showInvite && (
            <InviteBar
              onInvite={handleInvite}
              onClose={() => setShowInvite(false)}
              existingMembers={members}
            />
          )}
          <div style={S.messages}>
            {msgs.length === 0 && !loading && (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>#</div>
                <div style={S.emptyTitle}>Welcome to #{roomName}</div>
                <div style={S.emptySub}>{room?.description || 'Start the conversation!'}</div>
              </div>
            )}
            {msgs.map((msg, i) => {
              const prev = msgs[i - 1];
              const showDate = !prev || dayChanged(prev.sentAt, msg.sentAt);
              return (
                <React.Fragment key={msg.messageId || i}>
                  {showDate && <DateSep date={msg.sentAt} />}
                  <MessageBubble msg={msg} convKey={key} membersCount={members.length} />
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <MessageInput type="room" targetId={rid} />
        </div>

        {(showMembers || showMedia) && (
          <div style={S.rightPanel}>
            {showMembers && (
              <MembersPanel members={members} currentUser={user} isAdmin={canManage}
                onRemove={handleRemoveMember} onRoleChange={handleRoleChange} />
            )}
            {showMedia && <MediaGallery files={mediaFiles} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── FIXED: InviteBar now accepts existingMembers and filters them out ─────────
function InviteBar({ onInvite, onClose, existingMembers = [] }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [invitedIds, setInvitedIds] = useState(new Set());

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await authApi.searchUsers(q);
        const all = r?.users || r?.data || r || [];

        // Build a set of existing member user IDs
        const memberIds = new Set(existingMembers.map(m => Number(m.userId)));

        // Filter out users who are already members or already invited this session
        const filtered = all.filter(u => {
          const uid = Number(u.userId || u.id);
          return !memberIds.has(uid) && !invitedIds.has(uid);
        });

        setResults(filtered);
      } catch (_) { }
    }, 300);
    return () => clearTimeout(t);
  }, [q, existingMembers, invitedIds]);

  const handleInviteClick = async (u) => {
    const uid = Number(u.userId || u.id);
    await onInvite(u);
    // Optimistically mark as invited so button disappears immediately
    setInvitedIds(prev => new Set([...prev, uid]));
    setResults(prev => prev.filter(x => Number(x.userId || x.id) !== uid));
  };

  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-0)' }}
          placeholder="Search users to invite…"
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus
        />
        <button onClick={onClose} style={{ color: 'var(--text-2)' }}>✕</button>
      </div>

      {q.trim() && results.length === 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)', padding: '4px 8px' }}>
          No users found (or all matching users are already members)
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.slice(0, 5).map(u => (
            <div
              key={u.userId || u.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 8, background: 'var(--bg-3)' }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-0)' }}>{u.displayName || u.userName}</span>
              <button
                onClick={() => handleInviteClick(u)}
                style={{ fontSize: 12, color: 'var(--accent-light)', background: 'var(--accent-dim)', borderRadius: 6, padding: '3px 8px' }}
              >
                Invite
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MembersPanel({ members, currentUser, isAdmin, onRemove, onRoleChange }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-0)', marginBottom: 12 }}>Members ({members.length})</h3>
      {members.map(m => {
        const name = m.displayName || m.userName || m.username || `User ${m.userId}`;
        return (
          <div key={m.memberId || m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0, overflow: 'hidden' }}>
              <SecureImage
                src={getMediaUrl(m.avatarUrl)}
                alt={name}
                style={{ width: 32, height: 32, objectFit: 'cover' }}
                fallback={name[0]?.toUpperCase()}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{name}</div>
              <div style={{ fontSize: 11, color: m.role === 'ADMIN' ? 'var(--accent-light)' : 'var(--text-3)' }}>{m.role}</div>
            </div>
            {isAdmin && Number(m.userId) !== Number(currentUser?.id) && (
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={m.role} onChange={e => onRoleChange(m.userId, e.target.value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-1)', fontSize: 11, padding: '2px 4px' }}>
                  <option value="MEMBER">Member</option>
                  <option value="MODERATOR">Mod</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button onClick={() => onRemove(m.userId)} style={{ color: 'var(--rose)', fontSize: 12, padding: '2px 6px', background: 'rgba(244,63,94,0.1)', borderRadius: 6 }}>✕</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MediaGallery({ files }) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 16 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-0)', marginBottom: 12 }}>Media Gallery</h3>
      {files.length === 0 ? <div style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>No media shared yet</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {files.map(f => (
            <a key={f.fileId} href={getMediaUrl(f.blobUrl || f.sasUrl)} target="_blank" rel="noreferrer">
              {f.contentType?.startsWith('image/') ? (
                <SecureImage src={getMediaUrl(f.blobUrl || f.sasUrl)} alt={f.fileName} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
              ) : (
                <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: 24 }}>📄</span>
                  <span style={{ fontSize: 10, color: 'var(--text-2)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{f.fileName}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function dayChanged(a, b) { if (!a || !b) return false; return new Date(a).toDateString() !== new Date(b).toDateString(); }

function DateSep({ date }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const label = d.toDateString() === today.toDateString() ? 'Today'
    : d.toDateString() === yesterday.toDateString() ? 'Yesterday'
      : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 8px', padding: '0 16px' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function HashIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>; }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>; }
function ImageIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>; }
function MembersIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>; }

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  roomIcon: { width: 40, height: 40, borderRadius: 10, background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 },
  roomName: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--text-0)' },
  roomMeta: { fontSize: 12, color: 'var(--text-2)', marginTop: 1 },
  editInput: { background: 'var(--bg-3)', border: '1px solid var(--border-accent)', borderRadius: 6, padding: '4px 8px', fontSize: 14, color: 'var(--text-0)' },
  saveBtn: { background: 'var(--accent)', color: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600 },
  headerActions: { display: 'flex', gap: 6, alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', transition: 'all var(--transition)' },
  iconBtnActive: { background: 'var(--accent-dim)', color: 'var(--accent-light)', border: '1px solid var(--border-accent)' },
  leaveBtn: { fontSize: 12, fontWeight: 600, color: 'var(--rose)', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 8, padding: '6px 12px' },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  msgCol: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 0 },
  rightPanel: { width: 260, borderLeft: '1px solid var(--border)', background: 'var(--bg-1)', overflow: 'hidden', flexShrink: 0 },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '60px 0' },
  emptyIcon: { fontSize: 48, fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--text-3)', marginBottom: 8 },
  emptyTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  emptySub: { fontSize: 14, color: 'var(--text-2)', textAlign: 'center', maxWidth: 280 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  modal: { background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: 360, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 12 },
  modalTitle: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-0)' },
  modalBody: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  modalCancelBtn: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px' },
  modalLeaveBtn: { fontSize: 13, fontWeight: 600, color: 'white', background: 'var(--rose)', border: 'none', borderRadius: 8, padding: '8px 16px' },
};