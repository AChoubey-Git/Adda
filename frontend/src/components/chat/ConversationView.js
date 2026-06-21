import React, { useEffect, useRef, useState, useCallback } from 'react';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import E2EBanner  from './E2EBanner';
import { markRead, joinConversation } from '../../services/socket';
import styles from './ConversationView.module.css';

export default function ConversationView({ conversationId, onBack }) {
  const { messages, fetchMessages, clearUnread, typingUsers, conversations } = useChatStore();
  const { user } = useAuthStore();
  const bottomRef  = useRef(null);
  const messagesEl = useRef(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore]             = useState(true);
  const [page, setPage]                   = useState(1);
  const [autoScroll, setAutoScroll]       = useState(true);

  const convMessages = messages[conversationId] || [];
  const typingSet    = typingUsers[conversationId] || new Set();

  // ─── On conversation change ─────────────────────────────────────────────
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setAutoScroll(true);

    // Join room so we receive events even if gateway missed us
    joinConversation(conversationId);
    markRead(conversationId);
    clearUnread(conversationId);

    // Fetch first page
    fetchMessages(conversationId, 1).then((data) => {
      if (data) setHasMore(data.hasMore);
      scrollToBottom('instant');
    });
  }, [conversationId]);

  // ─── Auto-scroll on new messages ────────────────────────────────────────
  useEffect(() => {
    if (autoScroll) scrollToBottom('smooth');
  }, [convMessages.length]);

  // ─── Scroll to bottom ───────────────────────────────────────────────────
  const scrollToBottom = (behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // ─── Track if user scrolled up (disable auto-scroll) ───────────────────
  const handleScroll = useCallback(async () => {
    const el = messagesEl.current;
    if (!el) return;

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distFromBottom < 80);

    // Load more when near top
    if (el.scrollTop < 80 && !isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      const prevHeight = el.scrollHeight;
      const nextPage = page + 1;
      const data = await fetchMessages(conversationId, nextPage);
      if (data) {
        setHasMore(data.hasMore);
        setPage(nextPage);
        // Preserve scroll position
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight - prevHeight;
        });
      }
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, conversationId]);

  // Group messages: same sender within 2 min = no avatar
  const renderMessages = () => {
    return convMessages.map((msg, i) => {
      const prev = convMessages[i - 1];
      const next = convMessages[i + 1];

      const showDate = !prev || !isSameDay(
        new Date(prev.createdAt || Date.now()),
        new Date(msg.createdAt  || Date.now())
      );

      const msgSenderId  = msg.senderId?._id  || msg.senderId;
      const prevSenderId = prev?.senderId?._id || prev?.senderId;
      const nextSenderId = next?.senderId?._id || next?.senderId;

      const isOwn = msgSenderId === user?._id;

      // Show avatar only on last message in a run
      const showAvatar = !isOwn && nextSenderId !== msgSenderId;

      // Tail on first message in a run
      const isFirstInRun  = prevSenderId !== msgSenderId;
      const isLastInRun   = nextSenderId !== msgSenderId;

      return (
        <React.Fragment key={msg._id || msg._tempId}>
          {showDate && (
            <div className={styles.dateDivider}>
              <span>{formatDate(msg.createdAt)}</span>
            </div>
          )}
          <MessageBubble
            message={msg}
            isOwn={isOwn}
            showAvatar={showAvatar}
            isFirstInRun={isFirstInRun}
            isLastInRun={isLastInRun}
            conversationId={conversationId}
          />
        </React.Fragment>
      );
    });
  };

  // ─── Typing label ───────────────────────────────────────────────────────
  const typingLabel = () => {
    if (typingSet.size === 0) return null;
    const conv = conversations.find((c) => c._id === conversationId);
    if (!conv) return null;

    const names = [...typingSet]
      .map((uid) => {
        const member = conv.members?.find((m) => (m.userId?._id || m.userId) === uid);
        return member?.userId?.name?.split(' ')[0] || 'Someone';
      })
      .filter(Boolean);

    if (names.length === 0) return null;
    return names.length === 1
      ? `${names[0]} is typing…`
      : `${names.slice(0, 2).join(', ')} are typing…`;
  };

  const typing = typingLabel();

  return (
    <div className={styles.container}>
      <ChatHeader conversationId={conversationId} onBack={onBack} />
      <E2EBanner conversationId={conversationId} />

      <div className={styles.messages} ref={messagesEl} onScroll={handleScroll}>
        {/* Load more spinner */}
        {isLoadingMore && (
          <div className={styles.loadingMore}>
            <div className={styles.spinner} />
          </div>
        )}

        {/* No messages yet */}
        {convMessages.length === 0 && !isLoadingMore && (
          <div className={styles.emptyState}>
            <span>👋</span>
            <p>No messages yet — say hello!</p>
          </div>
        )}

        {renderMessages()}

        {/* Typing indicator */}
        {typing && (
          <div className={styles.typing}>
            <div className={styles.typingDots}>
              <span /><span /><span />
            </div>
            <span className={styles.typingLabel}>{typing}</span>
          </div>
        )}

        {/* Invisible anchor for scroll-to-bottom */}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {/* Scroll-to-bottom FAB */}
      {!autoScroll && (
        <button className={styles.scrollFab} onClick={() => scrollToBottom('smooth')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      <MessageInput conversationId={conversationId} />
    </div>
  );
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d       = new Date(dateStr);
  const today   = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, today))     return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
