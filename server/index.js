/**
 * Watch Together — Server
 * ------------------------------------------------------------
 * Responsibilities:
 *   1. Room management (create / join / leave)
 *   2. Relay playback sync events (play, pause, seek, drift)
 *   3. Relay WebRTC signaling (offer, answer, ICE candidates)
 *   4. Relay chat messages
 *
 * It does NOT store, transcode, or stream video. Each client
 * loads the video file locally; we only synchronize state.
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Simple healthcheck
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'watch-together-server' });
});

// REST endpoint to create a room. We could also do this purely
// over the socket, but a REST call keeps the join URL flow clean.
app.post('/api/rooms', (req, res) => {
  const roomId = nanoid(8);
  const name = (req.body && req.body.name) || `Room ${roomId}`;
  rooms.set(roomId, { id: roomId, name, users: new Map(), videoState: null });
  res.json({ roomId, name });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  // A small ping interval helps detect disconnects faster, which
  // matters for the "user disconnects → show status" requirement.
  pingInterval: 10000,
  pingTimeout: 5000,
});

/**
 * In-memory room registry.
 *   rooms: Map<roomId, { id, name, users: Map<socketId, user>, videoState }>
 *   videoState: { isPlaying: boolean, currentTime: number, updatedAt: number }
 *               -- the last known authoritative state, so late joiners
 *                  can sync to "where everyone is".
 */
const rooms = new Map();

function getRoomPublic(room) {
  return {
    id: room.id,
    name: room.name,
    users: Array.from(room.users.values()).map(u => ({
      id: u.id,
      name: u.name,
    })),
    videoState: room.videoState,
  };
}

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  /* ---------------------- ROOM JOIN / LEAVE ---------------------- */

  socket.on('room:join', ({ roomId, userName }, ack) => {
    let room = rooms.get(roomId);
    // Allow joining via shared link even if the room wasn't created
    // via REST first — auto-create it. Simpler UX for the MVP.
    if (!room) {
      room = { id: roomId, name: `Room ${roomId}`, users: new Map(), videoState: null };
      rooms.set(roomId, room);
    }

    const user = {
      id: socket.id,
      name: userName || `Guest-${socket.id.slice(0, 4)}`,
    };
    room.users.set(socket.id, user);

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.user = user;

    // Tell the joiner who is already in the room (so they can initiate
    // WebRTC offers to existing peers).
    const peers = Array.from(room.users.values()).filter(u => u.id !== socket.id);

    if (typeof ack === 'function') {
      ack({
        ok: true,
        room: getRoomPublic(room),
        peers,
        you: user,
      });
    }

    // Notify everyone else that a new user joined.
    socket.to(roomId).emit('room:user-joined', { user });
    console.log(`[join] ${user.name} (${socket.id}) -> ${roomId}`);
  });

  socket.on('room:leave', () => leaveCurrentRoom(socket));

  /* ---------------------- VIDEO SYNC ---------------------- */
  /**
   * The sync protocol is intentionally tiny:
   *
   *   client -> server: 'video:action' { action, currentTime }
   *   server -> other clients in room: same payload + senderId
   *
   * The server also caches the latest videoState so a late joiner
   * can request 'video:request-sync' and immediately know where to be.
   *
   * Drift correction:
   *   Every 3s each client emits 'video:heartbeat' with its currentTime.
   *   The server forwards it to peers so they can compare and self-correct.
   */

  socket.on('video:action', (payload) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;

    const { action, currentTime } = payload || {};
    if (!['play', 'pause', 'seek', 'buffering', 'ready'].includes(action)) return;

    // Cache last authoritative-ish state for late joiners.
    room.videoState = {
      isPlaying: action === 'play',
      currentTime: typeof currentTime === 'number' ? currentTime : 0,
      updatedAt: Date.now(),
    };

    socket.to(socket.data.roomId).emit('video:action', {
      ...payload,
      senderId: socket.id,
      serverTime: Date.now(),
    });
  });

  socket.on('video:heartbeat', ({ currentTime, isPlaying }) => {
    if (!socket.data.roomId) return;
    socket.to(socket.data.roomId).emit('video:heartbeat', {
      senderId: socket.id,
      currentTime,
      isPlaying,
      serverTime: Date.now(),
    });
  });

  // Late joiner asks "where is everyone right now?"
  socket.on('video:request-sync', (_payload, ack) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return ack && ack(null);

    // Forward the request to the other peers; the first to reply wins.
    // For an MVP we just return our cached state.
    if (typeof ack === 'function') ack(room.videoState || null);

    // Also ask peers to broadcast a fresh heartbeat so the late joiner
    // gets an exact value rather than a stale cached one.
    socket.to(socket.data.roomId).emit('video:request-heartbeat', {
      requesterId: socket.id,
    });
  });

  /* ---------------------- WEBRTC SIGNALING ---------------------- */
  /**
   * Pure relay — the server never sees media. We just forward the
   * SDP offer/answer and ICE candidates between two peers.
   */

  socket.on('rtc:offer', ({ to, sdp }) => {
    io.to(to).emit('rtc:offer', { from: socket.id, sdp });
  });

  socket.on('rtc:answer', ({ to, sdp }) => {
    io.to(to).emit('rtc:answer', { from: socket.id, sdp });
  });

  socket.on('rtc:ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('rtc:ice-candidate', { from: socket.id, candidate });
  });

  /* ---------------------- CHAT ---------------------- */

  socket.on('chat:message', ({ text }) => {
    if (!socket.data.roomId || !socket.data.user) return;
    const trimmed = (text || '').toString().slice(0, 500);
    if (!trimmed) return;
    io.to(socket.data.roomId).emit('chat:message', {
      id: nanoid(6),
      from: socket.data.user,
      text: trimmed,
      ts: Date.now(),
    });
  });

  /* ---------------------- DISCONNECT ---------------------- */

  socket.on('disconnect', (reason) => {
    console.log(`[disconnect] ${socket.id} (${reason})`);
    leaveCurrentRoom(socket);
  });
});

function leaveCurrentRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const user = room.users.get(socket.id);
  room.users.delete(socket.id);
  socket.leave(roomId);
  socket.data.roomId = null;

  if (user) {
    io.to(roomId).emit('room:user-left', { user });
  }

  // Clean up empty rooms so memory doesn't grow unbounded.
  if (room.users.size === 0) {
    rooms.delete(roomId);
    console.log(`[room] cleaned up ${roomId}`);
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Watch Together server listening on http://localhost:${PORT}`);
});
