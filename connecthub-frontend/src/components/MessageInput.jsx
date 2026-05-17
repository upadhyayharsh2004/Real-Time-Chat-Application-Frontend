import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { mediaApi } from '../services/api';

export default function MessageInput({ type, targetId }) {
  const { user } = useAuth();
  const { sendDirectMessage, sendRoomMessage, sendTyping } = useChat();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const fileRef = useRef();
  const textRef = useRef();

  const stopTyping = useCallback(() => {
    if (isTypingRef.current && type === 'dm') {
      isTypingRef.current = false;
      sendTyping(targetId, false);
    }
  }, [type, targetId, sendTyping]);

  const handleChange = (e) => {
    setContent(e.target.value);
    if (type === 'dm' && targetId) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        sendTyping(targetId, true);
      }
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(stopTyping, 2500);
    }
  };

  useEffect(() => () => { clearTimeout(typingTimer.current); stopTyping(); }, [stopTyping]);

  const send = async () => {
    const text = content.trim();
    if (!text) return;

    // Clear input immediately for snappy feel
    setContent('');
    if (textRef.current) {
      textRef.current.style.height = 'auto';
    }

    stopTyping();
    try {
      if (type === 'dm') await sendDirectMessage(targetId, text);
      else await sendRoomMessage(targetId, text);
    } catch (e) {
      console.error('Send failed', e);
      // Optional: recover content if failed
    } finally {
      textRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (targetId) {
        if (type === 'dm') fd.append('receiverId', targetId);
        else fd.append('roomId', targetId);
      }
      fd.append('uploadedBy', user?.id);
      const res = await mediaApi.upload(fd);

      // Robust extraction of media URL handling camelCase, PascalCase, and different response structures
      const data = res.data || res.Data || res;
      const mediaUrl = res.sasUrl || res.SasUrl ||
        data.sasUrl || data.SasUrl ||
        data.blobUrl || data.BlobUrl ||
        data.url || data.Url ||
        res.url;

      if (!mediaUrl) {
        console.error('No media URL found in upload response', res);
        throw new Error('Upload succeeded but no URL was returned');
      }

      const msgType = file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('audio/') ? 'AUDIO' : 'FILE';
      if (type === 'dm') await sendDirectMessage(targetId, file.name, mediaUrl, msgType);
      else await sendRoomMessage(targetId, file.name, mediaUrl, msgType);
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.inner}>
        <button onClick={() => fileRef.current?.click()} style={S.iconBtn} title="Attach file">
          {uploading
            ? <span className="spinner" style={{ width: 16, height: 16 }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          }
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} accept="image/*,application/pdf,.doc,.docx,.txt,audio/*" />

        <textarea
          ref={textRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder="Message…"
          rows={1}
          style={S.input}
          onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
        />

        <button
          onClick={send}
          disabled={!content.trim() || sending}
          style={{ ...S.sendBtn, ...(content.trim() ? S.sendActive : {}) }}
        >
          {sending
            ? <span className="spinner" style={{ width: 16, height: 16, borderTopColor: 'white' }} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
          }
        </button>
      </div>
    </div>
  );
}

const S = {
  wrap: { padding: '12px 16px', borderTop: '1px solid var(--border)' },
  inner: {
    display: 'flex', alignItems: 'flex-end', gap: 8,
    background: 'var(--bg-3)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '8px 12px',
    transition: 'border-color var(--transition)',
  },
  iconBtn: { color: 'var(--text-2)', padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color var(--transition)' },
  input: {
    flex: 1, resize: 'none', fontSize: 14, lineHeight: 1.5,
    color: 'var(--text-0)', minHeight: 22, maxHeight: 120,
    overflow: 'auto', padding: '2px 0',
  },
  sendBtn: {
    width: 34, height: 34, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-4)', color: 'var(--text-3)',
    transition: 'background var(--transition), color var(--transition)',
    flexShrink: 0,
  },
  sendActive: { background: 'var(--accent)', color: 'white' },
};
