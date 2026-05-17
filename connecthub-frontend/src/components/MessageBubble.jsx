import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { messageApi, mediaApi, getMediaUrl } from '../services/api';
import { hubManager } from '../services/signalr';
import Avatar from './Avatar';
import SecureImage from './SecureImage';

function timeStr(t) {
  if (!t) return '';
  const d = new Date(t);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function extractFileId(url) {
  if (!url) return null;
  const match = url.match(GUID_RE);
  return match ? match[0] : null;
}
function getDeletedForMe(userId) {
  try {
    const raw = localStorage.getItem(`deletedForMe_${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}
function addDeletedForMe(userId, messageId) {
  const set = getDeletedForMe(userId);
  set.add(String(messageId));
  localStorage.setItem(`deletedForMe_${userId}`, JSON.stringify([...set]));
}
export function isDeletedForMe(userId, messageId) {
  return getDeletedForMe(userId).has(String(messageId));
}

export default function MessageBubble({ msg, convKey, onEdit, membersCount }) {
  const { user } = useAuth();
  const { markRead } = useChat();
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(msg.content);
  const [fileLoading, setFileLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState(msg.mediaUrl);
  const [hiddenForMe, setHiddenForMe] = useState(
    () => isDeletedForMe(user?.id, msg.messageId)
  );
  const editRef = useRef();
  const bubbleRef = useRef();

  const isMine = Number(msg.senderId) === Number(user?.id);
  useEffect(() => {
    if (isMine) return;
    const isAlreadyRead = msg.isRead ?? msg.IsRead ?? false;
    if (isAlreadyRead) return;
    if (!msg.messageId && !msg.MessageId) return;
    const el = bubbleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          markRead(msg.messageId || msg.MessageId);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [msg.messageId, msg.MessageId, msg.isRead, msg.IsRead, isMine, markRead]);

  // ── Listen for MessageDeletedForMe SignalR event ─────────────────────────
  // When the hub fires this, we hide the bubble locally and persist to localStorage
  useEffect(() => {
    const chatHub = hubManager.get('chat');
    if (!chatHub) return;
    const handler = (deletedId) => {
      if (Number(deletedId) === Number(msg.messageId)) {
        addDeletedForMe(user?.id, msg.messageId);
        setHiddenForMe(true);
      }
    };
    chatHub.on('MessageDeletedForMe', handler);
    return () => chatHub.off('MessageDeletedForMe', handler);
  }, [msg.messageId, user?.id]);

  const handleReaction = async (emoji) => {
    try {
      const chatHub = hubManager.get('chat');
      if (!chatHub) return;
      const myReactions = msg.myReactions || [];
      const existingEmoji = myReactions[0];
      if (existingEmoji) {
        await chatHub.invoke('RemoveReactionFromMessage', Number(msg.messageId), existingEmoji);
      }
      if (existingEmoji !== emoji) {
        await chatHub.invoke('ReactToMessage', Number(msg.messageId), emoji);
      }
    } catch (_) { }
    setShowEmojiPicker(false);
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === msg.content) { setEditing(false); return; }
    try {
      const chatHub = hubManager.get('chat');
      if (chatHub) {
        await chatHub.invoke('EditMessage', Number(msg.messageId), editContent);
      } else {
        await messageApi.editMessage(msg.messageId, editContent);
      }
      if (onEdit) onEdit(msg.messageId, editContent);
    } catch (_) { }
    setEditing(false);
  };

  // ── Delete for Everyone ───────────────────────────────────────────────────
  // Invokes DeleteMessage on hub → backend broadcasts MessageDeleted to both users
  // Both UIs remove the bubble. Sidebar shows "This message was deleted".
  const handleDeleteForEveryone = async () => {
    setShowDeleteModal(false);
    try {
      const chatHub = hubManager.get('chat');
      if (chatHub) {
        await chatHub.invoke('DeleteMessage', Number(msg.messageId));
      } else {
        await messageApi.deleteMessage(msg.messageId);
      }
    } catch (_) { }
  };

  // ── Delete for Me ─────────────────────────────────────────────────────────
  // Invokes DeleteMessageForMe → backend fires MessageDeletedForMe only to Caller.
  // Other user's UI is untouched. This user's sidebar shows prev message.
  const handleDeleteForMe = async () => {
    setShowDeleteModal(false);
    try {
      const chatHub = hubManager.get('chat');
      if (chatHub) {
        await chatHub.invoke('DeleteMessageForMe', Number(msg.messageId));
      }
      // Persist immediately even if hub is slow
      addDeletedForMe(user?.id, msg.messageId);
      setHiddenForMe(true);
    } catch (_) { }
  };

  const handleFileOpen = async (e) => {
    e.preventDefault();
    if (fileLoading) return;
    setFileLoading(true);
    const isImage = msg.messageType?.toUpperCase() === 'IMAGE';
    // Open window SYNCHRONOUSLY (on user click) to bypass popup blockers
    const newTab = isImage ? window.open('', '_blank') : null;
    try {
      const token = localStorage.getItem('token');
      const url = getMediaUrl(msg.mediaUrl);
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (isImage && newTab) {
        // Load image into the already-opened tab
        newTab.location.href = blobUrl;
      } else {
        // Download other files (PDF, txt, etc.)
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = msg.content || 'file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      if (newTab) newTab.close();
      // Fallback: open directly
      window.open(getMediaUrl(msg.mediaUrl), '_blank', 'noreferrer');
    } finally {
      setFileLoading(false);
    }
  };

  // ── Hide conditions ───────────────────────────────────────────────────────
  // isDeleted = deleted for everyone (from ChatContext/SignalR)
  // hiddenForMe = deleted for me (localStorage)
  if (msg.isDeleted || hiddenForMe) return null;

  return (
    <>
      {/* ── Delete modal ──────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div style={modal.overlay} onClick={() => setShowDeleteModal(false)}>
          <div style={modal.box} onClick={e => e.stopPropagation()}>
            <div style={modal.title}>Delete message?</div>
            <div style={modal.subtitle}>Choose who this message is deleted for.</div>
            <div style={modal.actions}>
              {/* Delete for Me — only hides on MY side */}
              <button style={modal.meBtn} onClick={handleDeleteForMe}>
                🙈 Delete for me
                <span style={modal.hint}>Only you won't see this message</span>
              </button>
              {/* Delete for Everyone — removes for both users */}
              <button style={modal.everyoneBtn} onClick={handleDeleteForEveryone}>
                🗑 Delete for everyone
                <span style={modal.hint}>Removes the message for all participants</span>
              </button>
              <button style={modal.cancelBtn} onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={bubbleRef}
        style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, padding: '2px 0', marginBottom: 4 }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
        className="animate-msg"
      >
        {!isMine && (
          <Avatar user={{ displayName: msg.senderDisplayName || msg.senderName, avatarUrl: msg.senderAvatarUrl }} size={28} showStatus={false} />
        )}

        <div style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          {!isMine && msg.senderDisplayName && (
            <span style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 600, marginBottom: 2, paddingLeft: 2 }}>
              {msg.senderDisplayName}
            </span>
          )}

          {editing ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                ref={editRef}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
                autoFocus
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border-accent)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-0)', fontSize: 14, minWidth: 200 }}
              />
              <button onClick={handleEdit} style={{ color: 'var(--emerald)', fontSize: 12, padding: '4px 8px', background: 'var(--emerald-dim)', borderRadius: 6 }}>Save</button>
              <button onClick={() => setEditing(false)} style={{ color: 'var(--text-2)', fontSize: 12 }}>×</button>
            </div>
          ) : (
            <div style={{
              background: isMine ? 'var(--accent)' : 'var(--bg-3)',
              color: isMine ? 'white' : 'var(--text-0)',
              borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              padding: msg.messageType === 'IMAGE' ? '4px' : '10px 14px',
              fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
              boxShadow: isMine ? '0 2px 8px rgba(108,99,255,0.3)' : 'none',
            }}>
              {msg.messageType?.toUpperCase() === 'IMAGE' && msg.mediaUrl ? (
                <SecureImage
                  src={getMediaUrl(imageSrc)}
                  alt="media"
                  style={{ maxWidth: 240, maxHeight: 200, borderRadius: 12, display: 'block', cursor: 'pointer' }}
                  onClick={handleFileOpen}
                  onError={async () => {
                    try {
                      const fileId = extractFileId(msg.mediaUrl);
                      if (fileId) {
                        const res = await mediaApi.getSasUrl(fileId);
                        const sasUrl = res?.data?.sasUrl || res?.sasUrl;
                        if (sasUrl) setImageSrc(sasUrl);
                      }
                    } catch { }
                  }}
                />
              ) : msg.mediaUrl ? (
                <a
                  href={getMediaUrl(msg.mediaUrl)}
                  onClick={handleFileOpen}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: isMine ? 'rgba(255,255,255,0.95)' : 'var(--accent-light)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    textDecoration: 'underline', fontWeight: 500,
                    cursor: fileLoading ? 'wait' : 'pointer',
                    opacity: fileLoading ? 0.7 : 1,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{fileLoading ? '⏳' : '📎'}</span>
                  <span style={{ wordBreak: 'break-all' }}>{fileLoading ? 'Opening...' : (msg.content || 'Download File')}</span>
                </a>
              ) : (
                msg.content
              )}
            </div>
          )}

          {/* Reactions */}
          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(msg.reactions).map(([emoji, count]) => (
                <button key={emoji} onClick={() => handleReaction(emoji)} style={{ background: 'var(--bg-4)', border: '1px solid var(--border)', borderRadius: 12, padding: '2px 7px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Timestamp + tick */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexDirection: isMine ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{timeStr(msg.sentAt)}</span>
            {msg.isEdited && <span style={{ fontSize: 10, color: 'var(--text-3)', fontStyle: 'italic' }}>edited</span>}
            {isMine && (() => {
              const isRoom = !!msg.roomId || !!msg.RoomId;
              const readersCount = msg.readersCount ?? msg.ReadersCount ?? 0;
              // For DM: msg.isRead is enough.
              // For Room: blue tick only if readersCount >= membersCount - 1
              const isRead = msg.isRead ?? msg.IsRead ?? false;
              const isReadByAll = isRoom 
                ? (membersCount > 1 && readersCount >= membersCount - 1)
                : isRead;

              return (
                <span style={{ 
                  fontSize: 13, 
                  color: isReadByAll ? 'var(--sky, #38bdf8)' : 'var(--text-3)', 
                  fontWeight: 600, 
                  letterSpacing: '-2px', 
                  lineHeight: 1 
                }}>
                  {isReadByAll ? '✓✓' : '✓'}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Actions popover */}
        {showActions && !editing && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowEmojiPicker(p => !p)}
                style={{ fontSize: 14, opacity: 0.6, padding: '4px', color: 'var(--text-2)', background: 'var(--bg-3)', borderRadius: 6, transition: 'opacity 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
              >
                😊
              </button>
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 6, display: 'flex', gap: 4, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                  {EMOJI_QUICK.map(em => (
                    <button key={em} onClick={() => handleReaction(em)} style={{ fontSize: 18, padding: 4, borderRadius: 6, cursor: 'pointer', background: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-4)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isMine && (
              <>
                <button
                  onClick={() => { setEditing(true); setEditContent(msg.content); }}
                  style={{ fontSize: 11, opacity: 0.6, padding: '4px 6px', color: 'var(--text-2)', background: 'var(--bg-3)', borderRadius: 6 }}
                >✏️</button>
                {/* ── Opens the 2-option delete modal ── */}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  style={{ fontSize: 11, opacity: 0.6, padding: '4px 6px', color: 'var(--rose)', background: 'var(--bg-3)', borderRadius: 6 }}
                >🗑</button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Modal styles ──────────────────────────────────────────────────────────────
const modal = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  box: {
    background: 'var(--bg-1)', border: '1px solid var(--border)',
    borderRadius: 16, padding: 24, width: 320, maxWidth: '90vw',
    display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  title: {
    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
    color: 'var(--text-0)', marginBottom: 2,
  },
  subtitle: {
    fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 4,
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 8 },
  meBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
    color: 'var(--text-0)', fontSize: 14, fontWeight: 600, textAlign: 'left',
    transition: 'background 0.15s',
  },
  everyoneBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
    background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
    borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
    color: 'var(--rose)', fontSize: 14, fontWeight: 600, textAlign: 'left',
    transition: 'background 0.15s',
  },
  cancelBtn: {
    background: 'var(--bg-4)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
    color: 'var(--text-2)', fontSize: 13, fontWeight: 600,
  },
  hint: {
    fontSize: 11, fontWeight: 400,
    color: 'var(--text-3)', lineHeight: 1.3,
  },
};