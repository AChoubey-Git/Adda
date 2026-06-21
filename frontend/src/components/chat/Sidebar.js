import React, { useState } from 'react';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import ConversationItem from './ConversationItem';
import NewChatModal from './NewChatModal';
import UserSettingsModal from './UserSettingsModal';
import styles from './Sidebar.module.css';

export default function Sidebar({ onConversationSelect }) {
  const { conversations, activeConversationId, setActiveConversation, searchQuery, setSearchQuery, unreadCounts } = useChatStore();
  const { user, logout } = useAuthStore();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const handleSelect = (convId) => {
    if (onConversationSelect) {
      onConversationSelect(convId);
    } else {
      setActiveConversation(convId);
    }
  };

  const filtered = conversations.filter((c) => {
    const name = c.type === 'direct'
      ? c.members?.find((m) => (m.userId?._id || m.userId) !== user?._id)?.userId?.name || ''
      : c.name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase());
    if (activeTab === 'unread') return matchesSearch && (unreadCounts[c._id] || 0) > 0;
    if (activeTab === 'groups') return matchesSearch && c.type === 'group';
    return matchesSearch;
  });

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.brandBlock}>
          <span className={styles.brandName}>Adda</span>
          <span className={styles.brandSub}>আড্ডা</span>
        </div>

        <button className={`btn btn-ghost ${styles.newChatBtn}`} onClick={() => setShowNewChat(true)} title="New conversation">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>

        <button className={styles.avatar} onClick={() => setShowSettings(true)} title="Settings">
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="avatar" style={{ width: 34, height: 34 }} />
            : <span className="avatar-placeholder" style={{ width: 34, height: 34, fontSize: 13 }}>
                {user?.name?.[0]?.toUpperCase()}
              </span>
          }
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search conversations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['all', 'unread', 'groups'].map((tab) => (
          <button key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === 'unread' && totalUnread > 0 && (
              <span className={styles.badge}>{totalUnread}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span style={{ fontSize: 36 }}>💬</span>
            <p>{searchQuery ? 'No results found' : 'No conversations yet'}</p>
            {!searchQuery && (
              <button className="btn btn-primary" onClick={() => setShowNewChat(true)}>
                Start an adda
              </button>
            )}
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv._id}
              conversation={conv}
              isActive={activeConversationId === conv._id}
              unreadCount={unreadCounts[conv._id] || 0}
              onClick={() => handleSelect(conv._id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={`btn btn-ghost ${styles.footerBtn}`} onClick={() => setShowSettings(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
        <button className={`btn btn-ghost ${styles.footerBtn}`} onClick={logout}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </aside>
  );
}
