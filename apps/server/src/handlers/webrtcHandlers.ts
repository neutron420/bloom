import { Server, Socket } from "socket.io";
import type { 
  Router, 
  WebRtcTransport, 
  Producer, 
  Consumer,
  DtlsParameters,
  IceParameters,
  IceCandidate,
  RtpCapabilities,
} from "mediasoup/node/lib/types";
import {
  getOrCreateRouter,
  getRouter,
  mediasoupTransports,
  getTransportConfig,
  cleanupMediaSoupResources,
} from "../config/mediasoup.js";
import { socketConnections } from "../store/connectionStore.js";
import { logger } from "../utils/logger.js";

export function setupWebRTCHandlers(io: Server, socket: Socket): void {
  // Get router RTP capabilities
  socket.on("get-router-rtp-capabilities", async ({ roomId }: { roomId: string }) => {
    await handleGetRouterRtpCapabilities(io, socket, roomId);
  });

  // Create WebRTC transport (for sending)
  socket.on("create-transport", async ({ roomId, direction }: { roomId: string; direction: "send" | "recv" }) => {
    await handleCreateTransport(io, socket, roomId, direction);
  });

  // Connect transport
  socket.on("connect-transport", async ({ 
    transportId, 
    dtlsParameters 
  }: { 
    transportId: string; 
    dtlsParameters: DtlsParameters;
  }) => {
    await handleConnectTransport(io, socket, transportId, dtlsParameters);
  });

  // Produce (start sending video/audio)
  socket.on("produce", async ({
    transportId,
    kind,
    rtpParameters,
  }: {
    transportId: string;
    kind: "audio" | "video";
    rtpParameters: any;
  }) => {
    await handleProduce(io, socket, transportId, kind, rtpParameters);
  });

  // Stop producing
  socket.on("stop-producing", async ({ producerId }: { producerId: string }) => {
    await handleStopProducing(io, socket, producerId);
  });

  // Resume/Pause consumer
  socket.on("resume-consumer", async ({ consumerId }: { consumerId: string }) => {
    await handleResumeConsumer(io, socket, consumerId);
  });

  socket.on("pause-consumer", async ({ consumerId }: { consumerId: string }) => {
    await handlePauseConsumer(io, socket, consumerId);
  });

  // Consume existing producer (when joining room with existing participants)
  socket.on("consume-producer", async ({
    producerId,
    rtpCapabilities,
  }: {
    producerId: string;
    rtpCapabilities: RtpCapabilities;
  }) => {
    await handleConsumeProducer(io, socket, producerId, rtpCapabilities);
  });
}

async function handleGetRouterRtpCapabilities(
  io: Server,
  socket: Socket,
  roomId: string
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection || connection.roomId !== roomId) {
      socket.emit("webrtc-error", { message: "Not connected to this room" });
      return;
    }

    const router = await getOrCreateRouter(roomId);
    const rtpCapabilities = router.rtpCapabilities;

    socket.emit("router-rtp-capabilities", {
      rtpCapabilities,
      iceServers: getTransportConfig().iceServers,
    });
  } catch (error) {
    logger.error("Error getting router RTP capabilities", { error, socketId: socket.id, roomId });
    socket.emit("webrtc-error", { message: "Failed to get router capabilities" });
  }
}

async function handleCreateTransport(
  io: Server,
  socket: Socket,
  roomId: string,
  direction: "send" | "recv"
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection || connection.roomId !== roomId) {
      socket.emit("webrtc-error", { message: "Not connected to this room" });
      return;
    }

    const router = await getOrCreateRouter(roomId);
    
    // Initialize transport data if not exists
    if (!mediasoupTransports.has(socket.id)) {
      mediasoupTransports.set(socket.id, {
        producers: new Map(),
        consumers: new Map(),
      });
    }

    const transportData = mediasoupTransports.get(socket.id)!;

    // Create transport based on direction
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: "127.0.0.1", announcedIp: undefined }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000,
    });

    if (direction === "send") {
      transportData.sendTransport = transport;
    } else {
      transportData.recvTransport = transport;
    }

    // Handle transport events
    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });

    transport.on("icestatechange", (iceState) => {
      logger.debug("Transport ICE state changed", { transportId: transport.id, iceState, socketId: socket.id });
    });

    transport.on("icecandidate", (event) => {
      socket.emit("transport-ice-candidate", {
        transportId: transport.id,
        candidate: event.candidate,
      });
    });

    transport.on("connect", () => {
      logger.debug("Transport connected", { transportId: transport.id, socketId: socket.id });
    });

    // Send transport parameters to client
    socket.emit("transport-created", {
      transportId: transport.id,
      direction,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  } catch (error) {
    logger.error("Error creating transport", { error, socketId: socket.id, roomId, direction });
    socket.emit("webrtc-error", { message: "Failed to create transport" });
  }
}

async function handleConnectTransport(
  io: Server,
  socket: Socket,
  transportId: string,
  dtlsParameters: DtlsParameters
): Promise<void> {
  try {
    const transportData = mediasoupTransports.get(socket.id);
    if (!transportData) {
      socket.emit("webrtc-error", { message: "Transport not found" });
      return;
    }

    const transport = transportData.sendTransport?.id === transportId
      ? transportData.sendTransport
      : transportData.recvTransport?.id === transportId
      ? transportData.recvTransport
      : null;

    if (!transport) {
      socket.emit("webrtc-error", { message: "Transport not found" });
      return;
    }

    await transport.connect({ dtlsParameters });
    socket.emit("transport-connected", { transportId });
  } catch (error) {
    logger.error("Error connecting transport", { error, socketId: socket.id, transportId });
    socket.emit("webrtc-error", { message: "Failed to connect transport" });
  }
}

