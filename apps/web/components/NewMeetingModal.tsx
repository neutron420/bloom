"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "next/navigation";
import { createMeeting } from "../lib/api";
import styles from "./NewMeetingModal.module.css";

interface NewMeetingModalProps {
  onClose: () => void;
}

export default function NewMeetingModal({ onClose }: NewMeetingModalProps) {
  const { token } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [meetingData, setMeetingData] = useState<{ url: string; roomId: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const createAndSetMeeting = async () => {
    setLoading(true);
    setMeetingData(null);
    try {
      console.log("Creating meeting with token:", token ? "Present" : "Not present");
      const response = await createMeeting(token);
      console.log("Meeting created:", response);
      // Use the meetingUrl from backend (which uses FRONTEND_URL env variable)
      const meetingUrl = response.meetingUrl || `${window.location.origin}/bloom/${response.meeting.roomId}`;
      setMeetingData({
        url: meetingUrl,
        roomId: response.meeting.roomId,
      });
    } catch (error) {
      console.error("Failed to create meeting:", error);
      let errorMessage = "Failed to create meeting. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStartInstantMeeting = () => {
    createAndSetMeeting();
  };

  const handleCreateForLater = () => {
    createAndSetMeeting();
  };

  const handleCopyLink = () => {
    if (meetingData) {
      navigator.clipboard.writeText(meetingData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinMeeting = () => {
    if (meetingData) {
      router.push(`/meet/${meetingData.roomId}`);
      onClose();
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

        {loading && !meetingData ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loader}></div>
            <h2 className={styles.loadingTitle}>Here's your joining information</h2>
            <p className={styles.loadingText}>Creating your Bloom meeting...</p>
          </div>
        ) : meetingData ? (
          <div className={styles.meetingInfoContainer}>
            <h2 className={styles.title}>Here's your joining information</h2>
            <div className={styles.meetingLinkContainer}>
              <div className={styles.linkBox}>
                <p className={styles.linkLabel}>Meeting link</p>
                <div className={styles.linkValue}>{meetingData.url}</div>
              </div>
              <button className={styles.copyButton} onClick={handleCopyLink}>
                {copied ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            {!copied ? (
              <div className={styles.buttonGroup}>
                <button className={styles.joinButton} onClick={handleJoinMeeting}>
                  Join now
                </button>
                <button className={styles.closeInfoButton} onClick={onClose}>
                  Close
                </button>
              </div>
            ) : (
              <div className={styles.buttonGroup}>
                <button className={styles.closeInfoButton} onClick={onClose}>
                  Close
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className={styles.title}>Get a link to share</h2>
            <p className={styles.subtitle}>Choose an option to create your Bloom meeting</p>
            
            <div className={styles.optionsList}>
              <button
                className={styles.optionItem}
                onClick={handleCreateForLater}
                disabled={loading}
              >
                <div className={styles.optionIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
                  </svg>
                </div>
                <div className={styles.optionContent}>
                  <div className={styles.optionTitle}>Create a meeting for later</div>
                  <div className={styles.optionDescription}>Get a link you can share</div>
                </div>
              </button>

              <button
                className={styles.optionItem}
                onClick={handleStartInstantMeeting}
                disabled={loading}
              >
                <div className={styles.optionIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                </div>
                <div className={styles.optionContent}>
                  <div className={styles.optionTitle}>Start an instant meeting</div>
                  <div className={styles.optionDescription}>Start meeting immediately</div>
                </div>
              </button>

              <button
                className={styles.optionItem}
                onClick={() => {
                  // Open Google Calendar with pre-filled meeting link
                  window.open("https://calendar.google.com/calendar/render?action=TEMPLATE", "_blank");
                  onClose();
                }}
                disabled={loading}
              >
                <div className={styles.optionIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                  </svg>
                </div>
                <div className={styles.optionContent}>
                  <div className={styles.optionTitle}>Schedule in Google Calendar</div>
                  <div className={styles.optionDescription}>Add to your calendar</div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

