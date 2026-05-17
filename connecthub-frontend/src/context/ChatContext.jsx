import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { hubManager, HubState } from '../services/signalr';
import { messageApi, presenceApi, authApi, roomApi } from '../services/api';
import { useAuth } from './AuthContext';

const ChatContext = createContext(null);

const profileCache = {};

function splitCamelCase(name) {
  if (!name || name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

async function resolveUserProfile(userId) {
  if (!userId) return null;
  const key = String(userId);
  if (profileCache[key]) return profileCache[key];
  try {
    const res = await authApi.getProfile(userId);
    const p = res?.data || res?.user || res;
    const candidates = [
      p?.displayName || p?.DisplayName || '',
      p?.userName || p?.UserName || '',
    ].map(s => splitCamelCase(s.trim())).filter(Boolean);
    const fullName = candidates.find(s => s.includes(' '));
    const displayName = fullName || candidates[0] || `User ${userId}`;
    const profile = { id: userId, displayName, avatarUrl: p?.avatarUrl || p?.AvatarUrl || null };
    profileCache[key] = profile;
    return profile;
  } catch {
    const fallback = { id: userId, displayName: `User ${userId}`, avatarUrl: null };
    profileCache[key] = fallback;
    return fallback;
  }
}

export function resolveAndCacheProfile(userId, profile) {
  if (!userId || !profile) return;
  const key = String(userId);
  profileCache[key] = { id: userId, ...profile };
  window.dispatchEvent(new CustomEvent('avatar-updated', {
    detail: { userId: String(userId), avatarUrl: profile.avatarUrl, displayName: profile.displayName }
  }));
}

export function ChatProvider({ children }) {
  const { user, updateUser } = useAuth();
  const [messages, setMessages] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [recentChats, setRecentChats] = useState([]);
  const [roomLastMessages, setRoomLastMessages] = useState({});
  const [roomUnreadCounts, setRoomUnreadCounts] = useState({});
  const [activeRoomId, setActiveRoomId] = useState(null);
  const activeRoomIdRef = useRef(null);
  useEffect(() => { activeRoomIdRef.current = activeRoomId; }, [activeRoomId]);
  const [notificationCount, setNotificationCount] = useState(0);
  const typingTimers = useRef({});

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (user?.id) {
      profileCache[String(user.id)] = {
        id: user.id,
        displayName: user.displayName || user.username || `User ${user.id}`,
        avatarUrl: user.avatarUrl || null,
      };
    }
  }, [user]);

  useEffect(() => {
    const handleAvatarUpdated = (e) => {
      const { userId, avatarUrl, displayName } = e.detail;
      setMessages(prev => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          const updated = next[key].map(m => {
            const mSenderId = String(m.senderId ?? m.SenderId ?? '');
            if (mSenderId !== userId) return m;
            changed = true;
            return { ...m, senderAvatarUrl: avatarUrl ?? m.senderAvatarUrl, senderName: displayName ?? m.senderName, senderDisplayName: displayName ?? m.senderDisplayName };
          });
          if (changed) next[key] = updated;
        }
        return changed ? next : prev;
      });
      setRecentChats(prev =>
        prev.map(chat => {
          if (String(chat.userId) !== userId) return chat;
          return { ...chat, avatarUrl: avatarUrl ?? chat.avatarUrl, displayName: displayName ?? chat.displayName };
        })
      );
    };
    window.addEventListener('avatar-updated', handleAvatarUpdated);
    return () => window.removeEventListener('avatar-updated', handleAvatarUpdated);
  }, []);

  const convKey = (type, id) => `${type}_${id}`;

  const appendMessage = useCallback((key, msg) => {
    setMessages(prev => {
      const existing = prev[key] || [];
      const mId = msg.messageId || msg.MessageId;
      const pId = msg.pendingId;

      // 1. Duplicate check: if real ID already exists, don't add it again.
      // But if we also have a pendingId, ensure we clear the pending one.
      if (mId && existing.some(m => (m.messageId || m.MessageId) === mId)) {
        if (pId) {
            return { ...prev, [key]: existing.filter(m => m.pendingId !== pId) };
        }
        return prev;
      }

      // 2. Explicit replace: if we have a pendingId, find that exact message and swap it.
      if (pId) {
        const pendingIndex = existing.findIndex(m => m.pendingId === pId);
        if (pendingIndex !== -1) {
          const next = [...existing];
          next[pendingIndex] = { ...msg, isPending: false };
          return { ...prev, [key]: next };
        }
      }

      // 3. Fallback match: if this is a broadcast of MY OWN message (no pId), 
      // look for any pending message with same content and replace it.
      if (mId && !pId) {
        const currentUser = userRef.current;
        const sId = msg.senderId || msg.SenderId;
        if (Number(sId) === Number(currentUser?.id)) {
            const optIndex = existing.findIndex(m => m.isPending && m.content === (msg.content || msg.Content));
            if (optIndex !== -1) {
                const next = [...existing];
                next[optIndex] = { ...msg, isPending: false };
                return { ...prev, [key]: next };
            }
        }
      }

      return { ...prev, [key]: [...existing, msg] };
    });
  }, []);

  const updateMessage = useCallback((key, msgId, updates) => {
    setMessages(prev => ({
      ...prev,
      [key]: (prev[key] || []).map(m => m.messageId === msgId ? { ...m, ...updates } : m),
    }));
  }, []);

  const updateRoomLastMessage = useCallback((roomId, content, sentAt) => {
    setRoomLastMessages(prev => ({
      ...prev,
      [roomId]: { lastMessage: content, lastMessageAt: sentAt || new Date().toISOString() },
    }));
  }, []);

  const clearRoomUnread = useCallback((roomId) => {
    setRoomUnreadCounts(prev => ({ ...prev, [roomId]: 0 }));
  }, []);

  const loadRecentChats = useCallback(async () => {
    try {
      const res = await messageApi.getRecentChats();
      const rawChats = Array.isArray(res) ? res : (res?.data ?? res?.messages ?? res?.chats ?? []);
      const chats = Array.isArray(rawChats) ? rawChats : [];
      const enriched = await Promise.all(
        chats.map(async (chat) => {
          const partnerId = chat.userId;
          const hasRealName = chat.displayName && !chat.displayName.startsWith('User ') && chat.displayName !== `user_${partnerId}`;
          if (hasRealName) return chat;
          const profile = await resolveUserProfile(partnerId);
          return { ...chat, displayName: profile?.displayName || chat.displayName, userName: profile?.displayName || chat.userName, avatarUrl: profile?.avatarUrl || chat.avatarUrl || null };
        })
      );
      setRecentChats(enriched);
    } catch {
      setRecentChats([]);
    }
  }, []);

  const updateRecentChatInstant = useCallback((otherId, content, sentAt, partnerName, partnerAvatar, isMine) => {
    setRecentChats(prev => {
      const existing = prev.find(c => c.userId === otherId);
      
      // Check if this DM is currently open in the active URL
      const activeDmMatch = window.location.pathname.match(/\/dm\/(\d+)/);
      const isActiveDm = activeDmMatch && Number(activeDmMatch[1]) === Number(otherId);

      const updatedChat = {
        userId: otherId,
        userName: existing?.userName || partnerName || `user_${otherId}`,
        displayName: existing?.displayName || partnerName || `User ${otherId}`,
        avatarUrl: existing?.avatarUrl ?? partnerAvatar ?? null,
        lastMessage: content,
        lastMessageAt: sentAt || new Date().toISOString(),
        unreadCount: (isMine || isActiveDm) ? 0 : (((existing?.unreadCount ?? existing?.UnreadCount ?? 0)) + 1),
        isOnline: existing?.isOnline || false,
      };
      const filtered = prev.filter(c => c.userId !== otherId);
      return [updatedChat, ...filtered];
    });
  }, []);

  const loadOnlineUsers = useCallback(async () => {
    try {
      const res = await presenceApi.getOnlineUserIds();
      const ids = Array.isArray(res) ? res : (res?.data ?? res?.userIds ?? res?.ids ?? []);
      setOnlineUsers(new Set(Array.isArray(ids) ? ids.map(String) : []));
    } catch { }
  }, []);

  const loadMessages = useCallback(async (type, id) => {
    const key = convKey(type, id);
    const currentUser = userRef.current;
    try {
      let res;
      if (type === 'dm') {
        res = await messageApi.getDirectMessages(id);
        // Clear unread count locally when DM is opened
        setRecentChats(prev => prev.map(c => c.userId === id ? { ...c, unreadCount: 0 } : c));
      } else {
        res = await messageApi.getRoomMessages(id);
      }

      const list = Array.isArray(res) ? res : (res?.data?.messages ?? res?.messages ?? res?.data ?? res?.items ?? []);
      const safeList = Array.isArray(list)
        ? list.filter(m => !m.isDeleted && !m.deletedAt && !m.IsDeleted && !m.DeletedAt)
        : [];

      const unresolvedIds = [...new Set(
        safeList.map(m => m.senderId ?? m.SenderId).filter(sid => {
          if (!sid) return false;
          const cached = profileCache[String(sid)];
          return !cached || cached.displayName.startsWith('User ');
        })
      )];
      await Promise.all(unresolvedIds.map(resolveUserProfile));

      const enriched = safeList.map(m => {
        const sid = m.senderId ?? m.SenderId;
        const profile = sid ? profileCache[String(sid)] : null;
        const reactions = Array.isArray(m.reactions)
          ? m.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
          : (m.reactions || {});
        const myReactions = Array.isArray(m.reactions)
          ? m.reactions.filter(r => Number(r.userId) === Number(currentUser?.id)).map(r => r.emoji)
          : [];
        return {
          ...m, reactions, myReactions,
          senderName: m.senderName || m.SenderName || profile?.displayName || '',
          senderDisplayName: m.senderDisplayName || m.senderName || m.SenderName || profile?.displayName || '',
          senderAvatarUrl: m.senderAvatarUrl || m.SenderAvatarUrl || profile?.avatarUrl || null,
        };
      });

      setMessages(prev => ({ ...prev, [key]: enriched }));

      if (type === 'room' && enriched.length > 0) {
        const last = enriched[enriched.length - 1];
        setRoomLastMessages(prev => {
          const existing = prev[id];
          if (existing && new Date(existing.lastMessageAt) >= new Date(last.sentAt)) return prev;
          return { ...prev, [id]: { lastMessage: last.isDeleted ? 'This message was deleted' : (last.content || '📎 Attachment'), lastMessageAt: last.sentAt } };
        });
      }

      return enriched;
    } catch {
      return [];
    }
  }, []);

  const registerChatHandlers = useCallback((chatHub) => {
    console.log('[ChatContext] Registering SignalR handlers on hub:', chatHub.connectionId);

    const handleDM = (msg) => {
      const currentUser = userRef.current;
      const sId = Number(msg.senderId ?? msg.SenderId);
      const rId = Number(msg.receiverId ?? msg.ReceiverId);
      const mId = msg.messageId ?? msg.MessageId;
      const currentId = Number(currentUser?.id);
      if (!sId || !rId) return;
      const otherId = sId === currentId ? rId : sId;
      const isMine = sId === currentId;
      const cachedSender = profileCache[String(sId)];
      const resolvedName = msg.senderName ?? msg.SenderName ?? msg.senderDisplayName ?? msg.displayName ?? cachedSender?.displayName ?? '';
      const resolvedAvatar = msg.senderAvatarUrl ?? msg.SenderAvatarUrl ?? cachedSender?.avatarUrl ?? null;
      const normalized = {
        ...msg, messageId: mId, senderId: sId, receiverId: rId,
        content: msg.content ?? msg.Content, sentAt: msg.sentAt ?? msg.SentAt,
        senderName: resolvedName, senderDisplayName: resolvedName, senderAvatarUrl: resolvedAvatar,
        reactions: Array.isArray(msg.reactions ?? msg.Reactions)
          ? (msg.reactions ?? msg.Reactions).reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
          : (msg.reactions ?? msg.Reactions ?? {}),
        myReactions: [],
      };
      appendMessage(convKey('dm', otherId), normalized);
      const cachedPartner = profileCache[String(otherId)];
      updateRecentChatInstant(otherId, normalized.content, normalized.sentAt, cachedPartner?.displayName || '', cachedPartner?.avatarUrl ?? null, isMine);
    };

    const handleRoom = (msg) => {
      const sId = msg.senderId ?? msg.SenderId;
      const roomId = msg.roomId ?? msg.RoomId;
      const cachedSender = sId ? profileCache[String(sId)] : null;
      const content = msg.content ?? msg.Content ?? '';
      const sentAt = msg.sentAt ?? msg.SentAt ?? new Date().toISOString();
      const normalized = {
        ...msg,
        senderName: msg.senderName || msg.SenderName || cachedSender?.displayName || '',
        senderDisplayName: msg.senderName || msg.SenderName || cachedSender?.displayName || '',
        senderAvatarUrl: msg.senderAvatarUrl || msg.SenderAvatarUrl || cachedSender?.avatarUrl || null,
        reactions: Array.isArray(msg.reactions)
          ? msg.reactions.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {})
          : (msg.reactions || {}),
      };
      appendMessage(convKey('room', roomId), normalized);
      if (roomId) {
        const displayContent = content || '📎 Attachment';
        setRoomLastMessages(prev => ({ ...prev, [roomId]: { lastMessage: displayContent, lastMessageAt: sentAt } }));

        // Increment unread count if not active room and not my own message
        const currentUser = userRef.current;
        const currentActiveRoomId = activeRoomIdRef.current;
        if (Number(roomId) !== Number(currentActiveRoomId) && Number(sId) !== Number(currentUser?.id)) {
          setRoomUnreadCounts(prev => ({ ...prev, [roomId]: (prev[roomId] || 0) + 1 }));
        }

        window.dispatchEvent(new CustomEvent('room:lastmessage', { detail: { roomId, lastMessage: displayContent, lastMessageAt: sentAt } }));
      }
    };

    const handleEdit = (msg) => {
      if (msg.roomId) {
        const key = convKey('room', msg.roomId);
        updateMessage(key, msg.messageId, {
          content: msg.content, isEdited: true, editedAt: msg.editedAt
        });
        setMessages(prev => {
          const roomMsgs = prev[key] || [];
          const lastMsg = roomMsgs.length > 0
            ? [...roomMsgs].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0]
            : null;
          if (lastMsg?.messageId === msg.messageId) {
            setRoomLastMessages(prevRooms => {
              const current = prevRooms[msg.roomId];
              if (!current) return prevRooms;
              return { ...prevRooms, [msg.roomId]: { ...current, lastMessage: msg.content } };
            });
            window.dispatchEvent(new CustomEvent('room:lastmessage', {
              detail: { roomId: msg.roomId, lastMessage: msg.content, lastMessageAt: msg.editedAt || new Date().toISOString() },
            }));
          }
          return prev;
        });
        return;
      }
      setMessages(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (!k.startsWith('dm_')) continue;
          if (!next[k].some(m => m.messageId === msg.messageId)) continue;
          next[k] = next[k].map(m =>
            m.messageId === msg.messageId
              ? { ...m, content: msg.content, isEdited: true, editedAt: msg.editedAt }
              : m
          );
          const otherId = Number(k.replace('dm_', ''));
          const lastMsg = next[k][next[k].length - 1];
          if (lastMsg?.messageId === msg.messageId) {
            setRecentChats(prev => prev.map(c =>
              c.userId === otherId ? { ...c, lastMessage: msg.content } : c
            ));
          }
          break;
        }
        return next;
      });
    };

    const handleDelete = (messageId) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          next[k] = next[k].map(m =>
            m.messageId === messageId
              ? { ...m, isDeleted: true, content: 'This message was deleted' }
              : m
          );
        }
        setRecentChats(prevChats => prevChats.map(chat => {
          const key = convKey('dm', chat.userId);
          const msgs = next[key];
          if (!msgs || msgs.length === 0) return { ...chat, lastMessage: '' };
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.messageId === messageId) {
            return { ...chat, lastMessage: 'This message was deleted', lastMessageAt: lastMsg.sentAt };
          }
          return chat;
        }));
        setRoomLastMessages(prevRooms => {
          const updated = { ...prevRooms };
          for (const k of Object.keys(next)) {
            if (!k.startsWith('room_')) continue;
            const roomId = k.replace('room_', '');
            const msgs = next[k];
            if (!msgs || msgs.length === 0) { updated[roomId] = { lastMessage: '', lastMessageAt: null }; continue; }
            const lastMsg = msgs[msgs.length - 1];
            const lastMessage = lastMsg.isDeleted ? 'This message was deleted' : (lastMsg.content || '📎 Attachment');
            updated[roomId] = { lastMessage, lastMessageAt: lastMsg.sentAt };
            window.dispatchEvent(new CustomEvent('room:lastmessage', { detail: { roomId, lastMessage, lastMessageAt: lastMsg.sentAt } }));
          }
          return updated;
        });
        return next;
      });
    };

    const handleDeleteForMe = (messageId) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          next[k] = next[k].filter(m => m.messageId !== messageId);
        }
        setRecentChats(prevChats => prevChats.map(chat => {
          const key = convKey('dm', chat.userId);
          const msgs = next[key];
          if (!msgs || msgs.length === 0) return { ...chat, lastMessage: '' };
          const lastMsg = msgs[msgs.length - 1];
          return {
            ...chat,
            lastMessage: lastMsg.isDeleted ? 'This message was deleted' : (lastMsg.content || '📎 Attachment'),
            lastMessageAt: lastMsg.sentAt,
          };
        }));
        setRoomLastMessages(prevRooms => {
          const updated = { ...prevRooms };
          for (const k of Object.keys(next)) {
            if (!k.startsWith('room_')) continue;
            const roomId = k.replace('room_', '');
            const msgs = next[k];
            const lastMsg = msgs?.[msgs.length - 1];
            const lastMessage = lastMsg
              ? (lastMsg.isDeleted ? 'This message was deleted' : (lastMsg.content || '📎 Attachment'))
              : '';
            const lastMessageAt = lastMsg?.sentAt || null;
            updated[roomId] = { lastMessage, lastMessageAt };
            window.dispatchEvent(new CustomEvent('room:lastmessage', { detail: { roomId, lastMessage, lastMessageAt } }));
          }
          return updated;
        });
        return next;
      });
    };

    chatHub.off('UserProfileUpdated');
    chatHub.on('UserProfileUpdated', ({ userId, displayName, avatarUrl }) => {
      const uid = String(userId);
      profileCache[uid] = { ...(profileCache[uid] || {}), id: userId, displayName: displayName || profileCache[uid]?.displayName || '', avatarUrl: avatarUrl ?? profileCache[uid]?.avatarUrl ?? null };
      const currentUser = userRef.current;
      if (String(currentUser?.id) === uid) updateUser({ avatarUrl, displayName });
      setMessages(prev => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          const updated = next[key].map(m => {
            if (String(m.senderId ?? m.SenderId ?? '') !== uid) return m;
            changed = true;
            return { ...m, senderAvatarUrl: avatarUrl ?? m.senderAvatarUrl, senderName: displayName || m.senderName, senderDisplayName: displayName || m.senderDisplayName };
          });
          if (changed) next[key] = updated;
        }
        return changed ? next : prev;
      });
      setRecentChats(prev => prev.map(chat => {
        if (String(chat.userId) !== uid) return chat;
        return { ...chat, avatarUrl: avatarUrl ?? chat.avatarUrl, displayName: displayName || chat.displayName };
      }));
    });

    ['ReceiveMessage', 'MessageSent'].forEach(e => { chatHub.off(e); chatHub.on(e, handleDM); });
    ['ReceiveRoomMessage'].forEach(e => { chatHub.off(e); chatHub.on(e, handleRoom); });
    ['MessageEdited'].forEach(e => { chatHub.off(e); chatHub.on(e, handleEdit); });
    ['MessageDeleted'].forEach(e => { chatHub.off(e); chatHub.on(e, handleDelete); });
    chatHub.off('MessageDeletedForMe');
    chatHub.on('MessageDeletedForMe', handleDeleteForMe);

    chatHub.off('TypingIndicator');
    chatHub.on('TypingIndicator', ({ senderId, isTyping, roomId }) => {
      const key = roomId ? convKey('room', roomId) : convKey('dm', senderId);
      setTypingUsers(prev => {
        const set = new Set(prev[key] || []);
        isTyping ? set.add(senderId) : set.delete(senderId);
        return { ...prev, [key]: set };
      });
      if (isTyping) {
        const timerKey = `${key}_${senderId}`;
        clearTimeout(typingTimers.current[timerKey]);
        typingTimers.current[timerKey] = setTimeout(() => {
          setTypingUsers(prev => {
            const set = new Set(prev[key] || []);
            set.delete(senderId);
            return { ...prev, [key]: set };
          });
        }, 3000);
      }
    });

    chatHub.off('MessageRead');
    chatHub.on('MessageRead', ({ messageId, readAt, readersCount, isRead }) => {
      setMessages(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          next[k] = next[k].map(m => 
            (Number(m.messageId || m.MessageId) === Number(messageId)) 
              ? { ...m, isRead, IsRead: isRead, readAt, ReadAt: readAt, readersCount, ReadersCount: readersCount } 
              : m
          );
        }
        return next;
      });
    });

    chatHub.off('ReactionAdded');
    chatHub.on('ReactionAdded', ({ messageId, userId, emoji }) => {
      setMessages(prev => {
        const next = { ...prev };
        const currentUser = userRef.current;
        for (const k of Object.keys(next)) {
          next[k] = next[k].map(m => {
            if (m.messageId !== messageId) return m;
            const reactions = { ...(m.reactions || {}), [emoji]: (m.reactions?.[emoji] || 0) + 1 };
            const myReactions = Number(userId) === Number(currentUser?.id) ? [emoji] : (m.myReactions || []);
            return { ...m, reactions, myReactions };
          });
        }
        return next;
      });
    });

    chatHub.off('ReactionRemoved');
    chatHub.on('ReactionRemoved', ({ messageId, userId, emoji }) => {
      setMessages(prev => {
        const next = { ...prev };
        const currentUser = userRef.current;
        for (const k of Object.keys(next)) {
          next[k] = next[k].map(m => {
            if (m.messageId !== messageId) return m;
            const prev_count = m.reactions?.[emoji] || 0;
            const reactions = { ...m.reactions };
            if (prev_count <= 1) delete reactions[emoji];
            else reactions[emoji] = prev_count - 1;
            const myReactions = Number(userId) === Number(currentUser?.id) ? [] : (m.myReactions || []);
            return { ...m, reactions, myReactions };
          });
        }
        return next;
      });
    });

    chatHub.off('UserConnected');
    chatHub.on('UserConnected', (userId) => { setOnlineUsers(prev => new Set([...prev, String(userId)])); });
    chatHub.off('UserDisconnected');
    chatHub.on('UserDisconnected', (userId) => { setOnlineUsers(prev => { const s = new Set(prev); s.delete(String(userId)); return s; }); });

    // ── lowercase fallback (some backends send lowercase event name) ──
    chatHub.off('notificationcount');
    chatHub.on('notificationcount', (count) => setNotificationCount(count));

    // ── Room Membership Updates ─────────────────────────────────────────
    // NOTE: ChatHub now uses OthersInGroup for these, so they only fire for OTHER users.
    chatHub.off('UserJoinedRoom');
    chatHub.on('UserJoinedRoom', ({ roomId, userId, userName }) => {
      console.log(`[ChatContext] Member joined: ${userName} to room ${roomId}`);
      window.dispatchEvent(new CustomEvent('room:member-update', { 
        detail: { roomId, type: 'join', userId, userName } 
      }));
    });

    chatHub.off('UserLeftRoom');
    chatHub.on('UserLeftRoom', ({ roomId, userId, userName }) => {
      console.log(`[ChatContext] Member left: ${userName} from room ${roomId}`);
      window.dispatchEvent(new CustomEvent('room:member-update', { 
        detail: { roomId, type: 'leave', userId, userName } 
      }));
    });
  }, [appendMessage, updateMessage, loadRecentChats, updateRecentChatInstant, updateUser, updateRoomLastMessage]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const waitForHubAndRegister = async () => {
      // ── Chat hub ──────────────────────────────────────────────────────
      let chatHub = null;
      for (let i = 0; i < 20; i++) {
        const h = hubManager.get('chat');
        if (h && h.state === HubState.Connected) { chatHub = h; break; }
        await new Promise(r => setTimeout(r, 300));
        if (cancelled) return;
      }
      if (chatHub && !cancelled) {
        registerChatHandlers(chatHub);
        hubManager.onReconnected('chat', (reconnectedHub) => { registerChatHandlers(reconnectedHub); });

        // Join all my rooms for real-time sidebar updates
        try {
          const res = await roomApi.getMyRooms();
          const list = Array.isArray(res) ? res : (res?.data ?? res?.rooms ?? res?.items ?? []);
          if (Array.isArray(list)) {
            list.forEach(r => {
              const rid = r.roomId || r.id;
              if (rid) chatHub.invoke('JoinRoom', rid).catch(() => { });
            });
          }
        } catch (err) {
          console.error('[ChatContext] Failed to auto-join rooms:', err);
        }
      }

      
      let notifHub = null;
      for (let i = 0; i < 20; i++) {
        const h = hubManager.get('notifications');
        if (h && h.state === HubState.Connected) { notifHub = h; break; }
        await new Promise(r => setTimeout(r, 300));
        if (cancelled) return;
      }
      if (notifHub && !cancelled) {
        notifHub.off('NotificationCount');
        notifHub.on('NotificationCount', (count) => {
          setNotificationCount(typeof count === 'object' ? (count?.unreadCount ?? 0) : count);
        });
        // ← ReceiveNotification is intentionally NOT handled here.
        //   NotificationsPanel listens to it and reloads the full list from API.
      }
    };
    waitForHubAndRegister();
    loadRecentChats();
    loadOnlineUsers();

    const handleRoomJoined = (e) => {
      const rid = Number(e.detail?.roomId);
      console.log(`[ChatContext] handleRoomJoined called for room ${rid}`);
      const chatHub = hubManager.get('chat');
      if (rid && chatHub && chatHub.state === HubState.Connected) {
        console.log(`[ChatContext] Invoking ChatHub.JoinRoom for ${rid}`);
        chatHub.invoke('JoinRoom', rid).catch((err) => { 
          console.error(`[ChatContext] JoinRoom failed for ${rid}:`, err); 
        });
      } else {
        console.warn(`[ChatContext] Could not JoinRoom: rid=${rid}, chatHubState=${chatHub?.state}`);
      }
    };
    window.addEventListener('room:joined', handleRoomJoined);

    return () => {
      cancelled = true;
      window.removeEventListener('room:joined', handleRoomJoined);
    };
  }, [user, registerChatHandlers]);

  const sendDirectMessage = useCallback(async (receiverId, content, mediaUrl = null, messageType = 'TEXT') => {
    const chatHub = hubManager.get('chat');
    if (!chatHub) return;
    const currentUser = userRef.current;
    const pendingId = `pending-${Date.now()}-${Math.random()}`;
    const optimisticMsg = {
      pendingId,
      senderId: currentUser?.id,
      senderName: currentUser?.displayName || currentUser?.userName || 'You',
      content, messageType, mediaUrl,
      sentAt: new Date().toISOString(),
      isPending: true
    };
    appendMessage(convKey('dm', receiverId), optimisticMsg);
    try {
      const saved = await chatHub.invoke('SendDirectMessage', Number(receiverId), content, messageType, mediaUrl);
      if (saved) {
        appendMessage(convKey('dm', receiverId), { ...saved, pendingId });
        const cachedPartner = profileCache[String(receiverId)];
        updateRecentChatInstant(Number(receiverId), content, new Date().toISOString(), cachedPartner?.displayName || '', cachedPartner?.avatarUrl ?? null, true);
      }
    } catch (err) {
      console.error('[ChatContext] DM failed:', err);
    }
  }, [appendMessage, updateRecentChatInstant]);

  const sendRoomMessage = useCallback(async (roomId, content, mediaUrl = null, messageType = 'TEXT') => {
    const chatHub = hubManager.get('chat');
    if (!chatHub) return;
    const currentUser = userRef.current;
    const pendingId = `pending-${Date.now()}-${Math.random()}`;
    const optimisticMsg = {
      pendingId,
      senderId: currentUser?.id,
      senderName: currentUser?.displayName || currentUser?.userName || 'You',
      content, messageType, mediaUrl,
      sentAt: new Date().toISOString(),
      isPending: true
    };
    appendMessage(convKey('room', roomId), optimisticMsg);
    try {
      const saved = await chatHub.invoke('SendRoomMessage', Number(roomId), content, messageType, mediaUrl);
      if (saved) appendMessage(convKey('room', roomId), { ...saved, pendingId });
    } catch (err) {
      console.error('[ChatContext] Room message failed:', err);
    }
  }, [appendMessage]);

  const sendTyping = useCallback(async (recipientId, isTyping) => {
    const chatHub = hubManager.get('chat');
    if (!chatHub) return;
    await chatHub.invoke('TypingIndicator', Number(recipientId), isTyping).catch(() => { });
  }, []);

  const markRead = useCallback(async (messageId) => {
    const chatHub = hubManager.get('chat');
    if (!chatHub) return;
    await chatHub.invoke('MarkMessageRead', Number(messageId)).catch(() => { });
  }, []);

  const isOnline = useCallback((userId) =>
    onlineUsers.has(String(userId)) || onlineUsers.has(userId), [onlineUsers]);

  return (
    <ChatContext.Provider value={{
      messages, onlineUsers, typingUsers, recentChats,
      notificationCount, setNotificationCount,
      convKey, loadMessages, sendDirectMessage, sendRoomMessage,
      sendTyping, markRead, isOnline, loadRecentChats,
      appendMessage, updateMessage,
      roomLastMessages, roomUnreadCounts, clearRoomUnread,
      activeRoomId, setActiveRoomId,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);