import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ userName: '', displayName: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    const res = await register({ userName: form.userName, displayName: form.displayName, email: form.email, password: form.password, role: 'User' });
    setLoading(false);
    if (res.success) { setSuccess(true); setTimeout(() => navigate('/login'), 2000); }
    else setError(res.error || 'Registration failed');
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={S.page}>
      <div style={S.bg} />
      <div style={S.card} className="animate-fade">
        <div style={S.logo}>
          <div style={S.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="var(--accent)" opacity=".9"/>
              <circle cx="8" cy="10" r="1.2" fill="white"/>
              <circle cx="12" cy="10" r="1.2" fill="white"/>
              <circle cx="16" cy="10" r="1.2" fill="white"/>
            </svg>
          </div>
          <span style={S.logoText}>ConnectHub</span>
        </div>

        <h1 style={S.title}>Create account</h1>
        <p style={S.sub}>Join ConnectHub and start connecting</p>

        {error && <div style={S.error}>{error}</div>}
        {success && <div style={S.successBox}>Account created! Redirecting to login…</div>}

        <form onSubmit={handle} style={S.form}>
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>Username</label>
              <input style={S.input} placeholder="john_doe" value={form.userName} onChange={set('userName')} required />
            </div>
            <div style={S.col}>
              <label style={S.label}>Display Name</label>
              <input style={S.input} placeholder="John Doe" value={form.displayName} onChange={set('displayName')} required />
            </div>
          </div>
          <label style={S.label}>Email</label>
          <input style={S.input} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>Password</label>
              <input style={S.input} type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
            <div style={S.col}>
              <label style={S.label}>Confirm</label>
              <input style={S.input} type="password" placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />
            </div>
          </div>
          <button style={{ ...S.btn, ...(loading ? S.btnLoading : {}) }} type="submit" disabled={loading || success}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Create Account'}
          </button>
        </form>

        <p style={S.footer}>
          Already have an account? <Link to="/login" style={S.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', padding: '24px', position: 'relative' },
  bg: { position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(108,99,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' },
  card: { width: '100%', maxWidth: 460, position: 'relative', zIndex: 1, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '40px 36px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoIcon: { width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)', border: '1px solid var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, marginBottom: 6 },
  sub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 24 },
  error: { background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 16 },
  successBox: { background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#34d399', fontSize: 13, marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  col: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  input: { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '11px 14px', fontSize: 14, color: 'var(--text-0)' },
  btn: { marginTop: 8, background: 'var(--accent)', color: 'white', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, padding: '12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnLoading: { opacity: 0.7, cursor: 'not-allowed' },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-2)' },
  link: { color: 'var(--accent-light)', fontWeight: 600 },
};
