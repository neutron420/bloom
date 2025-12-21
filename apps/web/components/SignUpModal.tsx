"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./AuthModal.module.css";

interface SignUpModalProps {
  onClose: () => void;
  onSwitchToSignIn: () => void;
}

export default function SignUpModal({ onClose, onSwitchToSignIn }: SignUpModalProps) {
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      await signUp(name, email, password);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
          <h2 className={styles.title}>Create your account</h2>
          <p className={styles.subtitle}>Sign up for Bloom</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSignUp} className={styles.form}>
          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={styles.input}
            />
          </div>

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
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <div className={styles.inputGroup}>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className={styles.footer}>
          <span>Already have an account? </span>
          <button className={styles.linkButton} onClick={onSwitchToSignIn}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

