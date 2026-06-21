import React, { useState, useRef, useCallback, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { getSocket, startTyping, stopTyping } from '../../services/socket';
import { encryptFor, isE2EAvailable } from '../../services/e2eManager';
import useChatStore, { genTempId } from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import styles from './MessageInput.module.css';

let typingTimer = null;

export default function MessageInput({ conversationId }) {
  const [text, setText]           = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isTyping, setIsTyping]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [e2eOn, setE2eOn]         = useState(false); // E2E available for this chat
  const inputRef = useRef(null);

  const { addOptimistic, failOptimistic, conversations } = useChatStore();
  const { user, e2eEnabled } = useAuthStore();

  // ─── Resolve the OTHER user in this conversation ──────────────────────────
  const conversation = conversations.find((c) => c._id === conversationId);
  const isGroup      = conversation?.type === 'group';
  const myId         = user?._id?.toString() || user?.id?.toString();

  const otherMember  = !isGroup && conversation?.members?.find((m) => {
    const mid = m.userId?._id?.toString() || m.userId?.toString();
    return mid !== myId;
  });
  const otherUserId  = otherMember?.userId?._id?.toString() || otherMember?.userId?.toString();

  // ─── Check E2E availability when conversation changes ────────────────────
  useEffect(() => {
    setText('');
    inputRef.current?.focus();

    if (!isGroup && myId && otherUserId && e2eEnabled) {
      isE2EAvailable(myId, otherUserId).then(setE2eOn);
    } else {
      setE2eOn(false);
    }
  }, [conversationId, myId, otherUserId, isGroup, e2eEnabled]);

  // ─── Send ─────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed && !previewFile) return;
    if (previewFile) { handleFileSend(); return; }

    const tempId = genTempId();
    const now    = new Date().toISOString();

    // 1. Show optimistic bubble immediately (always with plaintext)
    addOptimistic({
      _tempId:        tempId,
      _optimistic:    true,
      conversationId,
      senderId:       { _id: myId, name: user?.name, avatar: user?.avatar },
      content:        trimmed,   // display plaintext always in our own UI
      type:           'text',
      status:         'sent',
      createdAt:      now,
      updatedAt:      now,
      reactions:      [],
      isEncrypted:    e2eOn,
    });

    // 2. Clear input immediately
    setText('');
    handleStopTyping();
    setShowEmoji(false);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // 3. Encrypt if E2E is available for this conversation
    let payload = { content: trimmed, encryptedContent: '' };

    if (e2eOn && !isGroup && otherUserId) {
      try {
        const encrypted = await encryptFor(myId, otherUserId, trimmed);
        if (encrypted.isEncrypted) {
          payload = {
            content:          '',                       // empty — server doesn't store plaintext
            encryptedContent: encrypted.encryptedContent,
          };
        }
      } catch (err) {
        console.warn('Encrypt failed, sending plaintext:', err.message);
      }
    }

    // 4. Emit via socket
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:send', {
        conversationId,
        content:          payload.content,
        encryptedContent: payload.encryptedContent,
        type:             'text',
        tempId,
      }, (ack) => {
        if (ack?.error) {
          failOptimistic(tempId, conversationId);
          toast.error('Failed to send message');
        }
      });

      // 5s safety net
      const failTimeout = setTimeout(() => {
        const msgs       = useChatStore.getState().messages[conversationId] || [];
        const stillPending = msgs.find((m) => m._tempId === tempId && m._optimistic && !m._resolved);
        if (stillPending) failOptimistic(tempId, conversationId);
      }, 5000);

      socket.once('message:sent', ({ tempId: tid }) => {
        if (tid === tempId) clearTimeout(failTimeout);
      });
    } else {
      toast('Message queued — reconnecting…', { icon: '📶' });
    }

    inputRef.current?.focus();
  }, [text, previewFile, conversationId, myId, otherUserId, e2eOn, isGroup, user, addOptimistic, failOptimistic]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    handleTypingStart();
  };

  const handleTypingStart = () => {
    if (!isTyping) { setIsTyping(true); startTyping(conversationId); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(handleStopTyping, 2500);
  };

  const handleStopTyping = () => {
    clearTimeout(typingTimer);
    if (isTyping) { setIsTyping(false); stopTyping(conversationId); }
  };

  const onEmojiClick = (emojiData) => {
    const cursor  = inputRef.current?.selectionStart ?? text.length;
    const newText = text.slice(0, cursor) + emojiData.emoji + text.slice(cursor);
    setText(newText);
    setTimeout(() => {
      inputRef.current?.focus();
      const pos = cursor + emojiData.emoji.length;
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) {
      const file    = accepted[0];
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      setPreviewFile({ file, preview });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, noClick: true, noKeyboard: true,
    accept: { 'image/*': [], 'video/*': [], 'application/pdf': [] },
    maxSize: 50 * 1024 * 1024,
  });

  const handleFileSend = async () => {
    if (!previewFile) return;
    setUploading(true);
    const tempId = genTempId();
    try {
      const formData = new FormData();
      formData.append('file', previewFile.file);
      formData.append('conversationId', conversationId);
      const { data } = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      getSocket()?.emit('message:send', {
        conversationId,
        content: previewFile.file.name,
        type:    previewFile.file.type.startsWith('image/') ? 'image' : 'document',
        media:   data.media,
        tempId,
      });
      setPreviewFile(null);
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const canSend = text.trim().length > 0 || !!previewFile;

  return (
    <div {...getRootProps()} className={`${styles.container} ${isDragActive ? styles.dragActive : ''}`}>
      <input {...getInputProps()} />

      {isDragActive && (
        <div className={styles.dragOverlay}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Drop to send</p>
        </div>
      )}

      {previewFile && (
        <div className={styles.filePreview}>
          {previewFile.preview
            ? <img src={previewFile.preview} alt="preview" className={styles.previewImg} />
            : <div className={styles.fileIcon}>📄</div>
          }
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{previewFile.file.name}</span>
            <span className={styles.fileSize}>{formatBytes(previewFile.file.size)}</span>
          </div>
          <button className={styles.removeFile} onClick={() => setPreviewFile(null)}>✕</button>
        </div>
      )}

      {showEmoji && (
        <div className={styles.emojiPicker}>
          <EmojiPicker onEmojiClick={onEmojiClick} theme="dark"
            width={320} height={380} skinTonesDisabled previewConfig={{ showPreview: false }} />
        </div>
      )}

      <div className={styles.bar}>
        {/* E2E lock badge */}
        {!isGroup && (
          <span
            className={`${styles.e2eBadge} ${e2eOn ? styles.e2eOn : styles.e2eOff}`}
            title={e2eOn ? 'End-to-end encrypted' : 'Encryption not available'}
          >
            {e2eOn ? '🔒' : '🔓'}
          </span>
        )}

        <button className={`btn btn-ghost ${styles.iconBtn} ${showEmoji ? styles.iconActive : ''}`}
          onClick={() => setShowEmoji((v) => !v)} title="Emoji" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>

        <button className={`btn btn-ghost ${styles.iconBtn}`} onClick={open} title="Attach" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        <textarea ref={inputRef} className={styles.textarea}
          placeholder={e2eOn ? '🔒 Encrypted message…' : 'Type a message…'}
          value={text} onChange={handleChange} onKeyDown={handleKeyDown} rows={1}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />

        <button className={`btn btn-primary ${styles.sendBtn} ${!canSend ? styles.sendDisabled : ''}`}
          onClick={handleSend} disabled={uploading || !canSend} type="button">
          {uploading
            ? <div className={styles.uploadSpinner} />
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
          }
        </button>
      </div>
    </div>
  );
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}
