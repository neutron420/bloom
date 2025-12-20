import { socketConnections } from "../store/connectionStore.js";

// Rate limiting for Socket.IO events
const messageRateLimits = new Map<string, { count: number; resetAt: number }>();
const requestRateLimits = new Map<string, { count: number; resetAt: number }>();

const MESSAGE_RATE_LIMIT = 30; // Max 30 messages per minute
const REQUEST_RATE_LIMIT = 10; // Max 10 requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

export function checkMessageRateLimit(socketId: string): boolean {
  const now = Date.now();
  const limit = messageRateLimits.get(socketId);

  if (!limit || now > limit.resetAt) {
    messageRateLimits.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= MESSAGE_RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

export function checkRequestRateLimit(socketId: string): boolean {
  const now = Date.now();
  const limit = requestRateLimits.get(socketId);

  if (!limit || now > limit.resetAt) {
    requestRateLimits.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (limit.count >= REQUEST_RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

export function clearSocketRateLimit(socketId: string): void {
  messageRateLimits.delete(socketId);
  requestRateLimits.delete(socketId);
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [socketId, limit] of messageRateLimits.entries()) {
    if (now > limit.resetAt) {
      messageRateLimits.delete(socketId);
    }
  }
  for (const [socketId, limit] of requestRateLimits.entries()) {
    if (now > limit.resetAt) {
      requestRateLimits.delete(socketId);
    }
  }
}, 5 * 60 * 1000); // Cleanup every 5 minutes

