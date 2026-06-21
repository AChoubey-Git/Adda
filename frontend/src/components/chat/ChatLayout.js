import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ConversationView from './ConversationView';
import WelcomeScreen from './WelcomeScreen';
import useChatStore from '../../store/chatStore';
import styles from './ChatLayout.module.css';

export default function ChatLayout() {
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // showSidebar: true = sidebar visible, false = chat visible (mobile only)
  const [showSidebar, setShowSidebar] = useState(true);

  // Track viewport width
  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true); // always show sidebar on desktop
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // On mobile: selecting a conversation slides to chat view
  const handleConversationSelect = (convId) => {
    setActiveConversation(convId);
    if (isMobile) setShowSidebar(false);
  };

  // Back button: slide back to sidebar
  const handleBack = () => setShowSidebar(true);

  // Compute class names for sidebar and main panels
  const sidebarClass = isMobile
    ? `${styles.sidebarPanel} ${showSidebar ? styles.sidebarVisible : styles.sidebarHidden}`
    : styles.sidebarPanel;

  const mainClass = isMobile
    ? `${styles.main} ${showSidebar ? styles.mainHidden : styles.mainVisible}`
    : styles.main;

  return (
    <div className={styles.layout}>
      {window.electron && (
        <div className={`${styles.titlebar} titlebar`}>
          <span className={styles.appName}>Adda • আড্ডা</span>
          <div className={styles.windowControls}>
            <button onClick={() => window.electron.minimize()}>─</button>
            <button onClick={() => window.electron.maximize()}>□</button>
            <button onClick={() => window.electron.close()} className={styles.closeBtn}>✕</button>
          </div>
        </div>
      )}
      <div className={styles.body}>
        {/* Sidebar panel */}
        <div className={sidebarClass}>
          <Sidebar onConversationSelect={handleConversationSelect} />
        </div>

        {/* Chat / main panel */}
        <main className={mainClass}>
          {activeConversationId
            ? <ConversationView
                key={activeConversationId}
                conversationId={activeConversationId}
                onBack={isMobile ? handleBack : null}
              />
            : <WelcomeScreen />}
        </main>
      </div>
    </div>
  );
}
