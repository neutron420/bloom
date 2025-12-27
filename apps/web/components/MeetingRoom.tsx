"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Smile,
  Hand,
  MoreVertical,
  Phone,
  Info,
  MessageSquare,
  Users,
  Shield,
  X,
  Send,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface MeetingRoomProps {
  roomId: string;
  userName: string;
  onLeave?: () => void;
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: Date;
}

interface Participant {
  id: string;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
}

export function MeetingRoom({ roomId, userName, onLeave }: MeetingRoomProps) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // UI state
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [allowMessages, setAllowMessages] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Mock participants
  const [participants] = useState<Participant[]>([
    { id: "local", name: userName, isLocal: true },
  ]);

  // Initialize media
  useEffect(() => {
    const initMedia = async () => {
      try {
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
      } catch (error) {
        console.error("Failed to access media devices:", error);
        toast.error("Could not access camera or microphone");
      }
    };

    initMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Attach stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Update time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  }, [localStream, isVideoEnabled]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  }, [localStream, isAudioEnabled]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      toast.success("Stopped presenting");
    } else {
      try {
        await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
        toast.success("You are now presenting");
      } catch (error) {
        console.error("Screen share failed:", error);
      }
    }
  }, [isScreenSharing]);

  const handleLeave = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    onLeave?.();
    router.push("/");
  }, [localStream, onLeave, router]);

  const sendMessage = useCallback(() => {
    if (!chatInput.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      userId: "local",
      userName,
      message: chatInput.trim(),
      createdAt: new Date(),
    };

    setChatMessages((prev) => [...prev, newMessage]);
    setChatInput("");

    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }, [chatInput, userName]);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex h-screen flex-col bg-[#202124] text-white">
      {/* Top Bar */}
      <header className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => router.push("/")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3c4043] text-sm font-medium">
            {participants.length}
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-bloom-orange-glow text-sm font-medium uppercase">
            {userName.charAt(0)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Video Grid */}
        <div
          className={cn(
            "flex flex-1 items-center justify-center p-4 transition-all duration-300",
            (showChat || showParticipants) && "mr-80"
          )}
        >
          <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl bg-[#3c4043]">
            {/* Video Element */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                "h-full w-full object-cover",
                !isVideoEnabled && "hidden"
              )}
            />

            {/* Video Off Placeholder */}
            {!isVideoEnabled && (
              <div className="flex h-full w-full items-center justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-bloom-orange-glow text-4xl font-medium uppercase md:h-32 md:w-32 md:text-5xl">
                  {userName.charAt(0)}
                </div>
              </div>
            )}

            {/* Video Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity hover:opacity-100">
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                    </svg>
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Name Label */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
              {userName}
              {!isAudioEnabled && (
                <MicOff className="h-4 w-4 text-red-400" />
              )}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        {(showChat || showParticipants) && (
          <aside className="absolute right-0 top-0 flex h-full w-80 flex-col border-l border-white/10 bg-[#202124] animate-slide-in-right">
            {showChat && (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h3 className="text-lg font-medium">In-call messages</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => setShowChat(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Chat Settings */}
                <div className="border-b border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/70">
                      Let participants send messages
                    </span>
                    <Switch
                      checked={allowMessages}
                      onCheckedChange={setAllowMessages}
                    />
                  </div>
                </div>

                {/* Chat Info */}
                <div className="flex gap-3 border-b border-white/10 px-4 py-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                    <MessageSquare className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/90">
                      Continuous chat is OFF
                    </p>
                    <p className="mt-1 text-xs text-white/50">
                      Messages won't be saved when the call ends.
                    </p>
                  </div>
                </div>

                {/* Messages */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto px-4 py-4"
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-center text-sm text-white/50">
                      No messages yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {chatMessages.map((msg) => (
                        <div key={msg.id}>
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {msg.userName}
                            </span>
                            <span className="text-xs text-white/40">
                              {formatTime(new Date(msg.createdAt))}
                            </span>
                          </div>
                          <p className="text-sm text-white/80">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="border-t border-white/10 p-4">
                  <div className="flex items-center gap-2 rounded-full bg-[#3c4043] px-4 py-2">
                    <Input
                      type="text"
                      placeholder="Send a message"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      className="h-8 flex-1 border-0 bg-transparent p-0 text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-primary hover:bg-white/10"
                      onClick={sendMessage}
                      disabled={!chatInput.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {showParticipants && (
              <>
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <h3 className="text-lg font-medium">People</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => setShowParticipants(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-bloom-orange-glow text-sm font-medium uppercase">
                        {p.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {p.name} {p.isLocal && "(You)"}
                        </p>
                      </div>
                      {p.isMuted && <MicOff className="h-4 w-4 text-white/50" />}
                    </div>
                  ))}
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Controls */}
      <footer className="flex h-20 items-center justify-between px-4">
        {/* Left: Time & Room ID */}
        <div className="flex min-w-[200px] items-center gap-2 text-sm text-white/70">
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/30">|</span>
          <span className="font-mono">{roomId}</span>
        </div>

        {/* Center: Main Controls */}
        <div className="flex items-center gap-2">
          {/* Mic */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              isAudioEnabled
                ? "bg-[#3c4043] text-white hover:bg-[#4a4d51]"
                : "bg-[#ea4335] text-white hover:bg-[#d33426]"
            )}
            onClick={toggleAudio}
          >
            {isAudioEnabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>

          {/* Camera */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              isVideoEnabled
                ? "bg-[#3c4043] text-white hover:bg-[#4a4d51]"
                : "bg-[#ea4335] text-white hover:bg-[#d33426]"
            )}
            onClick={toggleVideo}
          >
            {isVideoEnabled ? (
              <Video className="h-5 w-5" />
            ) : (
              <VideoOff className="h-5 w-5" />
            )}
          </Button>

          {/* Screen Share */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full transition-all",
              isScreenSharing
                ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#7aa8f0]"
                : "bg-[#3c4043] text-white hover:bg-[#4a4d51]"
            )}
            onClick={toggleScreenShare}
          >
            <MonitorUp className="h-5 w-5" />
          </Button>

          {/* Reactions */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4d51]"
          >
            <Smile className="h-5 w-5" />
          </Button>

          {/* Captions */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4d51]"
          >
            <span className="text-xs font-bold">CC</span>
          </Button>

          {/* Raise Hand */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4d51]"
          >
            <Hand className="h-5 w-5" />
          </Button>

          {/* More Options */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-[#3c4043] text-white hover:bg-[#4a4d51]"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>

          {/* Leave */}
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-[#ea4335] text-white hover:bg-[#d33426]"
            onClick={handleLeave}
          >
            <Phone className="h-5 w-5 rotate-[135deg]" />
          </Button>
        </div>

        {/* Right: Additional Controls */}
        <div className="flex min-w-[200px] items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Info className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full transition-all",
              showChat
                ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#7aa8f0]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
            }}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full transition-all",
              showParticipants
                ? "bg-[#8ab4f8] text-[#202124] hover:bg-[#7aa8f0]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
            }}
          >
            <Users className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Shield className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
