import React, { useState, useEffect } from "react";
import { Eye, EyeOff, Lock, ArrowRight, RefreshCw } from "lucide-react";
import { supabase, getSession } from "../supabaseClient";
import { loadMyProfile } from "../supabase/profile";
import type { UserProfile } from "../supabase/profile";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY } from "../theme/tokens";

type OnboardingState = "loading" | "invited" | "active" | "no_session" | "error";

export default function CompleteOnboardingPage() {
  const [state, setState] = useState<OnboardingState>("loading");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const session = await getSession();
        if (!session) {
          if (!cancelled) setState("no_session");
          return;
        }
        const p = await loadMyProfile();
        if (!p) {
          if (!cancelled) setState("error");
          return;
        }
        if (p.onboardingStatus === "invited") {
          if (!cancelled) {
            setProfile(p);
            setState("invited");
          }
        } else {
          if (!cancelled) setState("active");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!profile) return;
    setSaving(true);
    try {
      const session = await getSession();
      if (!session?.access_token) {
        setError("Session expired. Please request a new invitation.");
        setSaving(false);
        return;
      }
      const { error: fnError } = await supabase.functions.invoke('complete-onboarding', {
        body: { employeeId: profile.employeeId, password },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnError) {
        let message = fnError.message || "Failed to complete onboarding.";
        try {
          const body = await fnError.context?.json?.();
          if (body?.error) message = body.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function requestNewInvite() {
    window.location.href = "/";
  }

  const isDark = typeof window !== 'undefined' && window.localStorage.getItem('modulo_theme') === 'dark';
  const bg = isDark ? '#0F172A' : '#F7F4EE';
  const cardBg = isDark ? '#1E293B' : '#FFFFFF';
  const textPrimary = isDark ? '#F1F5F9' : '#111827';
  const textSecondary = isDark ? '#94A3B8' : '#6B7280';
  const textMuted = isDark ? '#64748B' : '#9CA3AF';
  const borderColor = isDark ? '#334155' : '#E5E7EB';
  const inputBg = isDark ? '#1F2937' : '#FFFFFF';
  const inputBorder = isDark ? '#374151' : '#D1D5DB';

  if (state === "loading") {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: FONT_BODY }}>
        <div style={{ textAlign: 'center', color: MUTED }}>
          <div style={{ width: 32, height: 32, border: '3px solid ' + RULE, borderTopColor: GREEN, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', marginBottom: 12 }} />
          <div>Verifying your invitation...</div>
        </div>
      </div>
    );
  }

  if (state === "no_session") {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: FONT_BODY, padding: 20 }}>
        <div style={{ background: cardBg, borderRadius: 16, padding: '36px 28px', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', border: `1px solid ${borderColor}`, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(166,61,64,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={22} color={ALERT} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: textPrimary, marginBottom: 8 }}>Invitation expired or invalid</h2>
          <p style={{ color: textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            This invitation link is no longer valid. It may have expired or already been used. Please request a new invitation from your administrator.
          </p>
          <button onClick={requestNewInvite} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--green), var(--green-deep))', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(47,82,51,0.3)' }}>
            Return to login
          </button>
        </div>
      </div>
    );
  }

  if (state === "active") {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: FONT_BODY, padding: 20 }}>
        <div style={{ background: cardBg, borderRadius: 16, padding: '36px 28px', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', border: `1px solid ${borderColor}`, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(47,82,51,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ArrowRight size={22} color={GREEN} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: textPrimary, marginBottom: 8 }}>Account already set up</h2>
          <p style={{ color: textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Your account has already been activated. You will be redirected to the dashboard.
          </p>
          <button onClick={requestNewInvite} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--green), var(--green-deep))', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(47,82,51,0.3)' }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, fontFamily: FONT_BODY, padding: 20 }}>
        <div style={{ background: cardBg, borderRadius: 16, padding: '36px 28px', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', border: `1px solid ${borderColor}`, maxWidth: 420, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(166,61,64,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={22} color={ALERT} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: textPrimary, marginBottom: 8 }}>Unable to verify invitation</h2>
          <p style={{ color: textSecondary, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            We couldn't verify your invitation. Please request a new one from your administrator.
          </p>
          <button onClick={requestNewInvite} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, var(--green), var(--green-deep))', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(47,82,51,0.3)' }}>
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: bg, fontFamily: FONT_BODY }}>
      {/* Left brand panel */}
      <div style={{
        flex: '0 0 46%',
        background: 'linear-gradient(160deg, #1E3A21 0%, #0f2416 50%, #0a1a0f 100%)',
        color: '#fff',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '3rem 3.5rem',
        position: 'relative', overflow: 'hidden',
      }} className="onboard-brand">
        <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -60, width: 360, height: 360, borderRadius: '50%', background: 'rgba(201,168,76,0.04)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '60%', width: 120, height: 120, borderRadius: '50%', background: 'rgba(76,175,80,0.05)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #C9A84C, #A8761A)', marginBottom: 32, boxShadow: '0 8px 24px rgba(201,168,76,0.3)' }}>
            <Lock size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: -0.5, marginBottom: 8, lineHeight: 1.1 }}>
            MODULO<br /><span style={{ color: '#C9A84C' }}>LEDGER</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1rem', lineHeight: 1.7, maxWidth: 380, marginBottom: 44 }}>
            Secure financial management for modern construction firms. Track projects, invoices, payroll &mdash; all in one place.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { icon: Lock, text: 'Set up your secure account', sub: 'Create your password to continue' },
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
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 2rem' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <div style={{ display: 'none', marginBottom: 32, textAlign: 'center' }} className="onboard-mobile-logo">
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #C9A84C, #A8761A)', marginBottom: 14, boxShadow: '0 6px 20px rgba(201,168,76,0.25)' }}>
              <Lock size={26} color="#fff" strokeWidth={2} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1E3A21', letterSpacing: -0.3 }}>MODULO <span style={{ color: '#C9A84C' }}>LEDGER</span></h1>
          </div>

          <div style={{ background: cardBg, borderRadius: 16, padding: '32px 28px', boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.3)' : '0 4px 24px rgba(0,0,0,0.06)', border: `1px solid ${borderColor}` }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: textPrimary, marginBottom: 4 }}>
              Create your password
            </h2>
            <p style={{ color: textSecondary, fontSize: '0.9rem', marginBottom: 24, lineHeight: 1.5 }}>
              Welcome, {profile?.employeeName || 'Employee'}. Set a password to activate your account.
            </p>

            {error && (
              <div style={{ background: isDark ? '#451a1a' : '#FEF2F2', color: isDark ? '#FCA5A5' : '#991B1B', padding: '0.7rem 1rem', borderRadius: 10, marginBottom: 20, fontSize: '0.85rem', border: `1px solid ${isDark ? '#7F1D1D' : '#FECACA'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>&#9888;</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    style={{ ...inputCls(isDark), paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
                  {password.length > 0 && password.length < 8 ? (
                    <span style={{ color: '#A63D40' }}>Password must be at least 8 characters.</span>
                  ) : password.length >= 8 ? (
                    <span style={{ color: '#2F5233' }}>Password strength: Good</span>
                  ) : null}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confirm password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    style={{ ...inputCls(isDark), paddingRight: 48 }}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: 4, display: 'flex', alignItems: 'center', borderRadius: 6 }}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={saving} style={{ padding: '0.8rem', borderRadius: 10, border: 'none', background: saving ? '#93A3B8' : 'linear-gradient(135deg, #2F5233, #1E3A21)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.25s ease', boxShadow: saving ? 'none' : '0 4px 16px rgba(47,82,51,0.35)', height: 48 }}>
                {saving ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }} />
                    Setting up...
                  </span>
                ) : (
                  <>
                    Activate account
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p style={{ marginTop: 24, fontSize: '0.875rem', color: textSecondary, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Lock size={12} /> Secured by Supabase Auth
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .onboard-brand { display: none !important; }
          .onboard-mobile-logo { display: block !important; }
        }
      `}</style>
    </div>
  );
}

const inputCls = (isDark: boolean) => ({
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: 10,
  border: `1.5px solid ${inputBorder}`,
  fontSize: 15,
  fontFamily: FONT_BODY,
  transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
  boxSizing: 'border-box' as const,
  background: inputBg,
  color: isDark ? '#F9FAFB' : '#111827',
});
