import React from 'react';
import useAuthStore from '../../store/authStore';
import styles from './WelcomeScreen.module.css';

export default function WelcomeScreen() {
  const { user } = useAuthStore();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.iconWrap}>
          <div className={styles.iconBubble}>💬</div>
        </div>

        <h1 className={styles.title}>
          Welcome, <span className={styles.name}>{user?.name?.split(' ')[0] || 'there'}</span>!
        </h1>
        <p className={styles.bengali}>আড্ডায় স্বাগতম</p>
        <p className={styles.subtitle}>
          Select a conversation to start your adda, or create a new one.
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>🔒</span>
            <div>
              <p className={styles.featureName}>End-to-end encrypted</p>
              <p className={styles.featureDesc}>Your adda stays private</p>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>⚡</span>
            <div>
              <p className={styles.featureName}>Real-time messaging</p>
              <p className={styles.featureDesc}>Instant via WebSockets</p>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>👥</span>
            <div>
              <p className={styles.featureName}>Group adda</p>
              <p className={styles.featureDesc}>Chat with the whole crew</p>
            </div>
          </div>
          <div className={styles.feature}>
            <span className={styles.featureIcon}>📎</span>
            <div>
              <p className={styles.featureName}>Share anything</p>
              <p className={styles.featureDesc}>Photos, videos, documents</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
