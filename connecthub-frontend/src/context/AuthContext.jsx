import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';
import { hubManager } from '../services/signalr';

const AuthContext = createContext(null);

function splitCamelCase(name) {
  if (!name || name.includes(' ')) return name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

function buildDisplayName(userData) {
  const candidates = [
    userData?.displayName || userData?.DisplayName || '',
    userData?.userName || userData?.UserName || '',
    userData?.username || '',
  ].map(s => splitCamelCase(s.trim())).filter(Boolean);

  const fullName = candidates.find(s => s.includes(' '));
  return fullName || candidates[0] || '';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const payload = res.data || res;
      const token = payload.accessToken || payload.token;
      const refreshToken = payload.refreshToken;
      const userData = payload.user || payload;

      if (token) {
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      }

      const userObj = {
        id: userData.userId || userData.id,
        username: userData.userName || userData.username,
        displayName: buildDisplayName(userData),
        email: userData.email,
        avatarUrl: userData.avatarUrl,
        role: userData.role || userData.Role || 'User',
      };

      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);
      hubManager.connectAll().catch(() => { });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const setTokens = useCallback(async (accessToken, refreshToken) => {
    localStorage.setItem('token', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    try {
      const base64Payload = accessToken.split('.')[1];
      const decoded = JSON.parse(atob(base64Payload));

      const userId =
        decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
        decoded['sub'] ||
        decoded['userId'] ||
        decoded['nameid'];

      const email =
        decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ||
        decoded['email'];

      const role =
        decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
        decoded['role'];

      const name =
        decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
        decoded['name'] ||
        decoded['unique_name'] ||
        email?.split('@')[0] ||
        'User';

      const userObj = {
        id: userId,
        username: name,
        displayName: splitCamelCase(name),
        email: email,
        avatarUrl: null,
        role: role || 'User',
      };

      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);
      hubManager.connectAll().catch(() => { });
    } catch (e) {
      console.error('Token decode failed:', e);
      const userObj = {
        id: null,
        username: 'User',
        displayName: 'User',
        email: '',
        avatarUrl: null,
        role: 'User',
      };
      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);
    }
  }, []);

  const register = useCallback(async (data) => {
    setLoading(true);
    try {
      const res = await authApi.register(data);
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) await authApi.logout({ refreshToken }).catch(() => { });
    } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    hubManager.disconnectAll();
  }, []);

  // ─── NEW: Change Password → auto logout ──────────────────────────────────────
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    setLoading(true);
    try {
      //Replace with this — CORRECT
      await authApi.changePassword(user.id, {
        CurrentPassword: oldPassword,
        NewPassword: newPassword,
      });

      // Password changed successfully — force logout
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) await authApi.logout({ refreshToken }).catch(() => { });
      } catch { }

      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
      hubManager.disconnectAll();

      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [user]);
  // ─────────────────────────────────────────────────────────────────────────────

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    if (user && localStorage.getItem('token')) {
      hubManager.connectAll().catch(() => { });
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, logout, updateUser, setTokens,
      changePassword,  // ← NEW
      isAdmin: user?.role === 'Admin' || user?.role === 'ADMIN' || user?.Role === 'Admin' || user?.Role === 'ADMIN',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);