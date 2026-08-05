import { useState, FormEvent } from 'react';
import { signIn, signUp } from './supabaseClient';

type AuthMode = 'login' | 'signup';

export default function Login(): JSX.Element {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Brand panel */}
      <div
        style={{
          flex: 1,
          background: '#1F3864',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>MODULO LEDGER</h1>
        <p style={{ color: '#C9A84C', fontSize: '1rem' }}>
          Secure financial management, built for modern teams.
        </p>
      </div>

      {/* Form panel */}
      <div
        style={{
          flex: 1,
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem',
        }}
      >
        <h2 style={{ marginBottom: '0.5rem' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          {mode === 'login'
            ? 'Enter your credentials to access your dashboard'
            : 'Fill in the details to get started'}
        </p>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              width: '100%',
              maxWidth: '360px',
              fontSize: '0.875rem',
            }}
          >
            {error.startsWith('Account') ? (
              <span style={{ fontWeight: 600 }}>Account issue — </span>
            ) : null}
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </label>

          {mode === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>
              Confirm password
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc' }}
              />
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              border: 'none',
              background: '#1F3864',
              color: '#fff',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#666' }}>
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#1F3864',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
