import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import { getSocket } from '../../services/socket';
import { decryptMsg } from '../../services/e2eManager';
import styles from './MessageBubble.module.css';

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function MessageBubble({ message, isOwn, showAvatar, conversationId }) {
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [displayText, setDisplayText] = useState(message.content || '');
  const [decrypting, setDecrypting] = useState(false);

  const { user } = useAuthStore();
  const { conversations } = useChatStore();

  const isOptimistic = !!message._optimistic && !message._resolved;
  const isFailed = !!message._failed;
  const isDeleted = message.isDeleted;

  const myId = user?._id?.toString() || user?.id?.toString();

  // Resolve the OTHER participant in this conversation so decryption always uses
  // the correct ECDH key partner — not the message's senderId (which equals myId
  // for own sent messages, causing ECDH(myPriv, myPub) instead of the shared secret)
  const conversation = conversations.find((c) => c._id === conversationId);
  const otherMember = conversation?.members?.find((m) => {
    const mid = m.userId?._id?.toString() || m.userId?.toString();
    return mid !== myId;
  });
  const otherParticipantId =
    otherMember?.userId?._id?.toString() || otherMember?.userId?.toString();


  // ─── Decrypt on mount / message change ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function decrypt() {
      // Own optimistic bubble already has plaintext in content
      if (message._optimistic || !message.encryptedContent) {
        setDisplayText(message.content || '');
        return;
      }

      setDecrypting(true);
      // Pass otherParticipantId so decryptMsg uses the correct ECDH peer
      // regardless of whether this is our own message or a received one
      const text = await decryptMsg(message, myId, otherParticipantId);
      if (!cancelled) {
        setDisplayText(text || message.content || '🔒 Encrypted message');
        setDecrypting(false);
      }
    }

    decrypt();
    return () => { cancelled = true; };
    // Include myId + otherParticipantId so effect re-runs if auth hydrates late
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message._id, message.encryptedContent, message.content, message._optimistic, myId, otherParticipantId]);

  if (isDeleted) {
    return (
      <div className={`${styles.row} ${isOwn ? styles.rowOwn : ''}`}>
        <div className={`${styles.bubble} ${styles.deleted}`}>
          <span>🗑 This message was deleted</span>
        </div>
      </div>
    );
  }

  const handleReaction = (emoji) => {
    getSocket()?.emit('reaction:add', { messageId: message._id, conversationId, emoji });
    setShowReactions(false);
    setShowActions(false);
  };

  const handleDelete = () => {
    getSocket()?.emit('message:delete', { messageId: message._id, conversationId, forEveryone: isOwn });
    setShowActions(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(displayText);
    setShowActions(false);
  };

  const handleRetry = () => {
    getSocket()?.emit('message:send', {
      conversationId,
      content: message.content,
      type: message.type || 'text',
      tempId: message._tempId,
    });
  };

  const time = message.createdAt ? format(new Date(message.createdAt), 'HH:mm') : '';

  const reactionGroups = {};
  (message.reactions || []).forEach(({ emoji, userId }) => {
    if (!reactionGroups[emoji]) reactionGroups[emoji] = [];
    reactionGroups[emoji].push(userId);
  });

  const senderName = message.senderId?.name || '';
  const senderAvatar = message.senderId?.avatar;
  const isEncrypted = !!message.encryptedContent;

  return (
    <div
      className={`${styles.row} ${isOwn ? styles.rowOwn : ''} ${isOptimistic ? styles.optimistic : ''}`}
      onMouseEnter={() => !isOptimistic && setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {/* Avatar */}
      {!isOwn && (
        <div className={styles.avatarCol}>
          {showAvatar
            ? senderAvatar
              ? <img src={senderAvatar} alt={senderName} className="avatar" style={{ width: 28, height: 28 }} />
              : <span className="avatar-placeholder" style={{ width: 28, height: 28, fontSize: 11 }}>
                {senderName?.[0]?.toUpperCase()}
              </span>
            : <div style={{ width: 28 }} />
          }
        </div>
      )}

      <div className={styles.bubbleWrap}>
        {!isOwn && showAvatar && senderName && (
          <div className={styles.senderName}>{senderName}</div>
        )}

        {message.replyTo && (
          <div className={styles.replyPreview}>
            <div className={styles.replyBar} />
            <span className={styles.replyText}>{message.replyTo?.content || 'Original message'}</span>
          </div>
        )}

        <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : styles.bubbleOther} ${isFailed ? styles.bubbleFailed : ''}`}>
          {message.type === 'image' && message.media?.url && (
            <img src={message.media.url} alt="media" className={styles.mediaImg}
              onClick={() => window.open(message.media.url, '_blank')} />
          )}

          {/* Message text — shows decrypted content */}
          {decrypting
            ? <p className={styles.text} style={{ opacity: 0.5 }}>🔓 Decrypting…</p>
            : <p className={styles.text}>{displayText}</p>
          }

          <div className={styles.meta}>
            {/* Encryption badge */}
            {isEncrypted && (
              <span className={styles.lockBadge} title="End-to-end encrypted">🔒</span>
            )}
            {message.isEdited && <span className={styles.edited}>edited</span>}
            <span className={styles.time}>{time}</span>

            {isOwn && (
              <span className={styles.status}>
                {isFailed ? (
                  <span className={styles.failIcon} onClick={handleRetry} title="Tap to retry">⚠️</span>
                ) : isOptimistic ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ) : message.status === 'read' ? (
                  <svg width="16" height="10" viewBox="0 0 18 11" fill="none">
                    <path d="M1 5.5L5.5 10L15 1" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 5.5L10.5 10L17 2" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : message.status === 'delivered' ? (
                  <svg width="16" height="10" viewBox="0 0 18 11" fill="none">
                    <path d="M1 5.5L5.5 10L15 1" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 5.5L10.5 10L17 2" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="12" height="10" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L5.5 9.5L13 1" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            )}
          </div>
        </div>

        {isFailed && (
          <button className={styles.retryBtn} onClick={handleRetry}>↺ Tap to retry</button>
        )}

        {Object.keys(reactionGroups).length > 0 && (
          <div className={`${styles.reactions} ${isOwn ? styles.reactionsOwn : ''}`}>
            {Object.entries(reactionGroups).map(([emoji, users]) => (
              <button key={emoji}
                className={`${styles.reactionChip} ${users.includes(user?._id) ? styles.reactionOwn : ''}`}
                onClick={() => handleReaction(emoji)}>
                {emoji}{users.length > 1 && <span>{users.length}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action toolbar */}
      {showActions && !isOptimistic && (
        <div className={`${styles.actions} ${isOwn ? styles.actionsOwn : styles.actionsOther}`}>
          <button className={styles.actionBtn} onClick={() => setShowReactions((v) => !v)} title="React">😊</button>
          <button className={styles.actionBtn} onClick={handleCopy} title="Copy">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          {isOwn && (
            <button className={styles.actionBtn} onClick={handleDelete} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
              </svg>
            </button>
          )}
          {showReactions && (
            <div className={`${styles.reactionPicker} ${isOwn ? styles.reactionPickerOwn : ''}`}>
              {REACTIONS.map((e) => (
                <button key={e} className={styles.reactionOption} onClick={() => handleReaction(e)}>{e}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
