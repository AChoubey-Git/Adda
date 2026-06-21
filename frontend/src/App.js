import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useChatStore from './store/chatStore';
import { connectSocket, disconnectSocket, isConnected } from './services/socket';
import LoginPage    from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ChatLayout   from './components/chat/ChatLayout';
import ConnectionBanner from './components/shared/ConnectionBanner';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? children : <Navigate to="/" replace />;
}

export default function App() {
  const { isAuthenticated, accessToken, ensureE2E } = useAuthStore();
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  // Connect socket + boot E2E when auth is ready
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectSocket(accessToken);
      fetchConversations();

      // Re-init E2E if page was reloaded while logged in
      ensureE2E();

      // Apply saved theme
      const theme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      disconnectSocket();
    }
    return () => { if (!isAuthenticated) disconnectSocket(); };
  }, [isAuthenticated, accessToken, ensureE2E, fetchConversations]);

  // Reconnect when tab becomes visible again
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && accessToken) {
        if (!isConnected()) connectSocket(accessToken);
        fetchConversations();
        const { activeConversationId, fetchMessages } = useChatStore.getState();
        if (activeConversationId) fetchMessages(activeConversationId, 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [isAuthenticated, accessToken, fetchConversations]);

  // Reconnect on network restore
  useEffect(() => {
    const handleOnline = () => {
      if (isAuthenticated && accessToken && !isConnected()) {
        connectSocket(accessToken);
        fetchConversations();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isAuthenticated, accessToken, fetchConversations]);

  return (
    <>
      {isAuthenticated && <ConnectionBanner />}
      <Routes>
        <Route path="/login"    element={<PublicRoute><LoginPage    /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/*"        element={<PrivateRoute><ChatLayout  /></PrivateRoute>} />
      </Routes>
    </>
  );
}
