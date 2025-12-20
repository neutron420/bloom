import { joinAttempts } from "../store/connectionStore.js";
import { MAX_JOIN_ATTEMPTS, RATE_LIMIT_WINDOW } from "../config/constants.js";

export function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const attempts = joinAttempts.get(socketId);
  
  if (!attempts || now > attempts.resetAt) {
    joinAttempts.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (attempts.count >= MAX_JOIN_ATTEMPTS) {
    return false;
  }
  
  attempts.count++;
  return true;
}

export function clearRateLimit(socketId: string): void {
  joinAttempts.delete(socketId);
}