async function handleProduce(
  io: Server,
  socket: Socket,
  transportId: string,
  kind: "audio" | "video",
  rtpParameters: any
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("webrtc-error", { message: "Not connected to a room" });
      return;
    }

    const transportData = mediasoupTransports.get(socket.id);
    if (!transportData || !transportData.sendTransport) {
      socket.emit("webrtc-error", { message: "Send transport not found" });
      return;
    }

    const producer = await transportData.sendTransport.produce({
      kind,
      rtpParameters,
    });

    transportData.producers.set(producer.id, producer);

    // Notify other participants in the room about new producer
    socket.to(connection.roomId).emit("new-producer", {
      producerId: producer.id,
      socketId: socket.id,
      userId: connection.userId,
      userName: connection.name,
      kind: producer.kind,
    });

    // Send producer ID to the producer
    socket.emit("producer-created", {
      producerId: producer.id,
      kind: producer.kind,
    });

    // Handle producer events
    producer.on("transportclose", () => {
      transportData.producers.delete(producer.id);
    });

    logger.info("Producer created", { producerId: producer.id, kind, userId: connection.userId, userName: connection.name });
  } catch (error) {
    logger.error("Error creating producer", { error, socketId: socket.id });
    socket.emit("webrtc-error", { message: "Failed to create producer" });
  }
}

async function handleStopProducing(
  io: Server,
  socket: Socket,
  producerId: string
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("webrtc-error", { message: "Not connected to a room" });
      return;
    }

    const transportData = mediasoupTransports.get(socket.id);
    if (!transportData) {
      socket.emit("webrtc-error", { message: "Transport not found" });
      return;
    }

    const producer = transportData.producers.get(producerId);
    if (!producer) {
      socket.emit("webrtc-error", { message: "Producer not found" });
      return;
    }

    producer.close();
    transportData.producers.delete(producerId);

    // Notify other participants
    socket.to(connection.roomId).emit("producer-closed", {
      producerId,
      socketId: socket.id,
    });

    socket.emit("producer-stopped", { producerId });
  } catch (error) {
    logger.error("Error stopping producer", { error, socketId: socket.id, producerId });
    socket.emit("webrtc-error", { message: "Failed to stop producer" });
  }
}

async function handleResumeConsumer(
  io: Server,
  socket: Socket,
  consumerId: string
): Promise<void> {
  try {
    const transportData = mediasoupTransports.get(socket.id);
    if (!transportData) {
      socket.emit("webrtc-error", { message: "Transport not found" });
      return;
    }

    const consumer = transportData.consumers.get(consumerId);
    if (!consumer) {
      socket.emit("webrtc-error", { message: "Consumer not found" });
      return;
    }

    await consumer.resume();
    socket.emit("consumer-resumed", { consumerId });
  } catch (error) {
    console.error("Error resuming consumer:", error);
    socket.emit("webrtc-error", { message: "Failed to resume consumer" });
  }
}

async function handlePauseConsumer(
  io: Server,
  socket: Socket,
  consumerId: string
): Promise<void> {
  try {
    const transportData = mediasoupTransports.get(socket.id);
    if (!transportData) {
      socket.emit("webrtc-error", { message: "Transport not found" });
      return;
    }

    const consumer = transportData.consumers.get(consumerId);
    if (!consumer) {
      socket.emit("webrtc-error", { message: "Consumer not found" });
      return;
    }

    await consumer.pause();
    socket.emit("consumer-paused", { consumerId });
  } catch (error) {
    console.error("Error pausing consumer:", error);
    socket.emit("webrtc-error", { message: "Failed to pause consumer" });
  }
}

/**
 * Handle consume producer request
 */
async function handleConsumeProducer(
  io: Server,
  socket: Socket,
  producerId: string,
  rtpCapabilities: RtpCapabilities
): Promise<void> {
  try {
    const connection = socketConnections[socket.id];
    if (!connection) {
      socket.emit("webrtc-error", { message: "Not connected to a room" });
      return;
    }

    const router = getRouter(connection.roomId);
    if (!router) {
      socket.emit("webrtc-error", { message: "Router not found" });
      return;
    }

    const transportData = mediasoupTransports.get(socket.id);
    if (!transportData || !transportData.recvTransport) {
      socket.emit("webrtc-error", { message: "Receive transport not found" });
      return;
    }

    // Check if router can consume this producer
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      socket.emit("webrtc-error", { message: "Cannot consume this producer" });
      return;
    }

    // Create consumer
    const consumer = await transportData.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
    });

    transportData.consumers.set(consumer.id, consumer);

    // Send consumer to client
    socket.emit("consumer-created", {
      consumerId: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    });

    // Handle consumer events
    consumer.on("transportclose", () => {
      transportData.consumers.delete(consumer.id);
    });

    logger.info("Consumer created", { consumerId: consumer.id, producerId, socketId: socket.id });
  } catch (error) {
    logger.error("Error creating consumer", { error, socketId: socket.id, producerId });
    socket.emit("webrtc-error", { message: "Failed to create consumer" });
  }
}

