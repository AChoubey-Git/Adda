import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import useChatStore from '../../store/chatStore';
import { joinConversation } from '../../services/socket';
import styles from './Modal.module.css';

export default function NewChatModal({ onClose }) {
  const [tab, setTab]           = useState('direct');
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading]   = useState(false);
  const { addConversation, updateConversation, setActiveConversation } = useChatStore();

  useEffect(() => {
    if (!query) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q: query } });
        setResults(data);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleDirectChat = async (userId) => {
    setLoading(true);
    try {
      // ✅ Backend now returns fully-populated conversation
      const { data } = await api.post(`/chat/conversations/direct/${userId}`);

      // Add or update in sidebar
      const existing = useChatStore.getState().conversations.find((c) => c._id === data._id);
      if (existing) updateConversation(data);
      else addConversation(data);

      // Join the Socket.io room so messages arrive immediately
      joinConversation(data._id);

      setActiveConversation(data._id);
      onClose();
    } catch {
      toast.error('Failed to start conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim())    { toast.error('Group name required'); return; }
    if (selected.length < 1) { toast.error('Add at least 1 member'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/chat/conversations/group', {
        name:      groupName.trim(),
        memberIds: selected.map((u) => u._id),
      });
      addConversation(data);
      joinConversation(data._id);
      setActiveConversation(data._id);
      onClose();
    } catch {
      toast.error('Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (u) =>
    setSelected((prev) =>
      prev.find((x) => x._id === u._id) ? prev.filter((x) => x._id !== u._id) : [...prev, u]
    );

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>{tab === 'direct' ? 'New Adda' : 'New Group'}</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'direct' ? styles.tabActive : ''}`} onClick={() => setTab('direct')}>
            Direct Message
          </button>
          <button className={`${styles.tab} ${tab === 'group'  ? styles.tabActive : ''}`} onClick={() => setTab('group')}>
            Group Chat
          </button>
        </div>

        {tab === 'group' && (
          <div className={styles.groupName}>
            <input className="input" placeholder="Group name…" value={groupName}
              onChange={(e) => setGroupName(e.target.value)} />
          </div>
        )}

        {tab === 'group' && selected.length > 0 && (
          <div className={styles.chips}>
            {selected.map((u) => (
              <span key={u._id} className={styles.chip}>
                {u.name}
                <button onClick={() => toggleSelect(u)}>✕</button>
              </span>
            ))}
          </div>
        )}

        <div className={styles.search}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className={styles.searchInput} placeholder="Search people…" value={query}
            onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>

        <div className={styles.results}>
          {results.length === 0 && query && <p className={styles.empty}>No users found</p>}
          {results.map((u) => {
            const isSel = selected.find((x) => x._id === u._id);
            return (
              <button key={u._id}
                className={`${styles.userRow} ${isSel ? styles.userSelected : ''}`}
                onClick={() => tab === 'direct' ? handleDirectChat(u._id) : toggleSelect(u)}
                disabled={loading}
              >
                <span className="avatar-placeholder" style={{ width: 36, height: 36, fontSize: 14 }}>
                  {u.name?.[0]?.toUpperCase()}
                </span>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{u.name}</span>
                  <span className={styles.userEmail}>{u.email}</span>
                </div>
                {tab === 'group' && (
                  <span className={`${styles.check} ${isSel ? styles.checkActive : ''}`}>
                    {isSel ? '✓' : '+'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === 'group' && (
          <div className={styles.footer}>
            <button className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleCreateGroup} disabled={loading}>
              {loading ? 'Creating…' : `Create Group (${selected.length} members)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
