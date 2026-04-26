# Watch Together

A minimal but production-quality MVP that lets two (or more) people watch the **same local video file** in sync while talking over WebRTC voice/video.

The server only relays signaling messages — **no video is ever uploaded**. Each participant picks the same file from their own device.

---

## Tech stack

- **Frontend**: React (Vite) + Tailwind CSS + react-router-dom
- **Backend**: Node.js + Express + Socket.IO
- **Realtime media**: WebRTC with public Google STUN servers

---

## Project layout

```
watch-together/
├── client/                      # React + Vite app
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx             # Router entry
│       ├── index.css            # Tailwind directives + custom seek bar
│       ├── config.js            # Server URL, STUN servers, sync constants
│       ├── pages/
│       │   ├── Home.jsx         # Create / join room landing
│       │   └── Room.jsx         # Composes the three subsystems
│       ├── hooks/
│       │   ├── useSocket.js     # Singleton socket + connection status
│       │   ├── useVideoSync.js  # ★ Sync engine (see “Sync logic” below)
│       │   └── useWebRTC.js     # Peer connections + media controls
│       └── components/
│           ├── VideoPlayer.jsx  # Custom <video> + controls
│           ├── CallPanel.jsx    # Mic / cam toggles + peer tiles
│           └── ChatPanel.jsx    # Bonus chat
└── server/                      # Express + Socket.IO signaling/sync relay
    ├── package.json
    └── index.js
```

---

## Running locally

You need Node 18+ and two terminals.

### 1. Start the server

```bash
cd server
npm install
npm run dev          # http://localhost:3001
```

### 2. Start the client

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

### 3. Open in two browsers

1. Open `http://localhost:5173` in two browser windows (or two devices on the same LAN).
2. In window A, enter your name → **Create Room**.
3. Click **Copy link** at the top of the room → paste into window B.
4. **Both users pick the same local video file** (e.g. an `.mp4`).
5. Click **Join call** in either window to enable voice. Camera is optional.
6. Press play on either side — both videos stay in sync, drift-corrected every 3s.

> **HTTPS note:** WebRTC `getUserMedia` works on `http://localhost` but **requires HTTPS** for any other host. To test across devices on a LAN, run the client with `vite --host --https` (Vite will generate a self-signed cert) or put it behind a tunnel like ngrok / Cloudflare Tunnel.

### Optional environment variables

The client reads `VITE_SERVER_URL` (defaults to `http://localhost:3001`):

```bash
# client/.env.local
VITE_SERVER_URL=https://my-signaling-server.example.com
```

---

## Sync logic — how it works

All sync logic lives in [`client/src/hooks/useVideoSync.js`](./client/src/hooks/useVideoSync.js). It's deliberately small.

### Event protocol

| Event | Payload | Direction |
|---|---|---|
| `video:action` | `{ action, currentTime }` where `action ∈ { play, pause, seek, buffering, ready }` | client → server → other peers |
| `video:heartbeat` | `{ currentTime, isPlaying }` | every 3s, both directions |
| `video:request-sync` | — | late joiner → server (server replies with cached state and asks peers for a fresh heartbeat) |

### Echo suppression

When a remote peer's action arrives, we set an `applyingRemoteRef` flag before calling `video.play()` / `video.pause()` / mutating `currentTime`. The resulting native events are then ignored by our own emit handlers — otherwise play/pause would loop forever between peers.

### Drift correction (every 3s)

Each client emits a heartbeat with its `currentTime`. On receiving a peer's heartbeat:

```js
if (Math.abs(peer.currentTime - my.currentTime) > 0.3) {
  video.currentTime = peer.currentTime;   // snap to peer
}
```

The 0.3s threshold is wide enough that natural decoder jitter doesn't trigger constant micro-corrections, but tight enough that out-of-sync moments self-heal within one cycle.

### Late joiner

When a user attaches their video file, we emit `video:request-sync`. The server replies with the last known state (cached from the most recent action) **and** asks peers to broadcast a fresh heartbeat. The joiner snaps `currentTime` accordingly and starts playing if peers were playing.

### Buffering

If the local `<video>` fires `waiting` (decoder ran out of data), we emit `action: 'buffering'`. Peers pause and show a "Peer is buffering…" badge. When `canplay` fires we emit `action: 'ready'` and the original initiator can resume.

---

## WebRTC logic — how it works

Lives in [`client/src/hooks/useWebRTC.js`](./client/src/hooks/useWebRTC.js).

- One `RTCPeerConnection` per remote peer, keyed by socket id.
- The local mic stream is captured once via `getUserMedia` and shared across all PCs.
- **Glare avoidance**: only the peer with the lexicographically smaller socket id sends the `offer`. The other side waits and answers. This prevents both sides offering simultaneously when a new peer joins.
- Mic / camera toggles flip `track.enabled` on the existing track — no SDP renegotiation, so the call stays stable.
- Adding a camera track *does* trigger one renegotiation per peer (only the polite side drives it).

The signaling messages (`rtc:offer`, `rtc:answer`, `rtc:ice-candidate`) are pure relays — the server never touches media.

---

## Architecture rules (per the spec)

- ✅ No video is streamed from the server. Only `play / pause / seek / heartbeat` state messages flow through it.
- ✅ No screen sharing.
- ✅ Video sync and WebRTC use the **same socket transport but separate event namespaces** (`video:*` vs `rtc:*`) and never share state.
- ✅ Rooms are kept in memory and garbage-collected when empty.

---

## What's intentionally out of scope

- No leader election or logical clock — for 2 users in a home network, "trust the last heartbeat" is enough. Scaling to many users would want an authoritative timeline owned by the server.
- No TURN server — STUN handles symmetric NAT failure cases poorly. For real-world deployment add coturn or a managed service (Twilio, Cloudflare Calls).
- No persistence — rooms vanish on server restart.
- No auth — the room link *is* the credential. Don't share it publicly.

---

## Bonus features included

- 💬 **Chat** — sidebar text chat, broadcast through the same socket.
- 🏷️ **Room name** — set when creating, shown in the top bar.
- 📱 **Responsive layout** — sidebar drops below the video on narrow viewports; controls stay accessible on mobile.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Could not reach the server" on Home page | Server not running, or wrong port | `cd server && npm run dev`; verify `:3001` is free |
| Voice call shows "Could not access microphone" | Browser blocked permission, or non-HTTPS host | Re-allow mic permission, use `localhost` or HTTPS |
| Video plays on one side but not the other | Browsers sometimes block autoplay on first remote-triggered `play()` | Click play once manually; subsequent syncs work |
| Constant tiny seeks | Two peers slightly out of sync, drift correction firing | The 0.3s threshold should prevent this — if it persists, check CPU/decode speed; HEVC files on a slow machine can fall behind |
| Peers never see each other's audio | Symmetric NAT — STUN alone can't traverse | Add a TURN server in `client/src/config.js` |

---

## Production checklist (if extending this)

- [ ] Replace public STUN with a hosted STUN+TURN service
- [ ] Move room state out of memory (Redis) so the server can restart / scale horizontally
- [ ] Add rate limits on `chat:message` and `video:action`
- [ ] Sign room links so they expire
- [ ] Add a "verify both peers loaded the same file" check via file hash exchanged over chat
- [ ] Add basic E2E test for the sync protocol
