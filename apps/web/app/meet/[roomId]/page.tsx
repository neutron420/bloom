"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MeetingRoom } from "../../../components/MeetingRoom";
import { PreJoinScreen } from "../../../components/PreJoinScreen";
import { useAuth } from "../../../contexts/AuthContext";

export default function MeetPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [showPreJoin, setShowPreJoin] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [preJoinStream, setPreJoinStream] = useState<MediaStream | null>(null);

  const roomId = params?.roomId as string;

  // Set name and decide whether to show prejoin or auto-join (cached)
  useEffect(() => {
    if (authLoading) return;

    const userName = user?.name || "Guest";
    setName(userName);

    // Try to auto-join if we have cached meeting data for this room
    if (typeof window !== "undefined") {
      try {
        const cached = window.localStorage.getItem("bloom_last_meeting");
        if (cached) {
          const data = JSON.parse(cached) as {
            roomId: string;
            userName: string;
            joinedAt?: number;
          };

          if (data.roomId === roomId && data.userName === userName) {
            // Auto-join directly into MeetingRoom; it will recreate media stream
            setShowPreJoin(false);
            setHasJoined(true);
            return;
          }
        }
      } catch (error) {
        console.error("Failed to read cached meeting info:", error);
      }
    }

    // Default: show prejoin screen
    setShowPreJoin(true);
  }, [user, authLoading, roomId]);

  const handlePreJoinJoin = (joinName: string) => {
    setShowPreJoin(false);
    setHasJoined(true);
    setName(joinName);

    // Cache last joined meeting so refresh can auto-join
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          "bloom_last_meeting",
          JSON.stringify({
            roomId,
            userName: joinName || "Guest",
            joinedAt: Date.now(),
          }),
        );
      } catch (error) {
        console.error("Failed to cache meeting info:", error);
      }
    }
  };

  if (!roomId) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <p>Invalid meeting link</p>
      </div>
    );
  }

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#202124" }}>
        <div style={{ color: "white" }}>Loading...</div>
      </div>
    );
  }

  if (showPreJoin) {
    return (
      <PreJoinScreen
        roomId={roomId}
        initialName={name}
        onJoin={handlePreJoinJoin}
        onBack={() => router.push("/")}
      />
    );
  }

  if (hasJoined) {
    return <MeetingRoom roomId={roomId} userName={name} />;
  }

  return null;
}

