import { useState, FormEvent } from "react";
import { signIn, signUp } from "./supabaseClient";
import { Eye, EyeOff, ArrowRight, Lock, Zap, Globe } from "lucide-react";
import AuthShell, {
  authInputStyle, AuthFieldLabel, AuthErrorBanner, AuthPrimaryButton,
} from "./components/auth/AuthShell";

type AuthMode = "login" | "signup";

export default function Login(): JSX.Element {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        if (password.length < 6) throw new Error("Password must be at least 6 characters");
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("modulo_login_flow", "1");
          window.localStorage.removeItem("modulo_tab");
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      formTitle={mode === "login" ? "Welcome back" : "Create your account"}
      formSubtitle={mode === "login"
        ? "Enter your credentials to access your ledger."
        : "Get started with Modulo Ledger in seconds."}
      features={[
        { icon: Lock, text: "End-to-end encrypted with Supabase Auth", sub: "Zero-knowledge architecture" },
        { icon: Zap, text: "Real-time financial dashboards", sub: "Live KPIs & cash flow" },
        { icon: Globe, text: "Multi-user role-based access", sub: "CEO, PM, Accounts & more" },
      ]}
      footer={(
        <>
          <p style={{ marginTop: 28, fontSize: "0.875rem", color: "var(--muted)", textAlign: "center" }}>
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
              style={{
                background: "none", border: "none", color: "var(--green)",
                fontWeight: 600, cursor: "pointer", fontSize: "0.875rem",
              }}
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
          <p style={{
            marginTop: 12, fontSize: "0.75rem", color: "var(--muted)", textAlign: "center",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Lock size={11} /> Secured by Supabase Auth
          </p>
        </>
      )}
    >
      {error && <AuthErrorBanner message={error} />}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <AuthFieldLabel>Email address</AuthFieldLabel>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            style={authInputStyle(!!error)}
          />
        </div>

        <div>
          <AuthFieldLabel>Password</AuthFieldLabel>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ ...authInputStyle(!!error), paddingRight: 48 }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? "Hide password" : "Show password"}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4,
              }}
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {mode === "login" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--green)" }}
              />
              Remember me
            </label>
          </div>
        )}

        {mode === "signup" && (
          <div>
            <AuthFieldLabel>Confirm password</AuthFieldLabel>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPw ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...authInputStyle(!!error), paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPw(!showConfirmPw)}
                aria-label={showConfirmPw ? "Hide password" : "Show password"}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4,
                }}
              >
                {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        <AuthPrimaryButton type="submit" disabled={loading}>
          {loading ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                animation: "spin 0.6s linear infinite",
              }} />
              {mode === "login" ? "Signing in…" : "Creating account…"}
            </span>
          ) : (
            <>
              {mode === "login" ? "Sign in" : "Create account"}
              <ArrowRight size={17} />
            </>
          )}
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
}
