import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/global.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--bg-tertiary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
      }}
    />
  </BrowserRouter>
);
