import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { authenticate, clearAuthError } from '../store/authSlice';

export default function AuthPage() {
  const dispatch = useDispatch();
  const { token, status, error } = useSelector((s) => s.auth);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  if (token) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const { username, email, password } = form;
    dispatch(authenticate(mode === 'login' ? { mode, email, password } : { mode, username, email, password }));
  };
  const switchMode = () => {
    dispatch(clearAuthError());
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <main className="auth">
      <form className="panel auth-panel" onSubmit={submit}>
        <h1 className="wordmark">BoardCollab</h1>
        <h2 className="panel-title">{mode === 'login' ? 'Sign in' : 'Create an account'}</h2>
        {mode === 'register' && (
          <label className="field">
            <span>Name</span>
            <input value={form.username} onChange={set('username')} autoComplete="name" required minLength={2} maxLength={32} />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={form.password} onChange={set('password')} required minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          {mode === 'register' && <small>At least 8 characters.</small>}
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn--primary" disabled={status === 'loading'}>
          {status === 'loading' ? 'Please wait' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <button type="button" className="link-btn" onClick={switchMode}>
          {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
        </button>
      </form>
    </main>
  );
}
