import React, { useState } from 'react';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import GroupInfoModal from './GroupInfoModal';
import styles from './ChatHeader.module.css';

export default function ChatHeader({ conversationId, onBack }) {
  const { conversations, isOnline } = useChatStore();
  const { user }    = useAuthStore();
  const [showInfo, setShowInfo] = useState(false);

  const conversation = conversations.find((c) => c._id === conversationId);
  if (!conversation) return null;

  const isGroup = conversation.type === 'group';
  const myId    = user?._id?.toString() || user?.id?.toString();

  // ✅ Same robust extraction as ConversationItem
  const otherMember = isGroup
    ? null
    : conversation.members?.find((m) => {
        const mid =
          m.userId?._id?.toString() ||
          m.userId?.id?.toString()  ||
          m.userId?.toString();
        return mid !== myId;
      });

  const otherUser = otherMember?.userId;
  const name = isGroup
    ? conversation.name || 'Group'
    : typeof otherUser === 'object'
      ? otherUser?.name || 'User'
      : 'User';

  const avatar = isGroup ? conversation.avatar : otherUser?.avatar;

  const otherUserId =
    otherUser?._id?.toString() ||
    otherUser?.id?.toString()  ||
    otherMember?.userId?.toString();

  const online = !isGroup && !!otherUserId && isOnline(otherUserId);

  const lastSeen = !isGroup && otherUser?.lastSeen
    ? new Date(otherUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const subtitle = isGroup
    ? `${conversation.members?.length || 0} members`
    : online
    ? 'Online'
    : lastSeen
    ? `Last seen ${lastSeen}`
    : 'Offline';

  return (
    <>
      <div className={styles.header}>
        {/* Back button — mobile only */}
        {onBack && (
          <button className={styles.backBtn} onClick={onBack} title="Back" aria-label="Back to conversations">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}
        <button className={styles.info} onClick={() => setShowInfo(true)}>
          <div className={styles.avatarWrap}>
            {avatar ? (
              <img src={avatar} alt={name} className="avatar" style={{ width: 38, height: 38 }} />
            ) : (
              <span className="avatar-placeholder" style={{ width: 38, height: 38, fontSize: 15 }}>
                {isGroup ? '👥' : name?.[0]?.toUpperCase() || '?'}
              </span>
            )}
            {!isGroup && (
              <span className={`status-dot ${online ? 'online' : 'offline'} ${styles.dot}`} />
            )}
          </div>
          <div className={styles.meta}>
            <span className={styles.name}>{name}</span>
            <span className={`${styles.sub} ${online ? styles.subOnline : ''}`}>{subtitle}</span>
          </div>
        </button>

        <div className={styles.actions}>
          <button className="btn btn-ghost" title="Video call">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          <button className="btn btn-ghost" title="Info" onClick={() => setShowInfo(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="1" fill="currentColor"/>
              <circle cx="12" cy="12" r="1" fill="currentColor"/>
              <circle cx="12" cy="19" r="1" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {showInfo && isGroup && (
        <GroupInfoModal conversation={conversation} onClose={() => setShowInfo(false)} />
      )}
    </>
  );
}
