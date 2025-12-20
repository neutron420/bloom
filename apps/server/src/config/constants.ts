// Connection limits
export const MAX_CONNECTIONS_PER_ROOM = 200; // Max users per room
export const MAX_TOTAL_CONNECTIONS = 10000; // Max total connections globally
export const MAX_ROOMS = 1000; // Max concurrent rooms

// Rate limiting
export const MAX_JOIN_ATTEMPTS = 10; // Max 10 join attempts per minute
export const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Participant update debounce
export const PARTICIPANT_UPDATE_DEBOUNCE_MS = 100; // Batch updates within 100ms

// Input validation
export const MAX_ROOM_ID_LENGTH = 100;
export const MAX_NAME_LENGTH = 100;
export const MAX_MESSAGE_LENGTH = 1000; // Max chat message length

