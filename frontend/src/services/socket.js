import { io } from 'socket.io-client';
import useChatStore from '../store/chatStore';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001/chat';

let socket = null;

// ─── Connect ──────────────────────────────────────────────────────────────────
export const connectSocket = (token) => {
  if (socket?.connected) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    forceNew: true,
  });

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);

    // Re-join all rooms after reconnect
    const { conversations, activeConversationId, fetchMessages } = useChatStore.getState();
    conversations.forEach((c) => {
      socket.emit('conversation:join', { conversationId: c._id });
    });

    // Refresh active conversation to catch missed messages
    if (activeConversationId) {
      fetchMessages(activeConversationId, 1);
    }

    // Bug #1 fix: Flush offline message queue (was dead code at module level before)
    while (offlineQueue.length > 0 && socket?.connected) {
      socket.emit('message:send', offlineQueue.shift());
    }
  });

  socket.on('disconnect', (reason) => {
    console.warn('⚠️ Socket disconnected:', reason);
    if (reason === 'io server disconnect') socket.connect();
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connect_error:', err.message);
  });

  // ─── Message events ──────────────────────────────────────────────────────

  socket.on('message:new', (message) => {
    const store = useChatStore.getState();
    const resolved = store.resolveOptimistic(message);
    if (!resolved) {
      store.addMessage(message);
    }

    // Auto-mark read if this conversation is active
    const convId = message.conversationId?._id || message.conversationId;
    if (store.activeConversationId === convId) {
      socket.emit('message:read', { conversationId: convId });
    }

    // Desktop notification
    if (window.electron && document.hidden) {
      const senderName = message.senderId?.name || 'Someone';
      window.electron.notify({
        title: `Adda • ${senderName}`,
        body: message.isDeleted ? '🗑 Message deleted' : message.content || '📎 Media',
      });
    }
  });

  // Bug #9 fix: Preserve sender's plaintext when server returns content='' (E2E encrypted)
  socket.on('message:sent', ({ tempId, message }) => {
    if (!tempId) return;
    const store = useChatStore.getState();
    const convId = message.conversationId?._id || message.conversationId;
    const existing = store.messages[convId] || [];
    const optimistic = existing.find((m) => m._tempId === tempId);
    // When E2E is on, server stores content='' — keep our local plaintext so the
    // sender can still read their own message without a round-trip decrypt
    const merged = {
      ...message,
      content: message.content || optimistic?.content || '',
    };
    store.resolveOptimistic(merged, tempId);
  });

  socket.on('message:read', ({ conversationId, userId }) => {
    useChatStore.getState().updateReadReceipts(conversationId, userId);
  });

  socket.on('message:deleted', ({ messageId, conversationId }) => {
    useChatStore.getState().deleteMessage(messageId, conversationId);
  });

  socket.on('message:edited', (message) => {
    useChatStore.getState().updateMessage(message);
  });

  // Bug #4 fix: Server now sends full reactions array to avoid client-side drift
  socket.on('reaction:updated', ({ messageId, reactions, userId, emoji }) => {
    useChatStore.getState().updateReaction(messageId, userId, emoji, reactions);
  });

  // ✅ NEW — server pushes this when a new conversation is created involving this user
  socket.on('conversation:new', (conversation) => {
    const store = useChatStore.getState();
    const exists = store.conversations.find((c) => c._id === conversation._id);
    if (exists) {
      store.updateConversation(conversation);
    } else {
      store.addConversation(conversation);
    }
    // Join the room so future messages arrive
    socket.emit('conversation:join', { conversationId: conversation._id });
  });

  socket.on('typing:start', ({ conversationId, userId }) => {
    useChatStore.getState().setTyping(conversationId, userId, true);
  });

  socket.on('typing:stop', ({ conversationId, userId }) => {
    useChatStore.getState().setTyping(conversationId, userId, false);
  });

  socket.on('user:status', ({ userId, status }) => {
    if (status === 'online') useChatStore.getState().setUserOnline(userId);
    else useChatStore.getState().setUserOffline(userId);
  });

  socket.on('error', ({ event, message: msg }) => {
    console.error(`Server error [${event}]:`, msg);
  });

  return socket;
};

// ─── Disconnect ───────────────────────────────────────────────────────────────
export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

export const getSocket      = () => socket;
export const isConnected    = () => socket?.connected === true;

// ─── Emit helpers ─────────────────────────────────────────────────────────────
const offlineQueue = [];

export const sendMessage = (data) => {
  if (socket?.connected) {
    socket.emit('message:send', data);
  } else {
    offlineQueue.push(data);
    console.warn('Message queued (offline):', data.tempId);
  }
};

// Note: offline queue flush is handled inside connectSocket → socket.on('connect', ...)

export const startTyping    = (cid) => socket?.emit('typing:start',       { conversationId: cid });
export const stopTyping     = (cid) => socket?.emit('typing:stop',        { conversationId: cid });
export const markRead       = (cid) => socket?.emit('message:read',       { conversationId: cid });
export const joinConversation = (cid) => socket?.emit('conversation:join', { conversationId: cid });
