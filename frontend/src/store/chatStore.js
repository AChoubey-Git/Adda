import { create } from 'zustand';
import api from '../services/api';

// Unique temp ID generator
let tempCounter = 0;
export const genTempId = () => `temp_${Date.now()}_${++tempCounter}`;

const useChatStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},         // { [convId]: Message[] }
  typingUsers: {},      // { [convId]: Set<userId> }
  onlineUsers: new Set(),
  unreadCounts: {},     // { [convId]: number }
  isLoading: false,
  searchQuery: '',

  // ─── Conversations ─────────────────────────────────────────────────────────

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/chat/conversations');
      set({ conversations: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      console.error('fetchConversations failed:', err);
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      // Always refresh messages when switching conversations
      get().fetchMessages(id, 1);
      get().clearUnread(id);
    }
  },

  addConversation: (conv) => {
    set((state) => {
      const exists = state.conversations.find((c) => c._id === conv._id);
      if (exists) return {};
      return { conversations: [conv, ...state.conversations] };
    });
  },

  updateConversation: (updated) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === updated._id ? { ...c, ...updated } : c
      ),
    }));
  },

  // ─── Messages ──────────────────────────────────────────────────────────────

  fetchMessages: async (conversationId, page = 1) => {
    try {
      const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, {
        params: { page, limit: 50 },
      });

      set((state) => {
        const existing = state.messages[conversationId] || [];
        // Keep optimistic messages (tempId) on top when loading page 1
        const optimistic = existing.filter((m) => m._tempId);
        const real = page === 1 ? data.messages : [...data.messages, ...existing.filter((m) => !m._tempId)];
        // Deduplicate by _id
        const seen = new Set();
        const deduped = [...real, ...optimistic].filter((m) => {
          const key = m._id || m._tempId;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return {
          messages: { ...state.messages, [conversationId]: deduped },
        };
      });

      return data;
    } catch (err) {
      console.error('fetchMessages failed:', err);
    }
  },

  // Add optimistic message immediately (before server confirms)
  addOptimistic: (message) => {
    const convId = message.conversationId;
    set((state) => {
      const existing = state.messages[convId] || [];
      return {
        messages: { ...state.messages, [convId]: [...existing, message] },
      };
    });
  },

  // Replace optimistic bubble with real server message
  resolveOptimistic: (serverMessage, tempId) => {
    const convId = serverMessage.conversationId?._id || serverMessage.conversationId;
    const state = get();
    const existing = state.messages[convId] || [];

    // Find by tempId (our own message) or by _id (already exists)
    // Bug #2 fix: use ternary so findIndex returning 0 (first msg) is never falsy
    const byTempId = tempId ? existing.findIndex((m) => m._tempId === tempId) : -1;
    const byRealId = existing.findIndex((m) => m._id === serverMessage._id);

    if (byTempId !== undefined && byTempId !== -1) {
      // Replace optimistic with real
      const updated = [...existing];
      updated[byTempId] = { ...serverMessage, _resolved: true };

      const conversations = state.conversations.map((c) =>
        c._id === convId
          ? { ...c, lastMessage: serverMessage, lastActivity: serverMessage.createdAt }
          : c
      );
      conversations.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

      set({ messages: { ...state.messages, [convId]: updated }, conversations });
      return true; // was optimistic, resolved
    }

    if (byRealId !== -1) {
      return true; // already exists, skip duplicate
    }

    // It's a new incoming message from someone else
    return false;
  },

  // Add real message (from other user via socket)
  addMessage: (message) => {
    const convId = message.conversationId?._id || message.conversationId;
    set((state) => {
      const existing = state.messages[convId] || [];

      // Deduplicate
      if (existing.some((m) => m._id === message._id)) return {};

      const conversations = state.conversations.map((c) =>
        c._id === convId
          ? { ...c, lastMessage: message, lastActivity: message.createdAt }
          : c
      );
      conversations.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

      // Unread count only if not currently viewing this conversation
      const unreadCounts = { ...state.unreadCounts };
      if (convId !== state.activeConversationId) {
        unreadCounts[convId] = (unreadCounts[convId] || 0) + 1;
      }

      return {
        messages: { ...state.messages, [convId]: [...existing, message] },
        conversations,
        unreadCounts,
      };
    });
  },

  updateMessage: (updated) => {
    const convId = updated.conversationId?._id || updated.conversationId;
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: (state.messages[convId] || []).map((m) =>
          m._id === updated._id ? { ...m, ...updated } : m
        ),
      },
    }));
  },

  deleteMessage: (messageId, conversationId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m._id === messageId
            ? { ...m, isDeleted: true, content: 'This message was deleted' }
            : m
        ),
      },
    }));
  },

  // Mark a failed optimistic message
  failOptimistic: (tempId, conversationId) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m._tempId === tempId ? { ...m, _failed: true } : m
        ),
      },
    }));
  },

  updateReadReceipts: (conversationId, userId, timestamp) => {
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) => ({
          ...m,
          status: m.status !== 'read' ? 'read' : m.status,
        })),
      },
    }));
  },

  // Bug #4 fix: accept authoritative server reactions array to prevent drift
  updateReaction: (messageId, userId, emoji, serverReactions) => {
    // Find which conversation this message belongs to and update reactions
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId of Object.keys(newMessages)) {
        const msgs = newMessages[convId];
        const idx = msgs.findIndex((m) => m._id === messageId);
        if (idx !== -1) {
          const msg = { ...msgs[idx] };
          if (serverReactions) {
            // Use authoritative server state — avoids drift when multiple users react simultaneously
            msg.reactions = serverReactions;
          } else {
            // Fallback: reconstruct locally (backwards-compat if server doesn't send full array)
            const reactions = (msg.reactions || []).filter((r) => r.userId !== userId);
            reactions.push({ userId, emoji, createdAt: new Date() });
            msg.reactions = reactions;
          }
          const updated = [...msgs];
          updated[idx] = msg;
          newMessages[convId] = updated;
          break;
        }
      }
      return { messages: newMessages };
    });
  },

  clearUnread: (conversationId) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
    }));
  },

  // ─── Typing ────────────────────────────────────────────────────────────────

  setTyping: (conversationId, userId, isTyping) => {
    set((state) => {
      const current = new Set(state.typingUsers[conversationId] || []);
      if (isTyping) current.add(userId);
      else current.delete(userId);
      return { typingUsers: { ...state.typingUsers, [conversationId]: current } };
    });
  },

  // ─── Presence ──────────────────────────────────────────────────────────────

  setUserOnline: (userId) => {
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(userId);
      return { onlineUsers: next };
    });
  },

  setUserOffline: (userId) => {
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(userId);
      return { onlineUsers: next };
    });
  },

  isOnline: (userId) => get().onlineUsers.has(userId),

  setSearchQuery: (q) => set({ searchQuery: q }),
}));

export default useChatStore;
