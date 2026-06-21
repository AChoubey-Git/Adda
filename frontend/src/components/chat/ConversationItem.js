import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import styles from './ConversationItem.module.css';

export default function ConversationItem({ conversation, isActive, unreadCount, onClick }) {
  const { user }    = useAuthStore();
  const { isOnline } = useChatStore();

  const isGroup = conversation.type === 'group';

  // ✅ Robust ID extraction — handles both populated objects and raw string IDs
  const myId = user?._id?.toString() || user?.id?.toString();

  const otherMember = isGroup
    ? null
    : conversation.members?.find((m) => {
        // m.userId can be a populated User object OR a raw ObjectId string
        const memberId =
          m.userId?._id?.toString() ||
          m.userId?.id?.toString()  ||
          m.userId?.toString();
        return memberId !== myId;
      });

  // ✅ Safe name extraction
  const otherUser = otherMember?.userId;
  const name = isGroup
    ? conversation.name || 'Group'
    : typeof otherUser === 'object'
      ? otherUser?.name || 'User'
      : 'User'; // populated object always has name; raw ID means not loaded yet

  const avatar = isGroup ? conversation.avatar : otherUser?.avatar;

  // Online status
  const otherUserId =
    otherUser?._id?.toString() ||
    otherUser?.id?.toString()  ||
    otherMember?.userId?.toString();
  const online = !isGroup && !!otherUserId && isOnline(otherUserId);

  // Last message preview
  const lastMsg  = conversation.lastMessage;
  const lastText = !lastMsg
    ? 'Start an adda…'
    : lastMsg.isDeleted
    ? '🗑 Message deleted'
    : lastMsg.type && lastMsg.type !== 'text'
    ? `📎 ${lastMsg.type}`
    : lastMsg.content || 'Start an adda…';

  const lastTime = lastMsg?.createdAt
    ? formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false })
    : '';

  return (
    <button
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={styles.avatarWrap}>
        {avatar ? (
          <img src={avatar} alt={name} className="avatar" style={{ width: 44, height: 44 }} />
        ) : (
          <span
            className="avatar-placeholder"
            style={{
              width: 44, height: 44, fontSize: 17,
              background: isGroup ? 'var(--accent)' : stringToColor(name),
            }}
          >
            {isGroup ? '👥' : name?.[0]?.toUpperCase() || '?'}
          </span>
        )}
        {!isGroup && (
          <span className={`status-dot ${online ? 'online' : 'offline'} ${styles.statusDot}`} />
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        <div className={styles.top}>
          <span className={styles.name}>{name}</span>
          {lastTime && <span className={styles.time}>{lastTime}</span>}
        </div>
        <div className={styles.bottom}>
          <span className={`${styles.preview} ${unreadCount > 0 ? styles.unread : ''}`}>
            {lastText}
          </span>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function stringToColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#f97316','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444'];
  return colors[Math.abs(hash) % colors.length];
}
