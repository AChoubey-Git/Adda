import React, { useState, useEffect } from 'react';
import { getSocket } from '../../services/socket';

export default function ConnectionBanner() {
  const [status, setStatus] = useState('connected'); // connected | reconnecting | disconnected

  useEffect(() => {
    let timer;

    const check = () => {
      const socket = getSocket();
      if (!socket) { setStatus('disconnected'); return; }

      socket.on('connect',        () => setStatus('connected'));
      socket.on('disconnect',     () => { setStatus('reconnecting'); });
      socket.on('reconnect',      () => setStatus('connected'));
      socket.on('reconnect_attempt', () => setStatus('reconnecting'));
      socket.on('reconnect_failed',  () => setStatus('disconnected'));

      setStatus(socket.connected ? 'connected' : 'reconnecting');
    };

    // Wait briefly for socket to initialise
    timer = setTimeout(check, 500);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'connected') return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      zIndex: 9999,
      background: status === 'reconnecting' ? '#f59e0b' : '#ef4444',
      color: 'white',
      textAlign: 'center',
      fontSize: 13,
      fontWeight: 600,
      padding: '6px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }}>
      {status === 'reconnecting' ? (
        <>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>↻</span>
          Reconnecting to Adda…
        </>
      ) : (
        <>⚠️ No connection — messages will be queued</>
      )}
    </div>
  );
}
