"use client";

import { useState, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./LandingPage.module.css";
import SignInModal from "./SignInModal";
import SignUpModal from "./SignUpModal";
import FeatureSlider from "./FeatureSlider";
import NewMeetingModal from "./NewMeetingModal";

export default function LandingPage() {
  const { isAuthenticated, user, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showSignIn, setShowSignIn] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [meetingCode, setMeetingCode] = useState("");
  const [activeNav, setActiveNav] = useState<"meetings" | "calls">("meetings");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleNewMeeting = () => {
    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }
    setShowNewMeeting(true);
  };

  const handleJoinMeeting = () => {
    if (!meetingCode.trim()) return;
    router.push(`/meet/${meetingCode.trim()}`);
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button 
              ref={menuButtonRef}
              className={styles.menuButton}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
              </svg>
            </button>
            <div className={styles.logo}>
              <img 
                src="/bloom.png" 
                alt="Bloom Logo" 
                className={styles.logoImage}
              />
            </div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.time}>
              {new Date().toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              • {new Date().toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
            </div>
            <button className={styles.iconButton} title="Help">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
              </svg>
            </button>
            <button className={styles.iconButton} title="Settings">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
              </svg>
            </button>
            <button className={styles.iconButton} title="Apps">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" />
              </svg>
            </button>
            {authLoading ? (
              <div className={styles.authLoading}>
                <div className={styles.loadingSpinner}></div>
              </div>
            ) : isAuthenticated ? (
              <div className={styles.userMenu}>
                <Link 
                  href="/profile"
                  className={styles.avatarButton} 
                  title={user?.name || "User"}
                >
                  {user?.profilePicture ? (
                    <img 
                      src={user.profilePicture} 
                      alt={user.name || "User"} 
                      className={styles.avatarImage}
                    />
                  ) : (
                    <div className={styles.avatar}>
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                  )}
                </Link>
                <div className={styles.userDropdown}>
                  <div className={styles.userInfo}>
                    <div className={styles.userName}>{user?.name}</div>
                    <div className={styles.userEmail}>{user?.email || "Guest"}</div>
                  </div>
                  <Link href="/profile" className={styles.profileLink}>
                    View Profile
                  </Link>
                  <button className={styles.signOutButton} onClick={handleSignOut}>
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <button className={styles.signInButton} onClick={() => setShowSignIn(true)}>
                Sign in
              </button>
            )}
          </div>
        </header>

        <div className={styles.content}>
          {/* Sidebar */}
          <aside 
            ref={sidebarRef}
            className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}
          >
            <nav className={styles.nav}>
              <button 
                className={`${styles.navItem} ${activeNav === "meetings" ? styles.navItemActive : ""}`}
                onClick={() => setActiveNav("meetings")}
                title="Meetings"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                </svg>
                {!sidebarCollapsed && <span>Meetings</span>}
              </button>
              <button 
                className={`${styles.navItem} ${activeNav === "calls" ? styles.navItemActive : ""}`}
                onClick={() => setActiveNav("calls")}
                title="Calls"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
                {!sidebarCollapsed && <span>Calls</span>}
              </button>
            </nav>
          </aside>

          {/* Main Content */}
          <main className={styles.main}>
            <div className={styles.hero}>
              <h1 className={styles.title}>Video calls and meetings for everyone</h1>
              <p className={styles.subtitle}>
                Connect, collaborate and celebrate from anywhere with Bloom
              </p>

              <div className={styles.actions}>
                <button className={styles.primaryButton} onClick={handleNewMeeting}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                  New meeting
                </button>

                <div className={styles.joinInput}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Enter a code or link"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleJoinMeeting()}
                  />
                  <button
                    className={styles.joinButton}
                    onClick={handleJoinMeeting}
                    disabled={!meetingCode.trim()}
                  >
                    Join
                  </button>
                </div>
              </div>

              <div className={styles.separator}></div>

              <div className={styles.illustration}>
                <FeatureSlider />
              </div>
            </div>
          </main>
        </div>
      </div>

      {showSignIn && (
        <SignInModal
          onClose={() => setShowSignIn(false)}
          onSwitchToSignUp={() => {
            setShowSignIn(false);
            setShowSignUp(true);
          }}
        />
      )}

      {showSignUp && (
        <SignUpModal
          onClose={() => setShowSignUp(false)}
          onSwitchToSignIn={() => {
            setShowSignUp(false);
            setShowSignIn(true);
          }}
        />
      )}
      {showNewMeeting && (
        <NewMeetingModal onClose={() => setShowNewMeeting(false)} />
      )}
    </>
  );
}

