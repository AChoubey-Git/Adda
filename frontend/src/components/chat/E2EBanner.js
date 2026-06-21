import React, { useEffect, useState } from 'react';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import { isE2EAvailable } from '../../services/e2eManager';
import styles from './E2EBanner.module.css';

/**
 * Shows a small banner under the chat header indicating encryption status.
 * Green lock  = E2E active for this conversation
 * Grey lock   = E2E not available (recipient has no public key)
 * Hidden      = group chats (E2E per-message not yet supported)
 */
export default function E2EBanner({ conversationId }) {
  const { user, e2eEnabled }  = useAuthStore();
  const { conversations }      = useChatStore();
  const [status, setStatus]    = useState('checking'); // checking | on | off | disabled

  const conversation = conversations.find((c) => c._id === conversationId);
  const isGroup      = conversation?.type === 'group';

  const myId = user?._id?.toString() || user?.id?.toString();

  const otherMember = !isGroup && conversation?.members?.find((m) => {
    const mid = m.userId?._id?.toString() || m.userId?.toString();
    return mid !== myId;
  });
  const otherUserId = otherMember?.userId?._id?.toString() || otherMember?.userId?.toString();

  useEffect(() => {
    if (isGroup) { setStatus('group'); return; }
    if (!e2eEnabled) { setStatus('disabled'); return; }
    if (!myId || !otherUserId) { setStatus('off'); return; }

    setStatus('checking');
    isE2EAvailable(myId, otherUserId).then((available) => {
      setStatus(available ? 'on' : 'off');
    });
  }, [conversationId, myId, otherUserId, isGroup, e2eEnabled]);

  if (isGroup || status === 'group') return null;

  return (
    <div className={`${styles.banner} ${
      status === 'on'       ? styles.on
      : status === 'disabled' ? styles.off
      : status === 'checking' ? styles.checking
      : styles.off
    }`}>
      {status === 'checking' && (
        <><span className={styles.dot} />Checking encryption…</>
      )}
      {status === 'on' && (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Messages are end-to-end encrypted. Only you and the recipient can read them.
        </>
      )}
      {status === 'disabled' && (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
          Encryption is disabled — messages are sent as plain text. Enable it in Settings.
        </>
      )}
      {status === 'off' && (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
          Encryption not available — recipient needs to log in again to set up their keys.
        </>
      )}
    </div>
  );
}
