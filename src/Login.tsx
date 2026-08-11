import { useState, FormEvent } from 'react';
import { signIn, signUp } from './supabaseClient';
import { Eye, EyeOff, ArrowRight, Lock, Zap, Globe, CheckCircle2, BarChart3 } from 'lucide-react';

type AuthMode = 'login' | 'signup';

const inputCls = (err: boolean, isDark: boolean) => ({
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  border: `1.5px solid ${err ? '#ef4444' : isDark ? '#374151' : '#d1d5db'}`,
  fontSize: 15,
  fontFamily: "'Inter', system-ui, sans-serif",
  transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
  boxSizing: 'border-box' as const,
  background: isDark ? '#1F2937' : '#fff',
  color: isDark ? '#F9FAFB' : '#111827',
});

export default function Login(): JSX.Element {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('modulo_theme') === 'dark'; } catch { return false; }
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('modulo_login_flow', '1');
          window.localStorage.removeItem('modulo_tab');
        } catch {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  const isErr = !!error;
  const bg = isDark ? '#0F172A' : '#F7F4EE';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const textMuted = isDark ? '#64748B' : '#9CA3AF';
  const borderColor = isDark ? '#334155' : '#E5E7EB';
  const focusBorder = '#2F5233';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: bg, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Left brand panel */}
      <div style={{
        flex: '0 0 46%',
        background: 'linear-gradient(160deg, #1E3A21 0%, #0f2416 50%, #0a1a0f 100%)',
        color: '#fff',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '3rem 3.5rem',
        position: 'relative', overflow: 'hidden',
      }} className="login-brand">
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 360, height: 360, borderRadius: '50%', background: 'rgba(201,168,76,0.04)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '60%', width: 120, height: 120, borderRadius: '50%', background: 'rgba(76,175,80,0.05)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #C9A84C, #A8761A)', marginBottom: 32, boxShadow: '0 8px 24px rgba(201,168,76,0.3)' }}>
            <BarChart3 size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: -0.5, marginBottom: 8, lineHeight: 1.1 }}>
            MODULO<br /><span style={{ color: '#C9A84C' }}>LEDGER</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', lineHeight: 1.7, maxWidth: 380, marginBottom: 44 }}>
            Secure financial management for modern construction firms. Track projects, invoices, payroll &mdash; all in one place.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Lock, text: 'End-to-end encrypted with Supabase Auth', sub: 'Zero-knowledge architecture' },
              { icon: Zap, text: 'Real-time financial dashboards', sub: 'Live KPIs & cash flow' },
              { icon: Globe, text: 'Multi-user role-based access', sub: 'CEO, PM, Accounts & more' },
            ].map(({ icon: Icon, text, sub }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Icon size={18} color="#C9A84C" strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: 500, marginBottom: 2 }}>{text}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 44, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {['GRA Compliant', 'IFRS Aligned', 'GHS Native'].map(label => (
              <div key={label} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={12} color="rgba(201,168,76,0.5)" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <div style={{ display: 'none', marginBottom: 32, textAlign: 'center' }} className="login-mobile-logo">
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #C9A84C, #A8761A)', marginBottom: 14, boxShadow: '0 6px 20px rgba(201,168,76,0.25)' }}>
              <BarChart3 size={26} color="#fff" strokeWidth={2} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E3A21', letterSpacing: -0.3 }}>MODULO <span style={{ color: '#C9A84C' }}>LEDGER</span></h1>
          </div>

          <div style={{ background: cardBg, borderRadius: 16, padding: '32px 28px', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', border: `1px solid ${borderColor}` }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: textPrimary, marginBottom: 4 }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p style={{ color: textSecondary, fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
              {mode === 'login' ? 'Enter your credentials to access your ledger' : 'Get started with Modulo Ledger in seconds'}
            </p>

            {error && (
              <div style={{ background: isDark ? '#451a1a' : '#FEF2F2', color: isDark ? '#FCA5A5' : '#991B1B', padding: '0.7rem 1rem', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem', border: `1px solid ${isDark ? '#7F1D1D' : '#FECACA'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>&#9888;</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" style={inputCls(isErr, isDark)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" style={{ ...inputCls(isErr, isDark), paddingRight: 48 }} />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6, transition: 'color 0.15s' }}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: textSecondary, cursor: 'pointer' }}>
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accent: '#2F5233' }} />
                    Remember me
                  </label>
                  <button type="button" style={{ background: 'none', border: 'none', color: '#2F5233', fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confirm password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConfirmPw ? 'text' : 'password'} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;" style={{ ...inputCls(isErr, isDark), paddingRight: 48 }} />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                      {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} style={{ padding: '0.8rem', borderRadius: 10, border: 'none', background: loading ? '#93A3B8' : 'linear-gradient(135deg, #2F5233, #1E3A21)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.25s ease', boxShadow: loading ? 'none' : '0 4px 16px rgba(47,82,51,0.35)', height: 48 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </span>
                ) : (
                  <>
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p style={{ marginTop: 28, fontSize: '0.875rem', color: textSecondary, textAlign: 'center' }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }} style={{ background: 'none', border: 'none', color: '#2F5233', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', fontSize: '0.875rem' }}>
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
          <p style={{ marginTop: 12, fontSize: '0.75rem', color: textMuted, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Lock size={11} /> Secured by Supabase Auth
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .login-brand { display: none !important; }
          .login-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}
