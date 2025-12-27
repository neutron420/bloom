import { useState, useRef, useEffect } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Settings,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PreJoinScreenProps {
  roomId: string;
  initialName?: string;
  onJoin: (name: string) => void;
  onBack: () => void;
}

export function PreJoinScreen({
  roomId,
  initialName = "",
  onJoin,
  onBack,
}: PreJoinScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState(initialName);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setStream(mediaStream);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to access media devices:", error);
        toast.error("Could not access camera or microphone");
        setIsLoading(false);
      }
    };

    initMedia();

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
      }
    }
  };

  const handleJoin = () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    onJoin(name.trim());
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-16 items-center justify-between border-b border-border px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full hover:bg-secondary"
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-bloom-orange-glow">
              <svg
                className="h-6 w-6 text-primary-foreground"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
              </svg>
            </div>
            <span className="hidden font-display text-xl font-medium text-foreground md:block">
              Bloom
            </span>
          </div>
        </div>
        
        {/* User Info */}
        {initialName && initialName !== "Guest" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden md:block">{initialName}</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-bloom-orange-glow text-xs font-medium uppercase text-primary-foreground">
              {initialName.charAt(0)}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="flex w-full max-w-5xl flex-col items-center gap-8 md:flex-row md:items-start md:gap-12">
          {/* Video Preview */}
          <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-2xl bg-secondary">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={cn(
                    "h-full w-full object-cover",
                    !isVideoEnabled && "hidden"
                  )}
                />
                {!isVideoEnabled && (
                  <div className="flex h-full items-center justify-center bg-muted">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-bloom-orange-glow text-4xl font-medium uppercase text-primary-foreground">
                      {name.charAt(0) || "?"}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Controls Overlay */}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full backdrop-blur-md transition-all",
                  isAudioEnabled
                    ? "bg-foreground/10 text-foreground hover:bg-foreground/20"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={toggleAudio}
              >
                {isAudioEnabled ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-12 w-12 rounded-full backdrop-blur-md transition-all",
                  isVideoEnabled
                    ? "bg-foreground/10 text-foreground hover:bg-foreground/20"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                )}
                onClick={toggleVideo}
              >
                {isVideoEnabled ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-full bg-foreground/10 text-foreground backdrop-blur-md hover:bg-foreground/20"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Join Panel */}
          <div className="flex w-full max-w-sm flex-col items-center text-center md:items-start md:text-left">
            <h1 className="mb-2 text-2xl font-normal text-foreground md:text-3xl">
              Ready to join?
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Meeting code: <span className="font-mono">{roomId}</span>
            </p>

            <div className="mb-4 w-full">
              <Input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                className="h-12 rounded-lg border-input bg-background px-4 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
              />
            </div>

            <Button
              onClick={handleJoin}
              disabled={!name.trim()}
              className="h-12 w-full rounded-full bg-primary px-8 text-base font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Join now
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">
              By joining, you agree to let Bloom access your camera and
              microphone.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
