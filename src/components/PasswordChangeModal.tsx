import React, { useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { inputStyle, labelStyle } from "./ui/styles";
import { db } from "../supabaseClient";

export default function PasswordChangeModal({ employeeId, employeeName, isDark, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!password || password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await db.completeOnboarding(employeeId, password);
      onComplete && onComplete();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to set password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Welcome ${employeeName || ""}`} onClose={() => {}}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={labelStyle}>New password</label>
          <input style={inputStyle} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Confirm password</label>
          <input style={inputStyle} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div>
          <Button onClick={handleSubmit} fullWidth disabled={saving}>
            {saving ? "Setting…" : "Set password & continue"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
