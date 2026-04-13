"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth, User } from "@/lib/useAuth";
import { Eye, EyeOff, Loader2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { TOKEN, SPRING_MED } from "@/components/layout/tokens";

const LOGIN_MARKER_KEY = "disruptive_last_login_at";

function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/popup-blocked":
      return "Pop-up blocked. Allow pop-ups and try again.";
    default:
      return "Login failed. Please try again.";
  }
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" style={{ flexShrink: 0 }}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19.1 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.5 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.9 2.4-2.5 4.5-4.6 5.9l6.2 5.2C40.9 36.2 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function finalizeLogin(
    firebaseUser: {
      uid: string;
      email: string | null;
      displayName: string | null;
    },
    onError: (msg: string) => void,
    onDone: () => void,
  ) {
    try {
      const userSnap = await getDoc(doc(db, "adminaccount", firebaseUser.uid));
      if (!userSnap.exists()) {
        onError("Account not found. Contact your administrator.");
        onDone();
        return;
      }

      const data = userSnap.data();
      if (data.status === "inactive") {
        onError("Your account is inactive. Contact your administrator.");
        onDone();
        return;
      }

      const role = String(data.role || "")
        .toLowerCase()
        .trim();
      const fullName = data.fullName || firebaseUser.displayName || "User";

      const sessionRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? "",
          name: fullName,
          role,
        }),
      });

      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        onError(errData.error || "Session creation failed.");
        onDone();
        return;
      }

      const sessionData = await sessionRes.json();
      const resolvedUser: User = sessionData.user;

      localStorage.setItem(LOGIN_MARKER_KEY, String(Date.now()));
      login(resolvedUser);
      toast.success(`Welcome back, ${fullName.split(" ")[0]}!`);
      router.replace("/");
    } catch {
      onError("An unexpected error occurred.");
      onDone();
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await finalizeLogin(cred.user, setError, () => setIsLoading(false));
    } catch (err: any) {
      const msg = friendlyAuthError(err?.code ?? "");
      if (msg) setError(msg);
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      await finalizeLogin(cred.user, setError, () => setIsGoogleLoading(false));
    } catch (err: any) {
      const msg = friendlyAuthError(err?.code ?? "");
      if (msg) setError(msg);
      setIsGoogleLoading(false);
    }
  };

  const anyLoading = isLoading || isGoogleLoading;

  // ── Shared input style — font-size 16px prevents iOS zoom ────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 16, // critical: prevents iOS Safari auto-zoom
    padding: "13px 16px",
    borderRadius: 12,
    border: `1px solid ${TOKEN.border}`,
    background: TOKEN.bg,
    color: TOKEN.textPri,
    outline: "none",
    boxSizing: "border-box",
    WebkitAppearance: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: TOKEN.textSec,
    marginBottom: 7,
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: TOKEN.bg,
        padding: "24px 16px",
        // Ensure this fills the safe-area on notched phones
        paddingTop: "max(24px, env(safe-area-inset-top))",
        paddingBottom: "max(24px, env(safe-area-inset-bottom))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING_MED}
        style={{ width: "100%", maxWidth: 380 }}
      >
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${TOKEN.primary}, ${TOKEN.secondary})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: `0 8px 24px -4px ${TOKEN.primary}50`,
            }}
          >
            <Zap size={24} color="#fff" />
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: TOKEN.textPri,
              letterSpacing: "-0.02em",
            }}
          >
            JARIS CMS
          </h1>
          <p
            style={{ margin: "5px 0 0", fontSize: 13.5, color: TOKEN.textSec }}
          >
            Sign in to your account
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: TOKEN.surface,
            borderRadius: 20,
            border: `1px solid ${TOKEN.border}`,
            padding: 24,
            boxShadow: "0 4px 24px -4px rgba(15,23,42,0.08)",
          }}
        >
          {/* Google button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGoogleLogin}
            disabled={anyLoading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "13px 16px",
              borderRadius: 12,
              border: `1px solid ${TOKEN.border}`,
              background: TOKEN.surface,
              color: TOKEN.textPri,
              fontSize: 14,
              fontWeight: 600,
              cursor: anyLoading ? "not-allowed" : "pointer",
              opacity: anyLoading ? 0.6 : 1,
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
          >
            {isGoogleLoading ? (
              <Loader2
                size={18}
                style={{ animation: "spin 0.8s linear infinite" }}
              />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </motion.button>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: TOKEN.border }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: TOKEN.textSec,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              or
            </span>
            <div style={{ flex: 1, height: 1, background: TOKEN.border }} />
          </div>

          {/* Email / password form */}
          <form
            onSubmit={handleEmailLogin}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* Email */}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="name@company.com"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                disabled={anyLoading}
                required
                style={{
                  ...inputStyle,
                  borderColor: error && !email ? TOKEN.danger : TOKEN.border,
                }}
                onFocus={(e) => (e.target.style.borderColor = TOKEN.primary)}
                onBlur={(e) => (e.target.style.borderColor = TOKEN.border)}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Your password"
                  autoComplete="current-password"
                  disabled={anyLoading}
                  required
                  style={{
                    ...inputStyle,
                    paddingRight: 48,
                    borderColor:
                      error && !password ? TOKEN.danger : TOKEN.border,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = TOKEN.primary)}
                  onBlur={(e) => (e.target.style.borderColor = TOKEN.border)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={anyLoading}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: TOKEN.textSec,
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "#fef2f2",
                    border: `1px solid #fecaca`,
                    fontSize: 13,
                    color: TOKEN.danger,
                    fontWeight: 500,
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              whileHover={{ scale: anyLoading ? 1 : 1.01 }}
              whileTap={{ scale: anyLoading ? 1 : 0.98 }}
              disabled={anyLoading}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: anyLoading ? `${TOKEN.primary}80` : TOKEN.primary,
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: anyLoading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                letterSpacing: "0.02em",
                boxShadow: anyLoading
                  ? "none"
                  : `0 4px 14px -2px ${TOKEN.primary}60`,
                transition: "background 0.15s, box-shadow 0.15s",
              }}
            >
              {isLoading ? (
                <>
                  <Loader2
                    size={16}
                    style={{ animation: "spin 0.8s linear infinite" }}
                  />{" "}
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </motion.button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 12,
            color: TOKEN.textSec,
            marginTop: 20,
            opacity: 0.7,
          }}
        >
          Contact your administrator if you need access.
        </p>
      </motion.div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px ${TOKEN.bg} inset !important;
          -webkit-text-fill-color: ${TOKEN.textPri} !important;
        }
      `}</style>
    </div>
  );
}
