import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URLS } from '../services/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = await login(form.email, form.password);
    setLoading(false);
    if (res.success) {
      // Small delay to ensure AuthContext state is updated
      setTimeout(() => {
        const user = JSON.parse(localStorage.getItem('user'));
        const isAdmin =
          user?.role?.toLowerCase() === 'admin' ||
          user?.Role?.toLowerCase() === 'admin';
        navigate(isAdmin ? '/admin' : '/');
      }, 50);
    }
    else setError(res.error || 'Login failed');
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.card} className="animate-fade">
        <div style={styles.logo}>
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="var(--accent)" opacity=".9" />
              <circle cx="8" cy="10" r="1.2" fill="white" />
              <circle cx="12" cy="10" r="1.2" fill="white" />
              <circle cx="16" cy="10" r="1.2" fill="white" />
            </svg>
          </div>
          <span style={styles.logoText}>ConnectHub</span>
        </div>

        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.sub}>Sign in to continue messaging</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handle} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            style={styles.input}
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            autoComplete="email"
            required
          />
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            autoComplete="current-password"
            required
          />
          <button style={{ ...styles.btn, ...(loading ? styles.btnLoading : {}) }} type="submit" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Sign In'}
          </button>
        </form>

        <div style={styles.divider}><span>or</span></div>

        <a
          href={`${API_URLS.AUTH}/api/users/oauth2/google`}
          style={styles.oauthBtn}
          onClick={(e) => {
            e.preventDefault();
            window.location.href = `${API_URLS.AUTH}/api/users/oauth2/google`;
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </a>

        <p style={styles.footer}>
          Don't have an account? <Link to="/register" style={styles.link}>Create one</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-0)', padding: '24px', position: 'relative',
  },
  bg: {
    position: 'fixed', inset: 0, zIndex: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(108,99,255,0.18) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
    background: 'var(--bg-2)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)', padding: '40px 36px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoIcon: {
    width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)',
    border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--text-0)' },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color: 'var(--text-0)', marginBottom: 6 },
  sub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 28 },
  error: {
    background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)',
    borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#f87171',
    fontSize: 13, marginBottom: 16,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  input: {
    background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '11px 14px', fontSize: 14, color: 'var(--text-0)', transition: 'border-color var(--transition)',
    marginBottom: 4,
  },
  btn: {
    marginTop: 8, background: 'var(--accent)', color: 'white', fontFamily: 'var(--font-display)',
    fontWeight: 600, fontSize: 15, padding: '12px', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', transition: 'opacity var(--transition), transform var(--transition)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnLoading: { opacity: 0.7, cursor: 'not-allowed' },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
    fontSize: 12, color: 'var(--text-3)',
    '::before': { content: '""', flex: 1, height: 1, background: 'var(--border)' },
  },
  oauthBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '11px', fontSize: 14, fontWeight: 500, color: 'var(--text-1)',
    cursor: 'pointer', transition: 'border-color var(--transition)', marginBottom: 8,
  },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-2)' },
  link: { color: 'var(--accent-light)', fontWeight: 600 },
};
