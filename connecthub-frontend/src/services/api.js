const GATEWAY_URL = 'https://connecthub-gateway-arvx.onrender.com';

export const API_URLS = {
  AUTH: GATEWAY_URL,
  MESSAGE: GATEWAY_URL,
  CHATROOM: GATEWAY_URL,
  PRESENCE: GATEWAY_URL,
  NOTIFICATION: GATEWAY_URL,
  MEDIA: GATEWAY_URL,
};

export const HUB_URLS = {
  CHAT: `${GATEWAY_URL}/hubs/chat`,
  ROOMS: `${GATEWAY_URL}/hubs/rooms`,
  PRESENCE: `${GATEWAY_URL}/hubs/presence`,
  NOTIFICATIONS: `${GATEWAY_URL}/hubs/notifications`,
};

const getToken = () => localStorage.getItem('token');

const authHeaders = (extra = {}) => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  ...extra,
});

// ─── 401 Unauthorized Handler ─────────────────────────────────────────────────
let _onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  _onUnauthorized = fn;
}

async function request(base, path, options = {}) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });

  if (res.status === 401) {
    if (_onUnauthorized) _onUnauthorized();
    throw new Error('Session expired. Please login again.');
  }

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── UC1: Auth ───────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => request(API_URLS.AUTH, '/api/users/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request(API_URLS.AUTH, '/api/users/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: (data) => request(API_URLS.AUTH, '/api/users/logout', { method: 'POST', body: JSON.stringify(data) }),
  getProfile: (id) => request(API_URLS.AUTH, `/api/users/${id}`),
  updateProfile: (id, data) => request(API_URLS.AUTH, `/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (id, data) => request(API_URLS.AUTH, `/api/users/${id}/change-password`, { method: 'POST', body: JSON.stringify(data) }),
  searchUsers: (q) => request(API_URLS.AUTH, `/api/users/search?q=${encodeURIComponent(q)}`),
  getActiveUsers: () => request(API_URLS.AUTH, '/api/users/active'),
  deactivateAccount: (id) => request(API_URLS.AUTH, `/api/users/${id}/deactivate`, { method: 'DELETE' }),
  reactivateAccount: (id) => request(API_URLS.AUTH, `/api/users/${id}/reactivate`, { method: 'PUT' }),
  getUsersByRole: (role) => request(API_URLS.AUTH, `/api/users/by-role?role=${role}`),
  changeUserRole: (id, role) => request(API_URLS.AUTH, `/api/users/${id}/change-role`, { method: 'PUT', body: JSON.stringify({ role }) }),
};

// ─── UC2: Messages ────────────────────────────────────────────────────────────
export const messageApi = {
  getDirectMessages: (userId, page = 1, size = 50) => request(API_URLS.MESSAGE, `/api/messages/direct/${userId}?page=${page}&pageSize=${size}`),
  getRoomMessages: (roomId, page = 1, size = 50) => request(API_URLS.MESSAGE, `/api/messages/room/${roomId}?page=${page}&pageSize=${size}`),
  getUnread: () => request(API_URLS.MESSAGE, '/api/messages/unread'),
  getUnreadCount: (userId) => request(API_URLS.MESSAGE, `/api/messages/unread-count/${userId}`),
  getUnreadCountFromSender: (userId, senderId) => request(API_URLS.MESSAGE, `/api/messages/unread-count/${userId}/from/${senderId}`),
  markAsRead: (id) => request(API_URLS.MESSAGE, `/api/messages/${id}/read`, { method: 'PUT' }),
  markAllAsRead: (senderId) => request(API_URLS.MESSAGE, `/api/messages/read-all/${senderId}`, { method: 'PUT' }),
  editMessage: (id, content) => request(API_URLS.MESSAGE, `/api/messages/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteMessage: (id) => request(API_URLS.MESSAGE, `/api/messages/${id}`, { method: 'DELETE' }),
  searchMessages: (q) => request(API_URLS.MESSAGE, `/api/messages/search?q=${encodeURIComponent(q)}`),
  getRecentChats: () => request(API_URLS.MESSAGE, '/api/messages/recent'),
  getById: (id) => request(API_URLS.MESSAGE, `/api/messages/${id}`),
  addReaction: (id, emoji) => request(API_URLS.MESSAGE, `/api/messages/${id}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  removeReaction: (id, emoji) => request(API_URLS.MESSAGE, `/api/messages/${id}/reactions/${emoji}`, { method: 'DELETE' }),
  getReactions: (id) => request(API_URLS.MESSAGE, `/api/messages/${id}/reactions`),
  pinMessage: (id, data) => request(API_URLS.MESSAGE, `/api/messages/${id}/pin`, { method: 'POST', body: JSON.stringify(data) }),
  unpinMessage: (pinId) => request(API_URLS.MESSAGE, `/api/messages/pins/${pinId}`, { method: 'DELETE' }),
  getPinnedMessages: (conversationId, type) => request(API_URLS.MESSAGE, `/api/messages/pins?conversationId=${conversationId}&type=${type}`),
};

// ─── UC3: ChatRooms ──────────────────────────────────────────────────────────
export const roomApi = {
  createRoom: (data) => request(API_URLS.CHATROOM, '/api/rooms', { method: 'POST', body: JSON.stringify(data) }),
  getRoom: (id) => request(API_URLS.CHATROOM, `/api/rooms/${id}`),
  updateRoom: (id, data) => request(API_URLS.CHATROOM, `/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoom: (id) => request(API_URLS.CHATROOM, `/api/rooms/${id}`, { method: 'DELETE' }),
  getPublicRooms: (page = 1, size = 20) => request(API_URLS.CHATROOM, `/api/rooms/public?page=${page}&pageSize=${size}`),
  searchRooms: (q) => request(API_URLS.CHATROOM, `/api/rooms/search?q=${encodeURIComponent(q)}`),
  getMyRooms: () => request(API_URLS.CHATROOM, '/api/rooms/my'),
  joinRoom: (id) => request(API_URLS.CHATROOM, `/api/rooms/${id}/join`, { method: 'POST' }),
  leaveRoom: (id) => request(API_URLS.CHATROOM, `/api/rooms/${id}/leave`, { method: 'POST' }),
  getMembers: (id) => request(API_URLS.CHATROOM, `/api/rooms/${id}/members`),
  changeMemberRole: (roomId, userId, role) => request(API_URLS.CHATROOM, `/api/rooms/${roomId}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  removeMember: (roomId, userId) => request(API_URLS.CHATROOM, `/api/rooms/${roomId}/members/${userId}`, { method: 'DELETE' }),
  inviteUser: (id, data) => request(API_URLS.CHATROOM, `/api/rooms/${id}/invite`, { method: 'POST', body: JSON.stringify(data) }),
  respondToInvite: (inviteId, data) => request(API_URLS.CHATROOM, `/api/rooms/invites/${inviteId}/respond`, { method: 'PUT', body: JSON.stringify(data) }),
  getPendingInvites: () => request(API_URLS.CHATROOM, '/api/rooms/invites/pending'),
};

export const adminRoomApi = {
  getAllRooms: (page = 1, size = 100) => request(API_URLS.CHATROOM, `/api/admin/rooms?page=${page}&pageSize=${size}`),
  deleteRoom: (id) => request(API_URLS.CHATROOM, `/api/admin/rooms/${id}`, { method: 'DELETE' }),
  reactivateRoom: (id) => request(API_URLS.CHATROOM, `/api/admin/rooms/${id}/reactivate`, { method: 'PUT' }),
  getMembers: (id) => request(API_URLS.CHATROOM, `/api/admin/rooms/${id}/members`),
};

// ─── UC4: Presence ───────────────────────────────────────────────────────────
export const presenceApi = {
  getOnlineUsers: () => request(API_URLS.PRESENCE, '/api/presence/online'),
  isUserOnline: (userId) => request(API_URLS.PRESENCE, `/api/presence/${userId}/is-online`),
  getConnectionCount: () => request(API_URLS.PRESENCE, '/api/presence/connections/count'),
  getOnlineUsersInfo: () => request(API_URLS.PRESENCE, '/api/presence/online/info'),
  getOnlineUserIds: () => request(API_URLS.PRESENCE, '/api/presence/online/ids'),
  getConnectionsByUser: (userId) => request(API_URLS.PRESENCE, `/api/presence/${userId}/connections`),
  getBulkPresence: (userIds) => request(API_URLS.PRESENCE, '/api/presence/bulk', { method: 'POST', body: JSON.stringify({ userIds }) }),
};

// ─── UC5: Notifications ──────────────────────────────────────────────────────
export const notificationApi = {
  getByRecipient: (userId, page = 1) => request(API_URLS.NOTIFICATION, `/api/notifications/${userId}?page=${page}`),
  getUnread: (userId) => request(API_URLS.NOTIFICATION, `/api/notifications/${userId}/unread`),
  getUnreadCount: (userId) => request(API_URLS.NOTIFICATION, `/api/notifications/${userId}/unread-count`),
  markAsRead: (id) => request(API_URLS.NOTIFICATION, `/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: (userId) => request(API_URLS.NOTIFICATION, `/api/notifications/${userId}/read-all`, { method: 'PUT' }),
  deleteNotification: (id) => request(API_URLS.NOTIFICATION, `/api/notifications/${id}`, { method: 'DELETE' }),
  sendBulk: (data) => request(API_URLS.NOTIFICATION, '/api/notifications/send-bulk', { method: 'POST', body: JSON.stringify(data) }),
  getAll: (page = 1) => request(API_URLS.NOTIFICATION, `/api/notifications/all?page=${page}`),
};

// ─── UC6: Media ──────────────────────────────────────────────────────────────
export const mediaApi = {
  upload: (formData) => {
    return fetch(`${API_URLS.MEDIA}/api/media/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    }).then(r => r.json());
  },
  getById: (fileId) => request(API_URLS.MEDIA, `/api/media/${fileId}`),
  getByUser: (userId) => request(API_URLS.MEDIA, `/api/media/by-user/${userId}`),
  getByRoom: (roomId) => request(API_URLS.MEDIA, `/api/media/by-room/${roomId}`),
  getByMessage: (messageId) => request(API_URLS.MEDIA, `/api/media/by-message/${messageId}`),
  getSasUrl: (fileId) => request(API_URLS.MEDIA, `/api/media/${fileId}/sas-url`),
  deleteFile: (fileId) => request(API_URLS.MEDIA, `/api/media/${fileId}`, { method: 'DELETE' }),
  getStats: () => request(API_URLS.MEDIA, '/api/media/stats'),
};

export const getMediaUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${GATEWAY_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};