import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import {
  hasLocalKeyPair,
  loadMyPublicKey,
  loadMyPrivateKey,
} from '../../services/encryption';
import { initE2E } from '../../services/e2eManager';
import styles from './Modal.module.css';

export default function UserSettingsModal({ onClose }) {
  const { user, updateUser, e2eReady, e2eEnabled, toggleE2E } = useAuthStore();
  const [form,    setForm]    = useState({ name: user?.name || '', bio: user?.bio || '' });
  const [theme,   setTheme]   = useState(localStorage.getItem('theme') || 'dark');
  const [saving,  setSaving]  = useState(false);
  const [e2eInfo, setE2eInfo] = useState(null);
  const [regenerating, setRegenerating] = useState(false);

  const userId = user?._id?.toString() || user?.id?.toString();

  // Load E2E key info
  useEffect(() => {
    if (!userId) return;
    const hasPair   = hasLocalKeyPair(userId);
    const publicKey = loadMyPublicKey(userId);
    setE2eInfo({
      hasPair,
      publicKeyPreview: publicKey
        ? publicKey.slice(0, 32) + '…' + publicKey.slice(-8)
        : null,
      serverHasKey: !!user?.publicKey,
    });
  }, [userId, user?.publicKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/users/profile', form);
      updateUser(data);
      toast.success('Profile updated 🎉');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Re-generate E2E key pair
  const handleRegenerateKeys = async () => {
    if (!window.confirm(
      'This will generate a new encryption key pair.\n\n' +
      'You will NOT be able to decrypt old messages after this.\n\n' +
      'Continue?'
    )) return;

    setRegenerating(true);
    try {
      // Remove old keys
      localStorage.removeItem(`adda_e2e_priv_${userId}`);
      localStorage.removeItem(`adda_e2e_pub_${userId}`);

      // Generate fresh pair and upload
      const ok = await initE2E(userId);
      if (ok) {
        useAuthStore.setState({ e2eReady: true });
        const publicKey = loadMyPublicKey(userId);
        setE2eInfo({
          hasPair:          true,
          publicKeyPreview: publicKey ? publicKey.slice(0, 32) + '…' + publicKey.slice(-8) : null,
          serverHasKey:     true,
        });
        toast.success('New encryption keys generated');
      } else {
        toast.error('Key generation failed');
      }
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Settings</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── Profile ─────────────────────────────────────────── */}
          <div className={styles.section}>
            <h4>Profile</h4>
            <div className={styles.avatarUpload}>
              <span className="avatar-placeholder" style={{ width: 56, height: 56, fontSize: 22 }}>
                {user?.name?.[0]?.toUpperCase()}
              </span>
              <button className="btn btn-ghost" style={{ fontSize: 13 }}>Change photo</button>
            </div>
            <div className={styles.field}>
              <label>Display name</label>
              <input className="input" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
            <div className={styles.field}>
              <label>Bio</label>
              <input className="input" value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="About you" />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input className="input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
            </div>
          </div>

          {/* ── Appearance ──────────────────────────────────────── */}
          <div className={styles.section}>
            <h4>Appearance</h4>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Dark mode</span>
              <button
                className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : styles.toggleOff}`}
                onClick={toggleTheme}
              />
            </div>
          </div>

          {/* ── E2E Encryption ──────────────────────────────────── */}
          <div className={styles.section}>
            <h4>End-to-End Encryption</h4>

            {/* Master toggle */}
            <div className={styles.toggleRow} style={{ marginBottom: 14 }}>
              <div>
                <span className={styles.toggleLabel}>Enable E2E Encryption</span>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {e2eEnabled
                    ? 'Messages are encrypted before leaving your device.'
                    : 'Messages are sent as plain text — the server can read them.'}
                </p>
              </div>
              <button
                className={`${styles.toggle} ${e2eEnabled ? styles.toggleOn : styles.toggleOff}`}
                onClick={toggleE2E}
                title={e2eEnabled ? 'Disable encryption' : 'Enable encryption'}
              />
            </div>

            {/* Warning banner when disabled */}
            {!e2eEnabled && (
              <div style={{
                background:   'rgba(239,68,68,0.08)',
                border:       '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--radius-md)',
                padding:      '10px 14px',
                marginBottom: 14,
                display:      'flex',
                alignItems:   'flex-start',
                gap:          '8px',
              }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <p style={{ fontSize: 12, color: '#ef4444', lineHeight: 1.5 }}>
                  <strong>Encryption is OFF.</strong> Your new messages will be sent as plain text
                  and can be read by the server. Existing encrypted messages may not be readable
                  until you re-enable encryption.
                </p>
              </div>
            )}

            {/* Status card — only shown when E2E is enabled */}
            {e2eEnabled && (
              <div style={{
                background:    e2eReady ? 'rgba(34,197,94,0.08)' : 'rgba(249,115,22,0.08)',
                border:        `1px solid ${e2eReady ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)'}`,
                borderRadius:  'var(--radius-md)',
                padding:       '12px 14px',
                marginBottom:  '14px',
                display:       'flex',
                alignItems:    'flex-start',
                gap:           '10px',
              }}>
                <span style={{ fontSize: 20 }}>{e2eReady ? '🔒' : '🔓'}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: e2eReady ? '#22c55e' : 'var(--text-secondary)', marginBottom: 4 }}>
                    {e2eReady ? 'Encryption Active' : 'Encryption Not Ready'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {e2eReady
                      ? 'Your messages are secured with ECDH P-256 + AES-GCM 256-bit encryption. The server cannot read your messages.'
                      : 'Your encryption keys are not set up on this device. Log out and back in to generate them.'
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Key details — only shown when E2E is enabled */}
            {e2eEnabled && e2eInfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Local key pair</span>
                  <span style={{ color: e2eInfo.hasPair ? '#22c55e' : 'var(--danger)', fontWeight: 600 }}>
                    {e2eInfo.hasPair ? '✓ Present' : '✗ Missing'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Public key on server</span>
                  <span style={{ color: e2eInfo.serverHasKey ? '#22c55e' : 'var(--danger)', fontWeight: 600 }}>
                    {e2eInfo.serverHasKey ? '✓ Uploaded' : '✗ Not uploaded'}
                  </span>
                </div>
                {e2eInfo.publicKeyPreview && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace',
                    background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                    wordBreak: 'break-all' }}>
                    {e2eInfo.publicKeyPreview}
                  </div>
                )}
              </div>
            )}

            {/* How it works */}
            {e2eEnabled && (
              <details style={{ marginBottom: 14 }}>
                <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500 }}>
                  How does it work?
                </summary>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 8, paddingLeft: 4 }}>
                  <p>1. On login, Adda generates an <strong>ECDH P-256 key pair</strong> in your browser.</p>
                  <p>2. Your <strong>private key</strong> stays on your device only — never sent to the server.</p>
                  <p>3. Your <strong>public key</strong> is uploaded so others can encrypt messages for you.</p>
                  <p>4. When you message someone, a <strong>shared secret</strong> is derived using their public key + your private key.</p>
                  <p>5. Every message is encrypted with <strong>AES-GCM 256-bit</strong> using that shared secret.</p>
                  <p>6. The server stores only <strong>ciphertext</strong> — it cannot read your messages.</p>
                </div>
              </details>
            )}

            {/* Regenerate keys — only when E2E is enabled */}
            {e2eEnabled && (
              <button
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13, color: 'var(--warning)' }}
                onClick={handleRegenerateKeys}
                disabled={regenerating}
              >
                {regenerating ? '⏳ Generating…' : '🔄 Regenerate encryption keys'}
              </button>
            )}
          </div>

          {/* ── Notifications ───────────────────────────────────── */}
          <div className={styles.section}>
            <h4>Notifications</h4>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Desktop notifications</span>
              <button className={`${styles.toggle} ${styles.toggleOn}`}
                onClick={() => { if (Notification.permission !== 'granted') Notification.requestPermission(); }}
              />
            </div>
            <div className={styles.toggleRow}>
              <span className={styles.toggleLabel}>Sound alerts</span>
              <button className={`${styles.toggle} ${styles.toggleOn}`} />
            </div>
          </div>

        </div>

        <div className={styles.footer}>
          <button className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
