import mediasoup from "mediasoup";
import type { Worker, Router, WebRtcTransport } from "mediasoup/node/lib/types";

// MediaSoup configuration
const MEDIASOUP_CONFIG = {
  numWorkers: process.env.MEDIASOUP_NUM_WORKERS 
    ? parseInt(process.env.MEDIASOUP_NUM_WORKERS) 
    : 1, // Number of worker processes
  worker: {
    rtcMinPort: process.env.MEDIASOUP_RTC_MIN_PORT 
      ? parseInt(process.env.MEDIASOUP_RTC_MIN_PORT) 
      : 40000,
    rtcMaxPort: process.env.MEDIASOUP_RTC_MAX_PORT 
      ? parseInt(process.env.MEDIASOUP_RTC_MAX_PORT) 
      : 49999,
    logLevel: "warn" as const,
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"] as const,
  },
  router: {
    mediaCodecs: [
      {
        kind: "audio" as const,
        mimeType: "audio/opus",
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: "video" as const,
        mimeType: "video/VP8",
        clockRate: 90000,
        parameters: {
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video" as const,
        mimeType: "video/VP9",
        clockRate: 90000,
        parameters: {
          "profile-id": 2,
          "x-google-start-bitrate": 1000,
        },
      },
      {
        kind: "video" as const,
        mimeType: "video/h264",
        clockRate: 90000,
        parameters: {
          "packetization-mode": 1,
          "profile-level-id": "42e01f",
          "level-asymmetry-allowed": 1,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: process.env.MEDIASOUP_LISTEN_IP || "127.0.0.1",
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
      },
    ],
    initialAvailableOutgoingBitrate: 1000000, // 1 Mbps
    minimumAvailableOutgoingBitrate: 600000, // 600 Kbps
    maxIncomingBitrate: 1500000, // 1.5 Mbps
  },
};

// Store workers and routers
let workers: Worker[] = [];
let nextWorkerIndex = 0;

// roomId -> Router
export const mediasoupRouters = new Map<string, Router>();

// socketId -> { transport, producer, consumers }
export const mediasoupTransports = new Map<
  string,
  {
    sendTransport?: WebRtcTransport;
    recvTransport?: WebRtcTransport;
    producers: Map<string, any>; // producerId -> Producer
    consumers: Map<string, any>; // consumerId -> Consumer
  }
>();

/**
 * Initialize MediaSoup workers
 */
export async function createWorkers(): Promise<void> {
  const numWorkers = MEDIASOUP_CONFIG.numWorkers;

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      ...MEDIASOUP_CONFIG.worker,
      logLevel: MEDIASOUP_CONFIG.worker.logLevel,
      logTags: MEDIASOUP_CONFIG.worker.logTags,
    });

    worker.on("died", () => {
      console.error("MediaSoup worker died, exiting in 2 seconds...");
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
    console.log(`MediaSoup worker ${i} created [pid:${worker.pid}]`);
  }

  console.log(`MediaSoup: ${workers.length} worker(s) created`);
}

/**
 * Get or create a MediaSoup router for a room
 */
export async function getOrCreateRouter(roomId: string): Promise<Router> {
  // Check if router already exists
  if (mediasoupRouters.has(roomId)) {
    return mediasoupRouters.get(roomId)!;
  }

  // Ensure workers are initialized
  if (workers.length === 0) {
    throw new Error("MediaSoup workers not initialized. Call createWorkers() first.");
  }

  // Get next worker (round-robin)
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

  // Create router
  const router = await worker.createRouter({
    mediaCodecs: MEDIASOUP_CONFIG.router.mediaCodecs,
  });

  mediasoupRouters.set(roomId, router);
  console.log(`MediaSoup router created for room: ${roomId}`);

  return router;
}

/**
 * Get router for a room
 */
export function getRouter(roomId: string): Router | undefined {
  return mediasoupRouters.get(roomId);
}

/**
 * Delete router for a room
 */
export function deleteRouter(roomId: string): void {
  const router = mediasoupRouters.get(roomId);
  if (router) {
    router.close();
    mediasoupRouters.delete(roomId);
    console.log(`MediaSoup router deleted for room: ${roomId}`);
  }
}

/**
 * Get transport configuration for client
 */
export function getTransportConfig(): {
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  iceTransportPolicy?: "all" | "relay";
} {
  return {
    iceServers: [
      {
        urls: process.env.MEDIASOUP_ICE_SERVERS 
          ? process.env.MEDIASOUP_ICE_SERVERS.split(",")
          : ["stun:stun.l.google.com:19302"],
      },
    ],
    iceTransportPolicy: "all",
  };
}

/**
 * Cleanup MediaSoup resources for a socket
 */
export function cleanupMediaSoupResources(socketId: string): void {
  const transportData = mediasoupTransports.get(socketId);
  if (!transportData) return;

  // Close all producers
  transportData.producers.forEach((producer) => {
    try {
      producer.close();
    } catch (error) {
      console.error("Error closing producer:", error);
    }
  });

  // Close all consumers
  transportData.consumers.forEach((consumer) => {
    try {
      consumer.close();
    } catch (error) {
      console.error("Error closing consumer:", error);
    }
  });

  // Close transports
  if (transportData.sendTransport) {
    try {
      transportData.sendTransport.close();
    } catch (error) {
      console.error("Error closing send transport:", error);
    }
  }

  if (transportData.recvTransport) {
    try {
      transportData.recvTransport.close();
    } catch (error) {
      console.error("Error closing recv transport:", error);
    }
  }

  mediasoupTransports.delete(socketId);
}

/**
 * Close all MediaSoup workers (for graceful shutdown)
 */
export async function closeWorkers(): Promise<void> {
  for (const worker of workers) {
    worker.close();
  }
  workers = [];
  console.log("All MediaSoup workers closed");
}

