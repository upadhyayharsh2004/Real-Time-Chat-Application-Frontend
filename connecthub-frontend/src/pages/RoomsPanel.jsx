import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { roomApi, getMediaUrl } from '../services/api';
import { hubManager } from '../services/signalr';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import SecureImage from '../components/SecureImage';

export default function RoomsPanel() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { roomLastMessages, roomUnreadCounts } = useChat();
  const { isAdmin } = useAuth();
  const [myRooms, setMyRooms] = useState([]);
  const [publicRooms, setPublicRooms] = useState([]);
  const [tab, setTab] = useState(isAdmin ? 'public' : 'my');
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', roomType: 'PUBLIC' });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  useEffect(() => {
    loadMyRooms();
    loadPublicRooms();
  }, []);

  useEffect(() => {
    const handleJoined = () => loadMyRooms();
    const handleUpdated = (e) => {
      const { roomId: rid, name, description } = e.detail;
      const update = r => (r.roomId || r.id) === rid ? { ...r, name, description } : r;
      setMyRooms(p => p.map(update));
      setPublicRooms(p => p.map(update));
    };
    const handleLeft = (e) => {
      const { roomId: rid } = e.detail;
      setMyRooms(p => p.filter(r => (r.roomId || r.id) !== rid));
    };
    const handleMemberUpdate = (e) => {
      loadMyRooms();
      loadPublicRooms();
    };

    window.addEventListener('room:joined', handleJoined);
    window.addEventListener('room:updated', handleUpdated);
    window.addEventListener('room:left', handleLeft);
    window.addEventListener('room:member-update', handleMemberUpdate);
    return () => {
      window.removeEventListener('room:joined', handleJoined);
      window.removeEventListener('room:updated', handleUpdated);
      window.removeEventListener('room:left', handleLeft);
      window.removeEventListener('room:member-update', handleMemberUpdate);
    };
  }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await roomApi.searchRooms(search);
        setSearchResults(r?.rooms || r?.data || r || []);
      } catch (_) { }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadMyRooms = async () => {
    try {
      const r = await roomApi.getMyRooms();
      const list = Array.isArray(r) ? r : (r?.data ?? r?.rooms ?? r?.items ?? []);
      setMyRooms(Array.isArray(list) ? list : []);
    } catch (_) { }
  };

  const loadPublicRooms = async () => {
    setLoading(true);
    try {
      const r = await roomApi.getPublicRooms();
      const list = Array.isArray(r) ? r
        : Array.isArray(r?.data?.rooms) ? r.data.rooms
          : Array.isArray(r?.data) ? r.data
            : Array.isArray(r?.rooms) ? r.rooms
              : [];
      setPublicRooms(list);
    } catch (_) { }
    setLoading(false);
  };

  const handleJoin = async (roomId) => {
    try {
      await roomApi.joinRoom(roomId);
      const hub = hubManager.get('rooms');
      if (hub) await hub.invoke('JoinRoom', roomId).catch(() => { });
      await loadMyRooms();
      await loadPublicRooms();
      window.dispatchEvent(new CustomEvent('room:joined', { detail: { roomId } }));
      navigate(`/rooms/room/${roomId}`);
    } catch (e) { alert(e.message); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await roomApi.createRoom(createForm);
      const newRoom = res?.room || res?.data || res;
      const newId = newRoom?.roomId || newRoom?.id;
      await loadMyRooms();
      await loadPublicRooms();
      setShowCreate(false);
      setCreateForm({ name: '', description: '', roomType: 'PUBLIC' });
      if (newId) {
        window.dispatchEvent(new CustomEvent('room:joined', { detail: { roomId: newId } }));
        navigate(`/rooms/room/${newId}`);
      }
    } catch (e) { alert(e.message); }
    setCreating(false);
  };

  const getRoomSubtitle = (room) => {
    const rid = room.roomId || room.id;
    const ctxMsg = roomLastMessages?.[rid];

    if (ctxMsg?.lastMessage) return ctxMsg.lastMessage;
    if (room.lastMessageContent) return room.lastMessageContent;

    return room.description || `${room.memberCount || 0} members`;
  };

  const displayList = searchResults !== null ? searchResults : (tab === 'my' ? myRooms : publicRooms);

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h2 style={S.title}>Rooms</h2>
        <button onClick={() => setShowCreate(s => !s)} style={S.newBtn} title="Create room">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={S.createForm}>
          <input
            style={S.input}
            placeholder="Room name"
            value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            required
            autoFocus
          />
          <input style={S.input} placeholder="Description (optional)" value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} />
          <select style={S.select} value={createForm.roomType} onChange={e => setCreateForm(f => ({ ...f, roomType: e.target.value }))}>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" disabled={creating} style={S.createBtn}>{creating ? '…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} style={S.cancelBtn}>Cancel</button>
          </div>
        </form>
      )}

      <div style={S.searchWrap}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input style={S.searchInput} placeholder="Search rooms…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {searchResults === null && (
        <div style={S.tabs}>
          {['my', 'public'].map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === 'public') loadPublicRooms(); }} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }}>
              {t === 'my' ? 'My Rooms' : 'Discover'}
            </button>
          ))}
        </div>
      )}

      <div style={S.list}>
        {loading && <div style={S.empty}><span className="spinner" /></div>}
        {!loading && displayList.length === 0 && (
          <div style={S.empty}>{tab === 'my' ? 'Join a room to get started' : 'No public rooms found'}</div>
        )}
        {displayList.map(room => {
          const rid = room.roomId || room.id;
          const isActive = String(rid) === String(roomId);
          const isMember = myRooms.some(r => (r.roomId || r.id) === rid);
          const subtitle = getRoomSubtitle(room);
          return (
            <div key={rid} style={{ ...S.roomItem, ...(isActive ? S.roomItemActive : {}) }}
              onClick={() => (isMember || isAdmin) ? navigate(`/rooms/room/${rid}`) : null}>
              <div style={S.roomIconBox}>
                <SecureImage
                  src={getMediaUrl(room.avatarUrl || room.AvatarUrl)}
                  alt={room.name}
                  style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                  fallback={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></svg>}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={S.roomName}>{room.name || room.roomName}</div>

                </div>
                <div style={S.roomDesc}>{subtitle}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{
                  fontSize: 10,
                  color: room.roomType === 'PUBLIC' ? 'var(--emerald)' : 'var(--amber)',
                  background: room.roomType === 'PUBLIC' ? 'var(--emerald-dim)' : 'rgba(245,158,11,0.1)',
                  padding: '2px 6px', borderRadius: 4, fontWeight: 600
                }}>
                  {room.roomType}
                </span>
                {!isMember && (
                  <button onClick={(e) => { e.stopPropagation(); handleJoin(rid); }} style={S.joinBtn}>Join</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 12px', flexShrink: 0 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  newBtn: { width: 30, height: 30, borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-accent)' },
  createForm: { margin: '0 12px 8px', padding: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 8 },
  input: { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-0)' },
  select: { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-0)' },
  createBtn: { flex: 1, background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '8px', fontSize: 13, fontWeight: 600 },
  cancelBtn: { flex: 1, background: 'var(--bg-4)', color: 'var(--text-2)', borderRadius: 8, padding: '8px', fontSize: 13 },
  searchWrap: { margin: '0 12px 8px', position: 'relative' },
  searchInput: { width: '100%', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px 8px 30px', fontSize: 13, color: 'var(--text-0)' },
  tabs: { display: 'flex', margin: '0 12px 8px', background: 'var(--bg-3)', borderRadius: 8, padding: 3 },
  tab: { flex: 1, padding: '6px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', transition: 'all var(--transition)' },
  tabActive: { background: 'var(--bg-1)', color: 'var(--text-0)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' },
  list: { flex: 1, overflowY: 'auto', padding: '4px 8px' },
  roomItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background var(--transition)', marginBottom: 2 },
  roomItemActive: { background: 'var(--accent-dim)' },
  roomIconBox: { width: 36, height: 36, borderRadius: 8, background: 'var(--bg-4)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)', flexShrink: 0 },
  roomName: { fontSize: 13, fontWeight: 600, color: 'var(--text-0)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' },
  roomDesc: { fontSize: 11, color: 'var(--text-2)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: 1 },
  joinBtn: { fontSize: 11, fontWeight: 600, color: 'var(--accent-light)', background: 'var(--accent-dim)', borderRadius: 6, padding: '3px 8px', border: '1px solid var(--border-accent)' },
  empty: { display: 'flex', justifyContent: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 13 },
  unreadBadge: { background: 'var(--accent)', color: 'white', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' },
};