import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket.js';
import useWebRTC from '../hooks/useWebRTC.js';
import useVideoSync from '../hooks/useVideoSync.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import CallPanel from '../components/CallPanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userName = searchParams.get('name') || 'Guest';
  const { socket, status } = useSocket();

  const [me, setMe] = useState(null);
  const [peers, setPeers] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('chat'); // 'chat' | 'call'

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

  const hasVideo = !!videoFile;
  const sync = useVideoSync({ socket, videoRef, hasVideo });
  const rtc = useWebRTC({ socket, myId: me?.id, peers });

  const handleFilePicked = useCallback((file) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
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

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    });
  };

  const leaveRoom = () => {
    if (socket) socket.emit('room:leave');
    navigate('/');
  };

  const statusInfo = {
    connecting: { color: 'bg-amber-400', label: 'Connecting' },
    connected: { color: 'bg-emerald-400', label: 'Live' },
    disconnected: { color: 'bg-brand-500', label: 'Disconnected' },
  }[status];

  const peopleCount = 1 + peers.length;

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar */}
      <header className="border-b border-surface-700/60 bg-surface-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={leaveRoom}
            className="text-surface-500 hover:text-white text-sm flex items-center gap-1.5 transition group"
          >
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="hidden sm:inline">Leave</span>
          </button>

          <div className="h-5 w-px bg-surface-700 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-md bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-brand-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{roomName}</div>
              <div className="text-[11px] text-surface-500 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.color} ${status === 'connected' ? 'animate-pulse-slow' : ''}`} />
                <span>{statusInfo.label}</span>
                <span>·</span>
                <span>{peopleCount} {peopleCount === 1 ? 'watcher' : 'watchers'}</span>
              </div>
            </div>
          </div>

          {/* Peer chips */}
          <div className="hidden md:flex items-center gap-1.5">
            {me && (
              <span className="bg-brand-500/15 border border-brand-500/40 text-brand-200 text-xs px-2.5 py-1 rounded-full font-medium">
                {me.name}
              </span>
            )}
            {peers.map((p) => (
              <span key={p.id} className="bg-surface-700/80 border border-surface-600 text-xs px-2.5 py-1 rounded-full">
                {p.name}
              </span>
            ))}
          </div>

          <button
            onClick={copyLink}
            className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition border ${
              linkCopied
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                : 'bg-surface-700 hover:bg-surface-600 border-surface-600 hover:border-surface-500'
            }`}
          >
            {linkCopied ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Invite friends
              </>
            )}
          </button>
        </div>
      </header>

      {joinError && (
        <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 mt-4">
          <div className="bg-brand-500/10 border border-brand-500/30 text-brand-200 text-sm rounded-lg px-3 py-2">
            {joinError}
          </div>
        </div>
      )}

      {/* Main layout */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6">

        {/* Video column */}
        <section className="min-w-0 animate-fade-in">
          <VideoPlayer
            ref={videoRef}
            onFilePicked={handleFilePicked}
            hasVideo={hasVideo}
            isAnyPeerBuffering={sync.isAnyPeerBuffering}
          />
          {hasVideo && (
            <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
              <svg className="w-3.5 h-3.5 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span>Now playing</span>
              <span className="text-white truncate">{videoFile.name}</span>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-4 min-h-0 lg:h-[calc(100vh-7.5rem)] animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {/* Tab switcher (mobile-friendly) */}
          <div className="flex gap-1 p-1 bg-surface-900/80 backdrop-blur border border-surface-700 rounded-xl">
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'chat'
                  ? 'bg-surface-700 text-white'
                  : 'text-surface-500 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Chat
            </button>
            <button
              onClick={() => setSidebarTab('call')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                sidebarTab === 'call'
                  ? 'bg-surface-700 text-white'
                  : 'text-surface-500 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Voice
              {rtc.callActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
              )}
            </button>
          </div>

          <div className={`flex-1 min-h-[300px] lg:min-h-0 ${sidebarTab === 'chat' ? '' : 'hidden'}`}>
            <ChatPanel socket={socket} me={me} />
          </div>
          <div className={sidebarTab === 'call' ? '' : 'hidden'}>
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
          </div>
        </aside>
      </main>
    </div>
  );
}
