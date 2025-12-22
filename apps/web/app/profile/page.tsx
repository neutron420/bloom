"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "../../lib/api";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const { user, token, signOut, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(user);

  useEffect(() => {
    // Wait for auth context to finish loading
    if (authLoading) {
      return;
    }

    // If not authenticated after loading, redirect
    if (!isAuthenticated || !token) {
      router.push("/");
      return;
    }

    // Fetch latest profile data (best effort)
    getCurrentUser(token)
      .then(({ user }) => {
        setProfileData(user);
      })
      .catch((error) => {
        // If this fails (e.g. network issue), keep showing existing profile data
        console.error("Failed to fetch profile:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isAuthenticated, token, router, authLoading]);

  // Show loading while auth is loading or profile is loading
  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  // If not authenticated, don't render (redirect is happening)
  if (!isAuthenticated || !profileData) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.backButton} onClick={() => router.push("/")} title="Back to home">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <h1 className={styles.title}>Profile</h1>
          </div>
          <button className={styles.signOutButton} onClick={signOut}>
            Sign Out
          </button>
        </div>

        <div className={styles.profileContent}>
          <div className={styles.avatarSection}>
            {profileData.profilePicture ? (
              <img
                src={profileData.profilePicture}
                alt={profileData.name}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                {profileData.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h2 className={styles.name}>{profileData.name}</h2>
          </div>

          <div className={styles.detailsSection}>
            <div className={styles.detailItem}>
              <label className={styles.label}>Email</label>
              <div className={styles.value}>
                {profileData.email || "Not provided"}
              </div>
            </div>

            {profileData.createdAt && (
              <div className={styles.detailItem}>
                <label className={styles.label}>Member Since</label>
                <div className={styles.value}>
                  {new Date(profileData.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

