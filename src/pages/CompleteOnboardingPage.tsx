import React, { useState, useEffect } from "react";
import { Eye, EyeOff, ArrowRight, Lock, RefreshCw } from "lucide-react";
import { supabase, getSession } from "../supabaseClient";
import { loadMyProfile } from "../supabase/profile";
import type { UserProfile } from "../supabase/profile";
import AuthShell, {
  AuthStatusScreen, AuthPrimaryButton, authInputStyle, AuthFieldLabel, AuthErrorBanner,
} from "../components/auth/AuthShell";
import CompanyLogo from "../components/auth/CompanyLogo";
import { GREEN, ALERT, MUTED, FONT_BODY } from "../theme/tokens";

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
        } else if (!cancelled) {
          setState("active");
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
      const { error: fnError } = await supabase.functions.invoke("complete-onboarding", {
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

  function goLogin() {
    window.location.href = "/";
  }

  if (state === "loading") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--paper)", fontFamily: FONT_BODY,
      }}>
        <div style={{ textAlign: "center" }}>
          <CompanyLogo size="lg" style={{ margin: "0 auto 16px" }} />
          <RefreshCw size={20} color={MUTED} style={{ animation: "spin 0.8s linear infinite", marginBottom: 10 }} />
          <div style={{ color: MUTED, fontSize: 14 }}>Verifying your invitation…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === "no_session") {
    return (
      <AuthStatusScreen
        title="Invitation expired or invalid"
        message="This invitation link is no longer valid. It may have expired or already been used. Please request a new invitation from your administrator."
        action={<AuthPrimaryButton onClick={goLogin}>Return to login</AuthPrimaryButton>}
      />
    );
  }

  if (state === "active") {
    return (
      <AuthStatusScreen
        title="Account already set up"
        message="Your account has already been activated. You can sign in and go to the dashboard."
        action={<AuthPrimaryButton onClick={goLogin}>Go to login</AuthPrimaryButton>}
      />
    );
  }

  if (state === "error") {
    return (
      <AuthStatusScreen
        title="Unable to verify invitation"
        message="We couldn't verify your invitation. Please request a new one from your administrator."
        action={<AuthPrimaryButton onClick={goLogin}>Return to login</AuthPrimaryButton>}
      />
    );
  }

  return (
    <AuthShell
      formTitle="Create your password"
      formSubtitle={`Welcome, ${profile?.employeeName || "team member"}. Set a secure password to activate your account.`}
      features={[
        { icon: Lock, text: "Set up your secure account", sub: "Create your password to continue" },
      ]}
      badges={[]}
    >
      {error && <AuthErrorBanner message={error} />}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <AuthFieldLabel>New password</AuthFieldLabel>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              style={{ ...authInputStyle(), paddingRight: 48 }}
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
          {password.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              {password.length < 8 ? (
                <span style={{ color: ALERT }}>At least 8 characters required.</span>
              ) : (
                <span style={{ color: GREEN }}>Password meets minimum length.</span>
              )}
            </div>
          )}
        </div>

        <div>
          <AuthFieldLabel>Confirm password</AuthFieldLabel>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              style={{ ...authInputStyle(), paddingRight: 48 }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              aria-label={showConfirm ? "Hide password" : "Show password"}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4,
              }}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <AuthPrimaryButton type="submit" disabled={saving}>
          {saving ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                animation: "spin 0.6s linear infinite",
              }} />
              Setting up…
            </span>
          ) : (
            <>
              Activate account
              <ArrowRight size={17} />
            </>
          )}
        </AuthPrimaryButton>
      </form>
    </AuthShell>
  );
}
