"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";
import styles from "./AuthModal.module.css";

interface SignInModalProps {
  onClose: () => void;
  onSwitchToSignUp: () => void;
}

export default function SignInModal({ onClose, onSwitchToSignUp }: SignInModalProps) {
  const { signIn, guestSignIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guestName, setGuestName] = useState("");
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError("");
      
      if (!credentialResponse.credential) {
        throw new Error("No credential received from Google");
      }

      await signInWithGoogle(credentialResponse.credential);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign in failed");
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await guestSignIn(guestName);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guest sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>Sign in</h2>
          <p className={styles.subtitle}>Continue to Bloom</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {!isGuestMode ? (
          <form onSubmit={handleSignIn} className={styles.form}>
            <div className={styles.inputGroup}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <div className={styles.divider}>
              <span>OR</span>
            </div>

            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? (
              <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  useOneTap={false}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>
            ) : null}

            <div className={styles.divider}>
              <span>OR</span>
            </div>

            <button
              type="button"
              className={styles.guestButton}
              onClick={() => setIsGuestMode(true)}
            >
              Continue as guest
            </button>
          </form>
        ) : (
          <form onSubmit={handleGuestSignIn} className={styles.form}>
            <div className={styles.inputGroup}>
              <input
                type="text"
                placeholder="Enter your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                className={styles.input}
              />
            </div>

            <button type="submit" className={styles.submitButton} disabled={loading || !guestName.trim()}>
              {loading ? "Continuing..." : "Continue as guest"}
            </button>

            <div className={styles.divider}>
              <span>OR</span>
            </div>

            <button
              type="button"
              className={styles.guestButton}
              onClick={() => setIsGuestMode(false)}
            >
              Sign in with email
            </button>
          </form>
        )}

        <div className={styles.footer}>
          <span>Don't have an account? </span>
          <button className={styles.linkButton} onClick={onSwitchToSignUp}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}

