import React, { useState, useEffect } from 'react';

export default function SecureImage({ src, alt, style, className, onError, fallback }) {
  const [objectUrl, setObjectUrl] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    if (!src) {
      setObjectUrl('');
      return;
    }

    // If it's already a local blob/data URL, use it directly
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      setObjectUrl(src);
      return;
    }

    // If it is a protected backend media file route, fetch it securely with headers
    const isProtected = src.includes('/api/media/files/') || src.includes('/api/media/');

    if (!isProtected) {
      setObjectUrl(src);
      return;
    }

    let active = true;
    const token = localStorage.getItem('token');

    fetch(src, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        if (active) {
          const localUrl = URL.createObjectURL(blob);
          setObjectUrl(localUrl);
        }
      })
      .catch(err => {
        console.error('=== SECURE IMAGE FETCH ERROR ===', err, src);
        if (active) {
          setHasError(true);
          if (onError) onError(err);
        }
      });

    return () => {
      active = false;
      if (objectUrl && objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  if (hasError && fallback) {
    return fallback;
  }

  if (!src) return fallback || null;

  return (
    <img
      src={objectUrl || 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" />'}
      alt={alt}
      style={style}
      className={className}
      onError={(e) => {
        setHasError(true);
        if (onError) onError(e);
      }}
    />
  );
}
