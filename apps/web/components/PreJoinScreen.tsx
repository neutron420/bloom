"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import styles from "./PreJoinScreen.module.css";

interface PreJoinScreenProps {
  roomId: string;
  userName: string;
  onJoin: (stream: MediaStream) => void;
}

export default function PreJoinScreen({ roomId, userName, onJoin }: PreJoinScreenProps) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioOutputDevice, setSelectedAudioOutputDevice] = useState<string>("");
  const [showAudioDropdown, setShowAudioDropdown] = useState(false);
  const [showAudioOutputDropdown, setShowAudioOutputDropdown] = useState(false);
  const [showVideoDropdown, setShowVideoDropdown] = useState(false);

  useEffect(() => {
    // Request permissions explicitly
    const requestPermissions = async () => {
      try {
        // Request camera and microphone permissions
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        
        setLocalStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        loadDevices();
      } catch (error) {
        console.error("Error accessing media:", error);
        if (error instanceof Error) {
          if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
            alert("Camera/microphone access denied. Please allow access in your browser settings and refresh the page.");
          } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            alert("No camera/microphone found. Please connect a device.");
          } else {
            alert(`Failed to access media: ${error.message}`);
          }
        } else {
          alert("Failed to access camera/microphone. Please check permissions.");
        }
      }
    };

    requestPermissions();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((device) => device.kind === "audioinput");
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      setAudioOutputDevices(audioOutputs);

      if (audioInputs.length > 0 && audioInputs[0]) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (videoInputs.length > 0 && videoInputs[0]) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (audioOutputs.length > 0 && audioOutputs[0]) {
        setSelectedAudioOutputDevice(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const changeAudioDevice = async (deviceId: string) => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: localStream.getVideoTracks()[0] ? { deviceId: { exact: selectedVideoDevice } } : false,
          audio: { deviceId: { exact: deviceId } },
        });
        audioTrack.stop();
        const newAudioTrack = newStream.getAudioTracks()[0];
        if (newAudioTrack) {
          localStream.removeTrack(audioTrack);
          localStream.addTrack(newAudioTrack);
          setSelectedAudioDevice(deviceId);
        }
        newStream.getVideoTracks().forEach(track => track.stop());
      } catch (error) {
        console.error("Error changing audio device:", error);
      }
    }
    setShowAudioDropdown(false);
  };

  const changeVideoDevice = async (deviceId: string) => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: localStream.getAudioTracks()[0] ? { deviceId: { exact: selectedAudioDevice } } : false,
        });
        videoTrack.stop();
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          localStream.removeTrack(videoTrack);
          localStream.addTrack(newVideoTrack);
          if (videoRef.current) {
            videoRef.current.srcObject = localStream;
          }
          setSelectedVideoDevice(deviceId);
        }
        newStream.getAudioTracks().forEach(track => track.stop());
      } catch (error) {
        console.error("Error changing video device:", error);
      }
    }
    setShowVideoDropdown(false);
  };

  const changeAudioOutputDevice = (deviceId: string) => {
    // Note: Audio output device selection requires HTMLAudioElement.setSinkId()
    // This is a simplified version - full implementation would require audio element
    setSelectedAudioOutputDevice(deviceId);
    setShowAudioOutputDropdown(false);
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const handleJoin = () => {
    // Pass the stream to the meeting room
    if (localStream) {
      onJoin(localStream);
    }
  };

  const handleCancel = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    router.push("/");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <img src="/bloom.png" alt="Bloom" className={styles.logoImage} />
            <span className={styles.logoText}></span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {user && (
            <div className={styles.userInfo}>
              <div className={styles.userDetails}>
                <div className={styles.userEmail}>{user.email || "Guest"}</div>
                <button className={styles.switchAccount} onClick={() => signOut()}>
                  Switch account
                </button>
              </div>
              {user.profilePicture ? (
                <img 
                  src={user.profilePicture} 
                  alt={user.name} 
                  className={styles.userAvatar}
                />
              ) : (
                <div className={styles.userAvatarPlaceholder}>
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.leftSection}>
          <div className={styles.videoPreview}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={styles.video}
            />
            {!isVideoEnabled && (
              <div className={styles.cameraOffOverlay}>
                <div className={styles.cameraOffIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 6.5l-3.5-3.5L17 4.5 14.5 2 11 5.5 8.5 3 5 6.5 2.5 4 1 5.5v13L2.5 20l2.5-2.5L6.5 20 9 17.5l2.5 2.5L14 17.5l2.5 2.5L19 17.5l2.5 2.5L23 20V5.5l-2-2zM19 16.5h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2v-2h2v2z" />
                  </svg>
                </div>
                <div className={styles.cameraOffText}>Camera is off</div>
              </div>
            )}
            <div className={styles.videoOverlay}>
              <div className={styles.userName}>{userName}</div>
              <button className={styles.menuButton}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
            </div>
            <div className={styles.videoControls}>
              <button
                className={`${styles.controlButton} ${!isAudioEnabled ? styles.controlButtonMuted : ""}`}
                onClick={toggleAudio}
                title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {isAudioEnabled ? (
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  ) : (
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  )}
                </svg>
              </button>
              <button
                className={`${styles.controlButton} ${!isVideoEnabled ? styles.controlButtonMuted : ""}`}
                onClick={toggleVideo}
                title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  {isVideoEnabled ? (
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                  ) : (
                    <>
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                      <path d="M3.27 2L2 3.27l4.22 4.22L3 9v6l4-4v5.73l2 2L13 18.73l4.78 4.78L21 19.73 3.27 2z" fill="currentColor" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.deviceSelectors}>
            <div className={styles.deviceButtonWrapper}>
              <button 
                className={styles.deviceButton}
                onClick={() => {
                  setShowAudioDropdown(!showAudioDropdown);
                  setShowAudioOutputDropdown(false);
                  setShowVideoDropdown(false);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                </svg>
                <span className={styles.deviceButtonText}>
                  {audioDevices.find((d) => d.deviceId === selectedAudioDevice)?.label?.substring(0, 15) || "Microphone..."}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showAudioDropdown && (
                <div className={styles.deviceDropdown}>
                  {audioDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      className={styles.deviceDropdownItem}
                      onClick={() => changeAudioDevice(device.deviceId)}
                    >
                      {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.deviceButtonWrapper}>
              <button 
                className={styles.deviceButton}
                onClick={() => {
                  setShowAudioOutputDropdown(!showAudioOutputDropdown);
                  setShowAudioDropdown(false);
                  setShowVideoDropdown(false);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
                <span className={styles.deviceButtonText}>
                  {audioOutputDevices.find((d) => d.deviceId === selectedAudioOutputDevice)?.label?.substring(0, 15) || "Headphone..."}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showAudioOutputDropdown && (
                <div className={styles.deviceDropdown}>
                  {audioOutputDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      className={styles.deviceDropdownItem}
                      onClick={() => changeAudioOutputDevice(device.deviceId)}
                    >
                      {device.label || `Speaker ${device.deviceId.substring(0, 8)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.deviceButtonWrapper}>
              <button 
                className={styles.deviceButton}
                onClick={() => {
                  setShowVideoDropdown(!showVideoDropdown);
                  setShowAudioDropdown(false);
                  setShowAudioOutputDropdown(false);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                </svg>
                <span className={styles.deviceButtonText}>
                  {videoDevices.find((d) => d.deviceId === selectedVideoDevice)?.label?.substring(0, 15) || "Camera..."}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </button>
              {showVideoDropdown && (
                <div className={styles.deviceDropdown}>
                  {videoDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      className={styles.deviceDropdownItem}
                      onClick={() => changeVideoDevice(device.deviceId)}
                    >
                      {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={styles.rightSection}>
          <div className={styles.joinCard}>
            <div className={styles.starIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
              </svg>
            </div>
            <h1 className={styles.joinTitle}>Ready to join?</h1>
            <p className={styles.joinSubtitle}>No one else is here</p>
            <button className={styles.joinButton} onClick={handleJoin}>
              Join now
            </button>
            <button className={styles.otherWaysButton}>
              Other ways to join
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

