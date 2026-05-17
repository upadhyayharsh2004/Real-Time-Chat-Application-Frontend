import React, { useState } from 'react';
import { getMediaUrl } from '../services/api';
import SecureImage from './SecureImage';

const colors = ['#6c63ff','#10b981','#f59e0b','#38bdf8','#f43f5e','#a78bfa','#fb923c','#34d399'];

function colorFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

export default function Avatar({ user, size = 36, online, showStatus = true, style = {} }) {
  const [hasError, setHasError] = useState(false);
  const name = user?.displayName || user?.userName || user?.username || '?';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const bg = colorFor(name);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      {user?.avatarUrl && !hasError
        ? <SecureImage src={getMediaUrl(user.avatarUrl)} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} onError={() => setHasError(true)} />
        : (
          <div style={{
            width: size, height: size, borderRadius: '50%', background: bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.36, fontWeight: 700, color: 'white',
            fontFamily: 'var(--font-display)', flexShrink: 0,
            opacity: 0.9,
          }}>
            {initials}
          </div>
        )
      }
      {showStatus && online !== undefined && (
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28,
          borderRadius: '50%',
          background: online ? 'var(--emerald)' : 'var(--text-3)',
          border: '2px solid var(--bg-1)',
        }} />
      )}
    </div>
  );
}
