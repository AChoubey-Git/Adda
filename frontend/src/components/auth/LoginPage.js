import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import styles from './Auth.module.css';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>💬</div>
          <div>
            <h1 className={styles.logoName}>Adda</h1>
            <p className={styles.logoTagline}>আড্ডা</p>
          </div>
        </div>

        <h2 className={styles.title}>Welcome back</h2>
        <p className={styles.subtitle}>Sign in to continue your adda</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <p className={styles.footer}>
          New to Adda? <Link to="/register">Create account</Link>
        </p>
      </div>

      {/* Decorative background */}
      <div className={styles.bgDecor} />
    </div>
  );
}
