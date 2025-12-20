"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const meetingId = params.id as string;
  const name = searchParams.get("name") || "Guest";

  const [participants, setParticipants] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Clean up existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Create new socket connection
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    const handleConnect = () => {
      console.log("Connected to server, joining room:", meetingId, "as", name);
      socket.emit("join-room", { roomId: meetingId, name });
    };

    const handleParticipants = (list: string[]) => {
      console.log(`[${name}] Participants received:`, list);
      setParticipants(list);
    };

    // Set up event listeners
    socket.on("connect", handleConnect);
    socket.on("participants", handleParticipants);
    socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
    });

    // If already connected, join immediately
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      console.log(`[${name}] Cleaning up socket`);
      if (socket) {
        socket.off("connect", handleConnect);
        socket.off("participants", handleParticipants);
        socket.off("connect_error");
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [meetingId, name]);

  return (
    <div style={{ padding: "20px", display: "flex", gap: "40px" }}>
      <div>
        <h1>Meeting Room</h1>
        <p><strong>Meeting ID:</strong> {meetingId}</p>
        <p><strong>You:</strong> {name}</p>
      </div>

      <div>
        <h3>Participants ({participants.length})</h3>
        <ul>
          {participants.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
