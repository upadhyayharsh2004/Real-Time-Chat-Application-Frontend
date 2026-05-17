import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi, mediaApi, getMediaUrl } from '../services/api';
import { resolveAndCacheProfile } from '../context/ChatContext';
import SecureImage from '../components/SecureImage';

export default function ProfilePanel() {
  // ✅ CHANGE: added changePassword from AuthContext
  const { user, updateUser, logout, changePassword } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: user?.displayName || '', bio: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [hasAvatarError, setHasAvatarError] = useState(false);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true); setErr(''); setMsg('');
    try {
      await authApi.updateProfile(user.id, form);
      updateUser({ displayName: form.displayName });
      resolveAndCacheProfile(user.id, {
        displayName: form.displayName,
        avatarUrl: user.avatarUrl || null,
      });
      setMsg('Profile updated!');
      setEditing(false);
    } catch (e) { setErr(e.message); }
    setSavingProfile(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('uploadedBy', user.id);
      const res = await mediaApi.upload(fd);

      console.log('=== MEDIA UPLOAD RESPONSE ===', res);

      const url = res.blobUrl || res.sasUrl || res.url || res.data?.blobUrl || res.data?.url || res.data?.sasUrl;

      console.log('=== AVATAR URL ===', url);

      if (url) {
        await authApi.updateProfile(user.id, { avatarUrl: url });
        setHasAvatarError(false);
        updateUser({ avatarUrl: url });
        resolveAndCacheProfile(user.id, {
          displayName: user.displayName || user.username || '',
          avatarUrl: url,
        });
        setMsg('Avatar updated!');
      } else {
        console.error('=== NO URL FOUND IN RESPONSE ===', res);
        setErr('Upload failed: no URL returned from server');
      }
    } catch (e) {
      console.error('=== AVATAR UPLOAD ERROR ===', e);
      setErr(e.message);
    }
    setUploadingAvatar(false);
  };

  // ✅ CHANGE: now calls changePassword from AuthContext instead of authApi directly
  // AuthContext's changePassword handles logout + clearing token automatically
  const handleChangePw = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) { setErr('Passwords do not match'); return; }
    setSavingPw(true); setErr(''); setMsg('');
    const result = await changePassword(pwForm.currentPassword, pwForm.newPassword);
    if (!result.success) {
      setErr(result.error);
      setSavingPw(false);
    }
    // No need to do anything on success — AuthContext clears user and router redirects to /login
  };

  const deactivate = async () => {
    if (!window.confirm('Deactivate your account? You can reactivate by contacting support.')) return;
    try { await authApi.deactivateAccount(user.id); logout(); } catch (e) { setErr(e.message); }
  };

  const name = user?.displayName || user?.username || 'You';

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h2 style={S.title}>Profile</h2>
      </div>

      <div style={S.body}>
        {/* Avatar */}
        <div style={S.avatarSection}>
          <div style={S.avatarWrap}>
            {user?.avatarUrl && !hasAvatarError
              ? <SecureImage src={getMediaUrl(user.avatarUrl)} alt={name} style={S.avatarImg} onError={e => { console.error('=== IMG LOAD ERROR ===', user.avatarUrl); setHasAvatarError(true); }} />
              : <div style={S.avatarPlaceholder}>{name[0]?.toUpperCase()}</div>
            }
            <label style={S.avatarOverlay} title="Change avatar">
              {uploadingAvatar ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '📷'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            </label>
          </div>
          <div>
            <div style={S.profileName}>{name}</div>
            <div style={S.profileHandle}>@{user?.username || user?.userName || `user_${user?.id}`}</div>
            <div style={S.onlineBadge}>● Online</div>
          </div>
        </div>

        {msg && <div style={S.successBox}>{msg}</div>}
        {err && <div style={S.errorBox}>{err}</div>}

        {/* Profile form */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>Personal Info</span>
            <button onClick={() => setEditing(e => !e)} style={S.editBtn}>{editing ? 'Cancel' : 'Edit'}</button>
          </div>
          {editing ? (
            <form onSubmit={handleSaveProfile} style={S.form}>
              <label style={S.label}>Display Name</label>
              <input style={S.input} value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Your display name" />
              <label style={S.label}>Bio</label>
              <textarea style={{ ...S.input, resize: 'vertical', minHeight: 60 }} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Tell people about yourself…" />
              <button type="submit" disabled={savingProfile} style={S.saveBtn}>
                {savingProfile ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Save Changes'}
              </button>
            </form>
          ) : (
            <div style={S.infoGrid}>
              <InfoRow label="Display Name" value={user?.displayName || '—'} />
              <InfoRow label="Username" value={user?.username || user?.userName || '—'} />
              <InfoRow label="Email" value={user?.email || '—'} />
            </div>
          )}
        </div>

        {/* Password */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>Security</span>
            <button onClick={() => setShowPw(s => !s)} style={S.editBtn}>{showPw ? 'Cancel' : 'Change Password'}</button>
          </div>
          {showPw && (
            <form onSubmit={handleChangePw} style={S.form}>
              <label style={S.label}>Current Password</label>
              <input style={S.input} type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} required />
              <label style={S.label}>New Password</label>
              <input style={S.input} type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} required />
              <label style={S.label}>Confirm New Password</label>
              <input style={S.input} type="password" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} required />
              <button type="submit" disabled={savingPw} style={S.saveBtn}>
                {savingPw ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Danger zone */}
        <div style={{ ...S.card, borderColor: 'rgba(244,63,94,0.2)' }}>
          <div style={S.cardHeader}>
            <span style={{ ...S.cardTitle, color: 'var(--rose)' }}>Danger Zone</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12 }}>
            Deactivating your account will prevent you from logging in. Your message history will be preserved.
          </p>
          <button onClick={deactivate} style={S.dangerBtn}>Deactivate Account</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text-0)' }}>{value}</div>
    </div>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { padding: '20px 16px 12px', flexShrink: 0 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-0)' },
  body: { flex: 1, overflowY: 'auto', padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 12 },
  avatarSection: { display: 'flex', alignItems: 'center', gap: 14, padding: '16px', background: 'var(--bg-2)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  avatarWrap: { width: 64, height: 64, borderRadius: '50%', position: 'relative', flexShrink: 0 },
  avatarImg: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', display: 'block' },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', fontFamily: 'var(--font-display)' },
  avatarOverlay: { position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s' },
  profileName: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-0)' },
  profileHandle: { fontSize: 12, color: 'var(--text-3)', marginTop: 2 },
  onlineBadge: { fontSize: 12, color: 'var(--emerald)', marginTop: 4 },
  successBox: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px 12px', color: '#34d399', fontSize: 13 },
  errorBox: { background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 13 },
  card: { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-0)', fontFamily: 'var(--font-display)' },
  editBtn: { fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: { background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-0)' },
  saveBtn: { background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  infoGrid: { display: 'flex', flexDirection: 'column' },
  dangerBtn: { background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: 'var(--rose)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
};