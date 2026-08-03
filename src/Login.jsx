import React, { useState } from "react";
import { supabase } from "./supabaseClient";

const LOGO_SRC = "https://z-cdn-media.chatglm.cn/files/c4df6667-2cb5-44bd-9e8c-084ed2a10aef.png?auth_key=1885240175-d071a696811b4023895eec2f8f72bcdc-0-f1149165f857bcfa6db14fa029bb57fd";

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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        setError("Account created! Check your email to confirm your account, then sign in.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src={LOGO_SRC} alt="Modulo Development Logo" style={styles.logo} />
          <h2 style={styles.title}>MODULO LEDGER</h2>
          <p style={styles.subtitle}>
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>EMAIL ADDRESS</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="admin@modulodev.com"
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div style={styles.footer}>
          {mode === "login" ? (
            <span style={styles.footerText}>
              Don't have an account?{" "}
              <button style={styles.switchBtn} onClick={() => { setMode("signup"); setError(null); }}>
                Create one
              </button>
            </span>
          ) : (
            <span style={styles.footerText}>
              Already have an account?{" "}
              <button style={styles.switchBtn} onClick={() => { setMode("login"); setError(null); }}>
                Sign in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#1A1A1A",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "#FFFFFF",
    padding: "40px 32px",
    borderRadius: 12,
    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
    maxWidth: "420px",
    width: "100%",
    borderTop: "4px solid #C9A84C",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: {
    textAlign: "center",
    marginBottom: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logo: {
    height: "64px",
    width: "auto",
    marginBottom: 16,
  },
  title: {
    margin: 0,
    fontSize: "22pt",
    fontWeight: 800,
    color: "#1A1A1A",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    color: "#6B6B6B",
    marginTop: 8,
    fontSize: 14,
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 11,
    color: "#6B6B6B",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 8,
    border: "1px solid #E8E4DC",
    background: "#FAFAF8",
    boxSizing: "border-box",
    fontSize: 15,
    outline: "none",
    transition: "border-color 0.2s",
  },
  button: {
    width: "100%",
    padding: "16px",
    background: "#2F5233",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 15,
    marginTop: 8,
    transition: "background 0.2s",
  },
  errorBox: {
    width: "100%",
    background: "#FFEBEE",
    color: "#A63D40",
    padding: "12px 16px",
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 13,
    border: "1px solid #FFCDD2",
    textAlign: "center",
  },
  footer: {
    marginTop: 24,
    textAlign: "center",
    width: "100%",
  },
  footerText: {
    fontSize: 13,
    color: "#6B6B6B",
  },
  switchBtn: {
    background: "none",
    border: "none",
    color: "#2F5233",
    fontWeight: 700,
    cursor: "pointer",
    padding: 0,
    fontSize: 13,
    textDecoration: "underline",
  }
};