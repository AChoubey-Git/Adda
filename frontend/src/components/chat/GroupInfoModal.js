import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useChatStore from '../../store/chatStore';
import api from '../../services/api';
import styles from './Modal.module.css';

export default function GroupInfoModal({ conversation, onClose }) {
  const { user } = useAuthStore();
  const { fetchConversations } = useChatStore();
  const [loading, setLoading] = useState(false);

  const currentMember = conversation.members?.find(
    (m) => (m.userId?._id || m.userId) === user?._id
  );
  const isAdmin = currentMember?.role === 'admin';

  const handleRemoveMember = async (memberId) => {
    setLoading(true);
    try {
      await api.delete(`/chat/conversations/${conversation._id}/members/${memberId}`);
      toast.success('Member removed');
      fetchConversations();
    } catch {
      toast.error('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async (memberId) => {
    setLoading(true);
    try {
      await api.patch(`/chat/conversations/${conversation._id}/promote/${memberId}`);
      toast.success('Member promoted to admin');
      fetchConversations();
    } catch {
      toast.error('Failed to promote member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Group Info</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Group identity */}
        <div className={styles.section} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span className="avatar-placeholder" style={{ width: 64, height: 64, fontSize: 28 }}>👥</span>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>{conversation.name}</p>
            {conversation.description && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{conversation.description}</p>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              {conversation.members?.length} members · Created {new Date(conversation.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Members list */}
        <div className={styles.section}>
          <h4>Members</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {conversation.members?.map((member) => {
              const memberUser = member.userId;
              const memberId = memberUser?._id || memberUser;
              const memberName = memberUser?.name || 'Unknown';
              const isMe = memberId === user?._id;

              return (
                <div
                  key={memberId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span className="avatar-placeholder" style={{ width: 34, height: 34, fontSize: 13 }}>
                    {memberName?.[0]?.toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {memberName} {isMe && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
                    </p>
                    <p style={{ fontSize: 11, color: member.role === 'admin' ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {member.role === 'admin' ? '⭐ Admin' : 'Member'}
                    </p>
                  </div>
                  {isAdmin && !isMe && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {member.role !== 'admin' && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => handlePromote(memberId)}
                          disabled={loading}
                        >
                          Make admin
                        </button>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)' }}
                        onClick={() => handleRemoveMember(memberId)}
                        disabled={loading}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.footer}>
          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', color: 'var(--danger)' }}
            onClick={onClose}
          >
            Leave Group
          </button>
        </div>
      </div>
    </div>
  );
}
