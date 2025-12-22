"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { useAuth } from "../contexts/AuthContext";
import styles from "./MeetingRoom.module.css";

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  token: string | null;
  initialStream?: MediaStream | null;
}

interface RemoteProducer {
  producerId: string;
  socketId: string;
  userId: string;
  userName: string;
  kind: "audio" | "video";
  consumer?: mediasoupClient.types.Consumer;
}

// Determine API URL - use environment variable or detect ngrok
const getAPIUrl = () => {
  // If NEXT_PUBLIC_API_URL is set, use it (this should be set to backend ngrok URL)
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "http://localhost:3001") {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // If accessed via ngrok, we need backend ngrok URL
  // For now, default to localhost (user needs to set NEXT_PUBLIC_API_URL to backend ngrok URL)
  return "http://localhost:3001";
};

const API_URL = getAPIUrl();

function VideoTile({ producer, videoRef }: { producer: RemoteProducer; videoRef: (el: HTMLVideoElement | null) => void }) {
  return (
    <div className={styles.videoTile}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={styles.video}
        data-producer-id={producer.producerId}
        style={{ display: 'block' }}
      />
      {/* Video overlay controls */}
      <div className={styles.videoOverlay}>
        <div className={styles.videoOverlayLeft}>
          <button className={styles.overlayButton} title="Fullscreen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          </button>
          <button className={styles.overlayButton} title="Change background">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </button>
        </div>
        <button className={styles.videoMenuButton}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>
      <div className={styles.videoLabel}>{producer.userName}</div>
    </div>
  );
}

