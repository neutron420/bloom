"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import MeetingRoom from "../../../components/MeetingRoom";
import PreJoinScreen from "../../../components/PreJoinScreen";
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

  // Set name and show prejoin directly - skip name input
  useEffect(() => {
    if (!authLoading) {
      const userName = user?.name || "Guest";
      setName(userName);
      setShowPreJoin(true);
    }
  }, [user, authLoading]);

  const handlePreJoinJoin = (stream: MediaStream) => {
    setPreJoinStream(stream);
    setShowPreJoin(false);
    setHasJoined(true);
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
        userName={name}
        onJoin={handlePreJoinJoin}
      />
    );
  }

  if (hasJoined) {
    return <MeetingRoom roomId={roomId} userName={name} token={token} initialStream={preJoinStream} />;
  }

  return null;
}

