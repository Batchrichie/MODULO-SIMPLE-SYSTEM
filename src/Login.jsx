import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const LOGO_SRC =
  "https://z-cdn-media.chatglm.cn/files/c4df6667-2cb5-44bd-9e8c-084ed2a10aef.png?auth_key=1885240175-d071a696811b4023895eec2f8f72bcdc-0-f1149165f857bcfa6db14fa029bb57fd";

/* ───────────────────────────────────────────────
   Modern responsive login — single-file component
   Desktop : split layout (brand panel + form panel)
   Mobile  : stacked (brand strip + form)
   ─────────────────────────────────────────────── */

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("login");

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError(
          "Account created! Check your email to confirm your account, then sign in."
        );
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="login-root">
        {/* ──── Left / Top brand panel ──── */}
        <div className="brand-panel">
          <div className="brand-inner">
            <img src={LOGO_SRC} alt="Modulo Development Logo" className="brand-logo" />
            <h1 className="brand-title">MODULO LEDGER</h1>
            <p className="brand-tagline">
              Secure financial management,<br />
              built for modern teams.
            </p>
            <div className="brand-decoration">
              <span /><span /><span />
            </div>
          </div>
        </div>

        {/* ──── Right / Bottom form panel ──── */}
        <div className="form-panel">
          <div className="form-wrapper">
            {/* Mobile-only logo (hidden on desktop) */}
            <img
              src={LOGO_SRC}
              alt="Modulo"
              className="mobile-logo"
            />

            <div className="form-header">
              <h2 className="form-heading">
                {mode === "login" ? "Welcome back" : "Create account"}
              </h2>
              <p className="form-subheading">
                {mode === "login"
                  ? "Enter your credentials to access your dashboard"
                  : "Fill in the details to get started"}
              </p>
            </div>

            {error && (
              <div className={`alert ${error.startsWith("Account") ? "alert--success" : "alert--error"}`}>
                <svg className="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                  {error.startsWith("Account") ? (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="form">
              <div className="field">
                <label className="field-label" htmlFor="email">
                  Email address
                </label>
                <div className="field-input-wrap">
                  <svg className="field-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 4a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2.5 0a.5.5 0 00-.39.812l4.39 5.487a.5.5 0 00.78 0l4.39-5.487A.5.5 0 0014.5 4h-9z" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@modulodev.com"
                    className="field-input"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="password">
                  Password
                </label>
                <div className="field-input-wrap">
                  <svg className="field-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input"
                  />
                </div>
              </div>

              {mode === "login" && (
                <div className="forgot-row">
                  <a href="#" className="forgot-link">
                    Forgot password?
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-btn"
              >
                {loading ? (
                  <span className="spinner" />
                ) : null}
                {loading
                  ? "Please wait…"
                  : mode === "login"
                  ? "Sign in"
                  : "Create account"}
              </button>
            </form>

            <div className="switch-row">
              <span className="switch-text">
                {mode === "login"
                  ? "Don't have an account?"
                  : "Already have an account?"}
              </span>
              <button
                className="switch-btn"
                onClick={() => {
                  setMode(mode === "login" ? "signup" : "login");
                  setError(null);
                }}
              >
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   CSS — embedded so the file stays portable
   ═══════════════════════════════════════════ */
const css = `
/* ── Reset & base ─────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --brand:       #1B3A20;
  --brand-light: #2F5233;
  --gold:        #C9A84C;
  --gold-light:  #E2CC8A;
  --bg:          #F5F3EF;
  --card:        #FFFFFF;
  --text:        #1A1A1A;
  --text-muted:  #7A7A72;
  --border:      #E8E4DC;
  --input-bg:    #FAFAF8;
  --error:       #B91C1C;
  --error-bg:    #FEF2F2;
  --success:     #166534;
  --success-bg:  #F0FDF4;
  --radius:      12px;
  --radius-sm:   8px;
  --shadow-sm:   0 1px 2px rgba(0,0,0,.05);
  --shadow-md:   0 4px 24px rgba(0,0,0,.08);
  --shadow-lg:   0 12px 48px rgba(0,0,0,.12);
  --transition:  .2s cubic-bezier(.4,0,.2,1);
}

/* ── Root layout ──────────────────────── */
.login-root {
  display: flex;
  min-height: 100vh;
  min-height: 100dvh;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
}

/* ── Brand panel ──────────────────────── */
.brand-panel {
  display: none;                       /* hidden on mobile */
  flex: 1 1 45%;
  background: linear-gradient(160deg, var(--brand) 0%, #0F1F13 100%);
  position: relative;
  overflow: hidden;
}

.brand-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 60% 50% at 20% 80%, rgba(201,168,76,.12) 0%, transparent 70%),
    radial-gradient(ellipse 40% 40% at 80% 20%, rgba(47,82,51,.20) 0%, transparent 70%);
}

.brand-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 48px;
  text-align: center;
}

.brand-logo {
  height: 72px;
  width: auto;
  filter: brightness(0) invert(1);
  margin-bottom: 24px;
}

.brand-title {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: #fff;
  margin-bottom: 12px;
}

.brand-tagline {
  font-size: 16px;
  line-height: 1.6;
  color: rgba(255,255,255,.65);
  max-width: 300px;
}

.brand-decoration {
  display: flex;
  gap: 8px;
  margin-top: 40px;
}

.brand-decoration span {
  width: 32px;
  height: 4px;
  border-radius: 2px;
  background: var(--gold);
  opacity: .5;
}

.brand-decoration span:nth-child(2) {
  width: 48px;
  opacity: 1;
}

/* ── Form panel ───────────────────────── */
.form-panel {
  flex: 1 1 55%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}

.form-wrapper {
  width: 100%;
  max-width: 420px;
}

/* ── Mobile-only logo ─────────────────── */
.mobile-logo {
  display: block;                     /* visible on mobile */
  height: 48px;
  width: auto;
  margin: 0 auto 32px;
}

/* ── Form header ──────────────────────── */
.form-header { margin-bottom: 32px; }

.form-heading {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text);
  margin-bottom: 6px;
}

.form-subheading {
  font-size: 15px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ── Alert ────────────────────────────── */
.alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.45;
  margin-bottom: 24px;
  animation: slideDown .25s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.alert--error {
  background: var(--error-bg);
  color: var(--error);
  border: 1px solid #FECACA;
}

.alert--success {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid #BBF7D0;
}

.alert-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* ── Form fields ──────────────────────── */
.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field { display: flex; flex-direction: column; gap: 6px; }

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.field-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field-icon {
  position: absolute;
  left: 14px;
  width: 18px;
  height: 18px;
  color: var(--text-muted);
  pointer-events: none;
  transition: color var(--transition);
}

.field-input {
  width: 100%;
  padding: 14px 16px 14px 44px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
  font-size: 15px;
  font-family: inherit;
  color: var(--text);
  outline: none;
  transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
}

.field-input::placeholder { color: #B5B3AD; }

.field-input:hover { border-color: #CCC8BF; }

.field-input:focus {
  border-color: var(--brand-light);
  background: #fff;
  box-shadow: 0 0 0 3px rgba(47,82,51,.10);
}

.field-input:focus ~ .field-icon,            /* doesn't work — icon is before input */
.field-input-wrap:focus-within .field-icon {
  color: var(--brand-light);
}

/* ── Forgot password ──────────────────── */
.forgot-row {
  display: flex;
  justify-content: flex-end;
  margin-top: -8px;
}

.forgot-link {
  font-size: 13px;
  font-weight: 600;
  color: var(--brand-light);
  text-decoration: none;
  transition: color var(--transition);
}

.forgot-link:hover { color: var(--gold); }

/* ── Submit button ────────────────────── */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 15px 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, var(--brand) 0%, var(--brand-light) 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: transform var(--transition), box-shadow var(--transition), opacity var(--transition);
  margin-top: 4px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(27,58,32,.30);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: .65;
  cursor: not-allowed;
}

/* ── Loading spinner ──────────────────── */
.spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Switch row ───────────────────────── */
.switch-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 28px;
}

.switch-text {
  font-size: 14px;
  color: var(--text-muted);
}

.switch-btn {
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 700;
  font-family: inherit;
  color: var(--brand-light);
  cursor: pointer;
  padding: 4px 2px;
  border-bottom: 2px solid transparent;
  transition: color var(--transition), border-color var(--transition);
}

.switch-btn:hover {
  color: var(--gold);
  border-bottom-color: var(--gold);
}

/* ═══════════════════════════════════════════
   RESPONSIVE — Desktop (≥768px)
   ═══════════════════════════════════════════ */
@media (min-width: 768px) {
  .mobile-logo { display: none; }       /* hide on desktop */
  .brand-panel { display: flex; }       /* show on desktop */
  .form-panel   { padding: 48px; }
  .form-heading  { font-size: 30px; }
}

/* ═══════════════════════════════════════════
   RESPONSIVE — Small mobile (≤400px)
   ═══════════════════════════════════════════ */
@media (max-width: 400px) {
  .form-panel { padding: 16px; }
  .form-heading { font-size: 22px; }
  .field-input { padding: 12px 14px 12px 40px; font-size: 16px; /* prevents iOS zoom */ }
  .submit-btn  { padding: 14px 20px; font-size: 16px; }
}
`;
