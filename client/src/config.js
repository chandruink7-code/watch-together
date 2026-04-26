// Centralised config so the dev URL is easy to change.
export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

// Public Google STUN servers — fine for development.
// For production add a TURN server (e.g. coturn / Twilio) for NAT traversal.
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Sync tuning constants.
export const HEARTBEAT_INTERVAL_MS = 3000; // every 3s, per spec
export const DRIFT_THRESHOLD_SEC = 0.3;    // > 0.3s triggers correction
