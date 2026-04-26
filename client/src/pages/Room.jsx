import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket.js';
import useWebRTC from '../hooks/useWebRTC.js';
import useVideoSync from '../hooks/useVideoSync.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import CallPanel from '../components/CallPanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';

/**
 * Room
 * ---------------------------------------------------------------
 * Composes the three independent subsystems:
 *   1. Socket + room membership (useSocket + room:join handshake)
 *   2. Video playback sync (useVideoSync) — purely state, no media
 *   3. WebRTC voice/video (useWebRTC) — purely media, separate channel
 *
 * Each subsystem talks to peers through the same Socket.IO connection
 * but the protocols never overlap (per the architecture rules).
 */
export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userName = searchParams.get('name') || 'Guest';
  const { socket, status } = useSocket();

  // Room state
  const [me, setMe] = useState(null);
  const [peers, setPeers] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  // Video state — the file lives only in the local browser. We never
  // upload it; we only use it as a source for our local <video>.
  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const objectUrlRef = useRef(null);

  /* ---------------- Join the room on connect ---------------- */
  useEffect(() => {
    if (!socket || status !== 'connected') return;

    socket.emit('room:join', { roomId, userName }, (resp) => {
      if (!resp || !resp.ok) {
        setJoinError('Could not join room');
        return;
      }
      setMe(resp.you);
      setPeers(resp.peers || []);
      setRoomName(resp.room?.name || `Room ${roomId}`);
    });

    const onJoined = ({ user }) => {
      setPeers((prev) => (prev.some((p) => p.id === user.id) ? prev : [...prev, user]));
    };
    const onLeft = ({ user }) => {
      setPeers((prev) => prev.filter((p) => p.id !== user.id));
    };

    socket.on('room:user-joined', onJoined);
    socket.on('room:user-left', onLeft);

    return () => {
      socket.off('room:user-joined', onJoined);
      socket.off('room:user-left', onLeft);
    };
  }, [socket, status, roomId, userName]);

  /* ---------------- Hook up sync engine + WebRTC ---------------- */
  const hasVideo = !!videoFile;

  const sync = useVideoSync({
    socket,
    videoRef,
    hasVideo,
  });

  const rtc = useWebRTC({
    socket,
    myId: me?.id,
    peers,
  });

  /* ---------------- Local file handling ---------------- */
  /**
   * When the user picks a file we create an object URL and assign it
   * to the video element. Revoke the previous one to avoid leaking.
   * After the metadata loads, ask peers where they are so we can
   * jump to the right timestamp (handles "joined late" case).
   */
  const handleFilePicked = useCallback((file) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setVideoFile(file);

    const video = videoRef.current;
    if (video) {
      video.src = url;
      const onMeta = () => {
        sync.requestSync();
        video.removeEventListener('loadedmetadata', onMeta);
      };
      video.addEventListener('loadedmetadata', onMeta);
    }
  }, [sync]);

  // Cleanup the object URL on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  /* ---------------- Misc UI handlers ---------------- */
  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  };

  const leaveRoom = () => {
    if (socket) socket.emit('room:leave');
    navigate('/');
  };

  /* ---------------- Render ---------------- */
  const statusColor = {
    connecting: 'bg-yellow-400',
    connected: 'bg-green-400',
    disconnected: 'bg-red-400',
  }[status];

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <header className="border-b border-ink-700 bg-ink-800/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={leaveRoom}
            className="text-ink-500 hover:text-white text-sm flex items-center gap-1"
            title="Leave room"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Home</span>
          </button>

          <div className="h-5 w-px bg-ink-700 hidden sm:block" />

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{roomName}</div>
            <div className="text-[11px] text-ink-500 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
              <span>{status}</span>
              <span>·</span>
              <span>{1 + peers.length} {1 + peers.length === 1 ? 'person' : 'people'} here</span>
            </div>
          </div>

          {/* Peer chips */}
          <div className="flex items-center gap-1.5">
            {me && (
              <span className="bg-accent/20 border border-accent/40 text-xs px-2 py-1 rounded-full">
                {me.name} (you)
              </span>
            )}
            {peers.map((p) => (
              <span key={p.id} className="bg-ink-700 border border-ink-600 text-xs px-2 py-1 rounded-full">
                {p.name}
              </span>
            ))}
          </div>

          <button
            onClick={copyLink}
            className="bg-ink-700 hover:bg-ink-600 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </header>

      {joinError && (
        <div className="max-w-7xl mx-auto w-full px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-lg px-3 py-2">
            {joinError}
          </div>
        </div>
      )}

      {/* Main layout */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Video column */}
        <section className="min-w-0">
          <VideoPlayer
            ref={videoRef}
            onFilePicked={handleFilePicked}
            hasVideo={hasVideo}
            isAnyPeerBuffering={sync.isAnyPeerBuffering}
          />
          {hasVideo && (
            <div className="mt-2 text-xs text-ink-500 flex items-center gap-2">
              <span>Now playing:</span>
              <span className="text-ink-100 truncate">{videoFile.name}</span>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 min-h-0 lg:h-[calc(100vh-7rem)]">
          <CallPanel
            callActive={rtc.callActive}
            micOn={rtc.micOn}
            camOn={rtc.camOn}
            startCall={rtc.startCall}
            endCall={rtc.endCall}
            toggleMic={rtc.toggleMic}
            toggleCam={rtc.toggleCam}
            remoteStreams={rtc.remoteStreams}
            peers={peers}
            error={rtc.error}
          />
          <div className="flex-1 min-h-[300px] lg:min-h-0">
            <ChatPanel socket={socket} me={me} />
          </div>
        </aside>
      </main>
    </div>
  );
}