export default function MeetingRoom({ roomId, userName, token, initialStream }: MeetingRoomProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [device, setDevice] = useState<mediasoupClient.types.Device | null>(null);
  const [sendTransport, setSendTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [recvTransport, setRecvTransport] = useState<mediasoupClient.types.Transport | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteProducers, setRemoteProducers] = useState<Map<string, RemoteProducer>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string }>>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; userId: string; userName: string; message: string; createdAt: Date }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [allowParticipantsToSendMessages, setAllowParticipantsToSendMessages] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [currentScreenSharer, setCurrentScreenSharer] = useState<{ userId: string; userName: string } | null>(null);
  const [screenShareProducer, setScreenShareProducer] = useState<mediasoupClient.types.Producer | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Socket.IO connection
    const socketInstance = io(API_URL, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected:", socketInstance.id);
      
      // Join the room
      socketInstance.emit("join-room", {
        roomId,
        name: userName,
        email: user?.email || undefined,
      });
    });

    // Listen for participants event from backend
    socketInstance.on("participants", (participantNames: string[]) => {
      // Convert array of names to array of objects with id and name
      const participantList = participantNames.map((name, index) => ({
        id: `participant-${index}-${name}`,
        name: name,
      }));
      console.log("Participants received from backend:", participantNames, "Converted to:", participantList);
      setParticipants(participantList);
    });

    // Chat handlers
    socketInstance.on("new-message", (data: { id: string; userId: string; userName: string; message: string; createdAt: Date }) => {
      setChatMessages((prev) => [...prev, data]);
      // Auto-scroll to bottom
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    });

    socketInstance.on("chat-history", (data: { roomId: string; messages: Array<{ id: string; userId: string; userName: string; message: string; createdAt: Date }> }) => {
      setChatMessages(data.messages);
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    });

    socketInstance.on("chat-error", (error: { message: string }) => {
      console.error("Chat error:", error);
      alert(error.message);
    });

    // Screen sharing handlers
    socketInstance.on("screen-share-started", (data: { shareId: string; userId: string; userName: string; startedAt: Date }) => {
      console.log("Screen share started:", data);
      setCurrentScreenSharer({ userId: data.userId, userName: data.userName });
      if (data.userId === user?.id) {
        setIsScreenSharing(true);
      }
    });

    socketInstance.on("screen-share-stopped", (data: { shareId: string; userId: string; userName: string }) => {
      console.log("Screen share stopped:", data);
      if (data.userId === user?.id) {
        setIsScreenSharing(false);
        if (screenShareStream) {
          screenShareStream.getTracks().forEach(track => track.stop());
          setScreenShareStream(null);
        }
        if (screenShareProducer) {
          screenShareProducer.close();
          setScreenShareProducer(null);
        }
      }
      if (currentScreenSharer?.userId === data.userId) {
        setCurrentScreenSharer(null);
      }
    });

    socketInstance.on("screen-share-error", (error: { message: string; code?: string }) => {
      console.error("Screen share error:", error);
      alert(error.message);
      if (error.code === "SCREEN_SHARE_ACTIVE") {
        setIsScreenSharing(false);
      }
    });

    socketInstance.on("screen-sharer-info", (data: { shareId: string; userId: string; userName: string; startedAt: Date } | null) => {
      if (data) {
        setCurrentScreenSharer({ userId: data.userId, userName: data.userName });
        if (data.userId === user?.id) {
          setIsScreenSharing(true);
        }
      } else {
        setCurrentScreenSharer(null);
      }
    });

    socketInstance.on("screen-share-requested", (data: { message: string; requesterId: string; requesterName: string }) => {
      console.log("Screen share requested:", data);
      // Optionally show a notification that someone wants to share
    });

    socketInstance.on("error", (error: { message: string }) => {
      console.error("Socket error:", error);
      alert(error.message);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [roomId, userName, token, user, screenShareStream, screenShareProducer, currentScreenSharer]);

  // Request screen sharer info when joining
  useEffect(() => {
    if (socket) {
      socket.emit("get-screen-sharer", { roomId });
    }
  }, [socket, roomId]);

  useEffect(() => {
    if (!socket || !device) return;

    // Get router RTP capabilities
    socket.emit("get-router-rtp-capabilities", { roomId });
    
    socket.on("router-rtp-capabilities", async (data: { rtpCapabilities: mediasoupClient.types.RtpCapabilities }) => {
      console.log("Received router RTP capabilities", data);
      if (data.rtpCapabilities && device) {
        try {
          await device.load({ routerRtpCapabilities: data.rtpCapabilities });
          console.log("Device loaded successfully");
          await initializeMedia();
        } catch (error) {
          console.error("Error loading device:", error);
        }
      }
    });

    // Handle new producer (someone starts sharing video/audio)
    socket.on("new-producer", async (data: RemoteProducer) => {
      await handleNewProducer(data);
    });

    // Handle producer closed
    socket.on("producer-closed", ({ producerId }: { producerId: string }) => {
      const producer = remoteProducers.get(producerId);
      if (producer?.consumer) {
        producer.consumer.close();
      }
      const newProducers = new Map(remoteProducers);
      newProducers.delete(producerId);
      setRemoteProducers(newProducers);
    });

    return () => {
      socket.off("router-rtp-capabilities");
      socket.off("new-producer");
      socket.off("producer-closed");
    };
  }, [socket, device]);

  const initializeMediaSoup = async () => {
    try {
      const newDevice = new mediasoupClient.Device();
      setDevice(newDevice);
    } catch (error) {
      console.error("Error initializing MediaSoup device:", error);
    }
  };

  const initializeMedia = async () => {
    if (!socket || !device) {
      console.log("Cannot initialize media - missing socket or device", { socket: !!socket, device: !!device });
      return;
    }

    console.log("Initializing media for MediaSoup transport...");
    try {
      // Use existing localStream if available, otherwise get new media
      let stream: MediaStream = localStream!;
      
      if (!stream) {
        if (initialStream) {
          console.log("Using initial stream from PreJoinScreen", initialStream);
          stream = initialStream;
        } else {
          console.log("Requesting getUserMedia...");
          try {
            stream = await navigator.mediaDevices.getUserMedia({
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
            // Set stream state if we got new media
            setLocalStream(stream);
          } catch (getUserMediaError) {
            console.error("getUserMedia error:", getUserMediaError);
            if (getUserMediaError instanceof Error) {
              if (getUserMediaError.name === "NotAllowedError" || getUserMediaError.name === "PermissionDeniedError") {
                alert("Camera/microphone access denied. Please allow access in your browser settings and refresh.");
              } else if (getUserMediaError.name === "NotFoundError" || getUserMediaError.name === "DevicesNotFoundError") {
                alert("No camera/microphone found. Please connect a device.");
              } else {
                alert(`Failed to access media: ${getUserMediaError.message}`);
              }
            }
            throw getUserMediaError;
          }
        }
      }
      
      if (!stream) {
        console.error("No stream available for MediaSoup transport");
        return;
      }
      
      console.log("Got user media stream for transport:", {
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length,
        streamId: stream.id,
      });

      // Store stream reference for transport handler
      const mediaStream = stream;

      // Set up transport handler
      const handleTransportCreated = async (data: {
        transportId: string;
        iceParameters: mediasoupClient.types.IceParameters;
        iceCandidates: mediasoupClient.types.IceCandidate[];
        dtlsParameters: mediasoupClient.types.DtlsParameters;
        direction: "send" | "recv";
      }) => {
        if (data.direction === "send") {
          const transport = device.createSendTransport({
            id: data.transportId,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
          });

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket!.emit("connect-transport", {
              transportId: transport.id,
              dtlsParameters,
            }, callback, errback);
          });

          transport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
            socket!.emit("produce", {
              transportId: transport.id,
              kind,
              rtpParameters,
            }, (response: { producerId: string }) => {
              callback({ id: response.producerId });
            }, errback);
          });

          setSendTransport(transport);

          // Produce video and audio
          const streamVideoTracks = mediaStream.getVideoTracks();
          const streamAudioTracks = mediaStream.getAudioTracks();
          if (streamVideoTracks.length > 0) {
            const videoTrack = streamVideoTracks[0];
            await transport.produce({ track: videoTrack });
          }

          if (streamAudioTracks.length > 0) {
            const audioTrack = streamAudioTracks[0];
            await transport.produce({ track: audioTrack });
          }
        } else if (data.direction === "recv") {
          const transport = device.createRecvTransport({
            id: data.transportId,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
          });

          transport.on("connect", ({ dtlsParameters }, callback, errback) => {
            socket!.emit("connect-transport", {
              transportId: transport.id,
              dtlsParameters,
            }, callback, errback);
          });

          setRecvTransport(transport);
        }
      };

      socket.on("transport-created", handleTransportCreated);

      // Create send transport
      socket.emit("create-transport", { roomId, direction: "send" });

      // Create recv transport
      socket.emit("create-transport", { roomId, direction: "recv" });
    } catch (error) {
      console.error("Error initializing media:", error);
    }
  };

  const handleNewProducer = async (data: RemoteProducer) => {
    if (!socket || !recvTransport || !device) return;

    try {
      socket.emit("consume-producer", {
        producerId: data.producerId,
        rtpCapabilities: device.rtpCapabilities,
      });
      
      const handleConsumerCreated = async (consumerData: {
        consumerId: string;
        producerId: string;
        kind: "audio" | "video";
        rtpParameters: mediasoupClient.types.RtpParameters;
      }) => {
        if (consumerData.producerId !== data.producerId) return;
        
        socket.off("consumer-created", handleConsumerCreated);
        
        const consumer = await recvTransport.consume({
          id: consumerData.consumerId,
          producerId: consumerData.producerId,
          kind: consumerData.kind,
          rtpParameters: consumerData.rtpParameters,
        });

        const newProducer: RemoteProducer = {
          ...data,
          consumer,
        };

        const newProducers = new Map(remoteProducers);
        newProducers.set(data.producerId, newProducer);
        setRemoteProducers(newProducers);

        socket.emit("resume-consumer", { consumerId: consumer.id });
      };
      
      socket.on("consumer-created", handleConsumerCreated);
    } catch (error) {
      console.error("Error consuming producer:", error);
    }
  };

  useEffect(() => {
    initializeMediaSoup();
  }, []);

  // Load cached media preferences (audio/video) on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("bloom_media_prefs");
      if (stored) {
        const prefs = JSON.parse(stored) as { video?: boolean; audio?: boolean };
        if (typeof prefs.video === "boolean") {
          setIsVideoEnabled(prefs.video);
        }
        if (typeof prefs.audio === "boolean") {
          setIsAudioEnabled(prefs.audio);
        }
      }
    } catch (error) {
      console.error("Failed to read media preferences from cache:", error);
    }
  }, []);

  // Persist media preferences whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "bloom_media_prefs",
        JSON.stringify({
          video: isVideoEnabled,
          audio: isAudioEnabled,
        }),
      );
    } catch (error) {
      console.error("Failed to save media preferences to cache:", error);
    }
  }, [isVideoEnabled, isAudioEnabled]);

  // Set initial stream immediately if available (before MediaSoup initialization)
  useEffect(() => {
    if (initialStream && !localStream) {
      console.log("Setting initial stream immediately", initialStream);
      setLocalStream(initialStream);
      
      // Set initial track states
      const videoTracks = initialStream.getVideoTracks();
      const audioTracks = initialStream.getAudioTracks();
      if (videoTracks.length > 0 && videoTracks[0]) {
        videoTracks[0].enabled = isVideoEnabled;
      }
      if (audioTracks.length > 0 && audioTracks[0]) {
        audioTracks[0].enabled = isAudioEnabled;
      }
    }
  }, [initialStream]);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("Attaching stream to video element", localStream, "Video enabled:", isVideoEnabled);
      const videoElement = localVideoRef.current;
      
      // Always attach the stream
      if (videoElement.srcObject !== localStream) {
        console.log("Setting srcObject to stream");
        videoElement.srcObject = localStream;
      }
      
      // Ensure video plays
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Video playing successfully");
          })
          .catch((error) => {
            console.error("Error playing local video:", error);
          });
      }
    } else {
      console.log("Video element or stream not ready:", {
        hasVideoElement: !!localVideoRef.current,
        hasStream: !!localStream,
        isVideoEnabled,
      });
    }
  }, [localStream, isVideoEnabled]);

  // Load chat history when chat opens
  useEffect(() => {
    if (showChat && socket) {
      socket.emit("get-chat-history", { roomId, limit: 50 });
    }
  }, [showChat, socket, roomId]);

  const sendChatMessage = () => {
    if (!socket || !chatInput.trim()) return;
    
    socket.emit("send-message", { message: chatInput.trim() });
    setChatInput("");
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const newState = !isVideoEnabled;
        videoTrack.enabled = newState;
        setIsVideoEnabled(newState);
        
        // Update video element visibility immediately
        if (localVideoRef.current) {
          localVideoRef.current.style.display = newState ? 'block' : 'none';
        }
      }
    }
  };

  const toggleAudio = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        const newState = !isAudioEnabled;
        audioTrack.enabled = newState;
        setIsAudioEnabled(newState);
      }
    }
  };

  const startScreenShare = async () => {
    if (!socket || !sendTransport || isScreenSharing) return;

    try {
      // Request screen share
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      });

      setScreenShareStream(screenStream);

      // Handle user stopping screen share via browser UI
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          stopScreenShare();
        };
      }

      // Create producer for screen share video track
      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack && sendTransport) {
        const producer = await sendTransport.produce({
          track: videoTrack,
          codecOptions: {
            videoGoogleStartBitrate: 1000,
          },
        });

        setScreenShareProducer(producer);

        // Emit start-screen-share event to backend
        socket.emit("start-screen-share");

        console.log("Screen share started successfully");
      }
    } catch (error) {
      console.error("Error starting screen share:", error);
      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          alert("Screen sharing permission denied. Please allow screen sharing.");
        } else {
          alert(`Failed to start screen share: ${error.message}`);
        }
      }
    }
  };

  const stopScreenShare = async () => {
    if (!socket || !isScreenSharing) return;

    try {
      // Stop the screen share stream
      if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
        setScreenShareStream(null);
      }

      // Close the producer
      if (screenShareProducer) {
        screenShareProducer.close();
        setScreenShareProducer(null);
      }

      // Emit stop-screen-share event to backend
      socket.emit("stop-screen-share");

      setIsScreenSharing(false);
      console.log("Screen share stopped successfully");
    } catch (error) {
      console.error("Error stopping screen share:", error);
      alert("Failed to stop screen sharing");
    }
  };

  const handleLeave = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (sendTransport) {
      sendTransport.close();
    }
    if (recvTransport) {
      recvTransport.close();
    }
    if (socket) {
      socket.disconnect();
    }

    // Clear cached meeting so refresh doesn't auto-join after leaving
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("bloom_last_meeting");
      } catch (error) {
        console.error("Failed to clear cached meeting info:", error);
      }
    }

    router.push("/");
  };

  const remoteProducersArray = Array.from(remoteProducers.values());
  // Count all participants including local user
  const allParticipants = Math.max(1, participants.length + 1); // At least 1 (local user)
  // Count actual video tiles (local + remote videos with consumers)
  const videoTilesCount = Math.max(1, 1 + remoteProducersArray.filter((p) => p.kind === "video" && p.consumer).length);
  const totalVideos = videoTilesCount; // Total number of video tiles
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={styles.container}>
      {/* Top Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarRight}>
          <div className={styles.participantCount}>
            {allParticipants}
          </div>
          {user?.profilePicture ? (
            <img src={user.profilePicture} alt={user.name} className={styles.topBarAvatar} />
          ) : (
            <div className={styles.topBarAvatarPlaceholder}>
              {user?.name?.charAt(0).toUpperCase() || userName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className={styles.videoGrid} data-participant-count={totalVideos}>
        {/* Local video */}
        <div className={styles.videoTile}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={styles.video}
            style={{ display: isVideoEnabled && localStream ? 'block' : 'none' }}
          />
          {(!isVideoEnabled || !localStream) && (
            <div className={styles.profilePictureContainer}>
              {user?.profilePicture ? (
                <img src={user.profilePicture} alt={userName} className={styles.profilePicture} />
              ) : (
                <div className={styles.profilePicturePlaceholder}>
                  {userName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}
          
          {/* Video overlay controls */}
          <div className={styles.videoOverlay}>
            <div className={styles.videoOverlayLeft}>
              <button className={styles.overlayButton} title="Fullscreen">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              </button>
              <button className={styles.overlayButton} title="Change background">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </button>
            </div>
            <button className={styles.videoMenuButton}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>
          </div>
          
          <div className={styles.videoLabel}>{userName}</div>
          {!isAudioEnabled && (
            <div className={styles.muteIndicator}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Remote videos */}
        {remoteProducersArray
          .filter((p) => p.kind === "video" && p.consumer)
          .map((producer) => (
            <VideoTile
              key={producer.producerId}
              producer={producer}
              videoRef={(el) => {
                if (el && producer.consumer) {
                  remoteVideosRef.current.set(producer.producerId, el);
                  el.srcObject = new MediaStream([producer.consumer.track]);
                }
              }}
            />
          ))}
      </div>

      {/* Bottom Bar */}
      <div className={styles.bottomBar}>
        {/* Left: Time and Meeting Code */}
        <div className={styles.bottomBarLeft}>
          <div className={styles.meetingTime}>
            {currentTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} | {roomId}
          </div>
        </div>

        {/* Center: Controls */}
        <div className={styles.bottomBarCenter}>
          <button
            className={`${styles.controlButton} ${!isAudioEnabled ? styles.controlButtonMuted : ""}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? "Turn off microphone" : "Turn on microphone"}
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
                <path d="M21 6.5l-3.5-3.5L17 4.5 14.5 2 11 5.5 8.5 3 5 6.5 2.5 4 1 5.5v13L2.5 20l2.5-2.5L6.5 20 9 17.5l2.5 2.5L14 17.5l2.5 2.5L19 17.5l2.5 2.5L23 20V5.5l-2-2zM19 16.5h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2v-2h2v2z" />
              )}
            </svg>
          </button>

          <button 
            className={`${styles.controlButton} ${isScreenSharing ? styles.controlButtonMuted : ""}`}
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            title={isScreenSharing ? "Stop presenting" : "Present now"}
            disabled={!sendTransport}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </svg>
          </button>

          <button className={styles.controlButton} title="Reactions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
          </button>

          <button className={styles.controlButton} title="Turn on captions">
            <span className={styles.ccText}>CC</span>
          </button>

          <button className={styles.controlButton} title="Raise hand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.5 16c-.83 0-1.5-.67-1.5-1.5v-2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2.5c0 .83-.67 1.5-1.5 1.5zm-4-4c-.83 0-1.5-.67-1.5-1.5V8c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v2.5c0 .83-.67 1.5-1.5 1.5zm-4-4c-.83 0-1.5-.67-1.5-1.5V4c0-.83.67-1.5 1.5-1.5S10 3.17 10 4v2.5c0 .83.67 1.5 1.5 1.5zm-4-4C10.67 4 10 3.33 10 2.5S10.67 1 11.5 1 13 1.67 13 2.5 12.33 4 11.5 4z" />
            </svg>
          </button>

          <button className={styles.controlButton} title="More options">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          <button
            className={`${styles.controlButton} ${styles.endCallButton}`}
            onClick={handleLeave}
            title="Leave call"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.23-2.73 2.15-.18.19-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.09-.7-.28-.86-.92-1.75-1.66-2.73-2.15-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>

        {/* Right: Additional Controls */}
        <div className={styles.bottomBarRight}>
          <button className={styles.rightControlButton} title="Meeting information">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </button>
          <button 
            className={`${styles.rightControlButton} ${showChat ? styles.active : ""}`}
            onClick={() => setShowChat(!showChat)}
            title="Chat"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
          </button>
          <button className={styles.rightControlButton} title="People">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
          </button>
          <button className={styles.rightControlButton} title="Security">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat Panel */}
      {showChat && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <h3>In-call messages</h3>
            <button className={styles.closeChatButton} onClick={() => setShowChat(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
          <div className={styles.chatToggleSection}>
            <div className={styles.chatToggleLabel}>
              <span>Let participants send messages</span>
            </div>
            <label className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={allowParticipantsToSendMessages}
                onChange={(e) => setAllowParticipantsToSendMessages(e.target.checked)}
              />
              <span className={styles.toggleSlider}></span>
            </label>
          </div>
          <div className={styles.chatInfo}>
            <div className={styles.chatInfoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
              </svg>
            </div>
            <div className={styles.chatInfoText}>
              <div className={styles.chatInfoTitle}>Continuous chat is OFF</div>
              <div className={styles.chatInfoDescription}>
                Messages won't be saved when the call ends. You can pin a message to make it visible for people who join later.
              </div>
            </div>
          </div>
          <div className={styles.chatMessages} ref={chatContainerRef}>
            {chatMessages.length === 0 ? (
              <div className={styles.noMessages}>No messages yet</div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={styles.chatMessage}>
                  <div className={styles.chatMessageHeader}>
                    <span className={styles.chatUserName}>{msg.userName}</span>
                    <span className={styles.chatTime}>
                      {new Date(msg.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className={styles.chatMessageText}>{msg.message}</div>
                </div>
              ))
            )}
          </div>
          <div className={styles.chatInputContainer}>
            <div className={styles.chatInputWrapper}>
              <div className={styles.chatInputIndicator}></div>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Send a message"
                className={styles.chatInput}
              />
              <button onClick={sendChatMessage} className={styles.sendButton} disabled={!chatInput.trim()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

