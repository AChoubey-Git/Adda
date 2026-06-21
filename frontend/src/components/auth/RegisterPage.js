import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import styles from './Auth.module.css';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    try {
      await register(form.name, form.email, form.password);
      toast.success('Welcome to Adda! আড্ডায় স্বাগতম 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>💬</div>
          <div>
            <h1 className={styles.logoName}>Adda</h1>
            <p className={styles.logoTagline}>আড্ডা</p>
          </div>
        </div>

        <h2 className={styles.title}>Join Adda</h2>
        <p className={styles.subtitle}>Start your conversations today</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Full Name</label>
            <input className="input" placeholder="Your name" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Password</label>
            <input className="input" type="password" placeholder="Min. 8 characters" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Confirm Password</label>
            <input className="input" type="password" placeholder="Confirm your password" value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px' }}
            disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Create account →'}
          </button>
        </form>

        <p className={styles.footer}>
          Already on Adda? <Link to="/login">Sign in</Link>
        </p>
      </div>
      <div className={styles.bgDecor} />
    </div>
  );
}
