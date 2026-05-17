// OAuthCallbackPage.jsx — Google OAuth redirect handler
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const { setTokens } = useAuth(); // AuthContext mein yeh function add karna hoga
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token   = params.get('token');
    const refresh = params.get('refresh');

    if (!token) {
      setError('OAuth login failed — no token received.');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    // AuthContext mein tokens save karo
    setTokens(token, refresh);

    // ✅ Land admin on dashboard, others on home
    setTimeout(() => {
      const user = JSON.parse(localStorage.getItem('user'));
      const isAdmin = user?.role === 'Admin' || user?.role === 'ADMIN' || user?.Role === 'Admin' || user?.Role === 'ADMIN';
      navigate(isAdmin ? '/admin' : '/', { replace: true });
    }, 100);
  }, []);

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.errorText}>{error}</p>
          <p style={styles.sub}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.text}>Signing you in...</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-0)',
  },
  card: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 16,
    background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)', padding: '48px 40px',
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  text:      { color: 'var(--text-1)', fontSize: 16, fontWeight: 500 },
  errorText: { color: '#f87171', fontSize: 15, fontWeight: 500 },
  sub:       { color: 'var(--text-3)', fontSize: 13 },
};