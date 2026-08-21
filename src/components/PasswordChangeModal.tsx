import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import CompanyLogo from "./auth/CompanyLogo";
import { AuthFieldLabel, AuthErrorBanner, authInputStyle } from "./auth/AuthShell";
import { GREEN, MUTED, FONT_BODY } from "../theme/tokens";
import { db } from "../supabaseClient";

interface PasswordChangeModalProps {
  employeeId: string;
  employeeName?: string;
  onComplete?: () => void;
}

export default function PasswordChangeModal({ employeeId, employeeName, onComplete }: PasswordChangeModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSaving(true);
    try {
      await db.completeOnboarding(employeeId, password);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Welcome, ${employeeName || "team member"}`}
      sub="Set a secure password to activate your account and continue."
      onClose={() => {}}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <CompanyLogo size="md" />
      </div>

      {error && <AuthErrorBanner message={error} />}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <AuthFieldLabel>New password</AuthFieldLabel>
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...authInputStyle(), paddingRight: 44 }}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4,
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <AuthFieldLabel>Confirm password</AuthFieldLabel>
          <div style={{ position: "relative" }}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ ...authInputStyle(), paddingRight: 44 }}
              placeholder="Re-enter password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: MUTED, padding: 4,
              }}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {password.length > 0 && password.length < 8 && (
          <div style={{ fontSize: 11, color: "var(--alert)", fontFamily: FONT_BODY }}>
            Password must be at least 8 characters.
          </div>
        )}
        {password.length >= 8 && (
          <div style={{ fontSize: 11, color: GREEN, fontFamily: FONT_BODY }}>
            Password meets minimum length.
          </div>
        )}

        <Button type="submit" onClick={() => {}} fullWidth disabled={saving}>
          {saving ? "Setting…" : "Set password & continue"}
        </Button>
      </form>
    </Modal>
  );
}
