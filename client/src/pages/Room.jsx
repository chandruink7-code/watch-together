import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import useSocket from '../hooks/useSocket.js';
import useWebRTC from '../hooks/useWebRTC.js';
import useVideoSync from '../hooks/useVideoSync.js';
import useToasts from '../hooks/useToasts.js';
import VideoPlayer from '../components/VideoPlayer.jsx';
import CallPanel from '../components/CallPanel.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import Toasts from '../components/Toasts.jsx';
import { avatarFor, initialsOf } from '../lib/avatar.js';

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const userName = searchParams.get('name') || 'Guest';
  const { socket, status } = useSocket();
  const { toasts, notify, dismiss } = useToasts();

  const [me, setMe] = useState(null);
  const [peers, setPeers] = useState([]);
  const [roomName, setRoomName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('chat');
  const [cinemaMode, setCinemaMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const videoRef = useRef(null);
  const [videoFile, setVideoFile] = useState(null);
  const objectUrlRef = useRef(null);
  const announcedJoinRef = useRef(new Set());

  /* Onboarding shows once per device */
  useEffect(() => {
    const seen = localStorage.getItem('wt:onboarded');
    if (!seen) {
      const t = setTimeout(() => setShowOnboarding(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function dismissOnboarding() {
    setShowOnboarding(false);
    localStorage.setItem('wt:onboarded', '1');
  }

  /* ---------------- Body class for cinema mode ---------------- */
  useEffect(() => {
    if (cinemaMode) document.body.classList.add('cinema-mode');
    else document.body.classList.remove('cinema-mode');
    return () => document.body.classList.remove('cinema-mode');
  }, [cinemaMode]);

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

      // Welcome toast
      notify({
        kind: 'success',
        title: 'You\'re in',
        message: resp.peers?.length
          ? `${resp.peers.length} other ${resp.peers.length === 1 ? 'person is' : 'people are'} here`
          : 'Send the link to invite friends',
      });
    });

    const onJoined = ({ user }) => {
      setPeers((prev) => (prev.some((p) => p.id === user.id) ? prev : [...prev, user]));
      // Avoid duplicate toasts on reconnect
      if (!announcedJoinRef.current.has(user.id)) {
        announcedJoinRef.current.add(user.id);
        notify({ kind: 'user', title: `${user.name} joined`, message: 'They can now watch with you' });
      }
    };
    const onLeft = ({ user }) => {
      setPeers((prev) => prev.filter((p) => p.id !== user.id));
      announcedJoinRef.current.delete(user.id);
      notify({ kind: 'warn', title: `${user.name} left` });
    };

    socket.on('room:user-joined', onJoined);
    socket.on('room:user-left', onLeft);

    return () => {
      socket.off('room:user-joined', onJoined);
      socket.off('room:user-left', onLeft);
    };
  }, [socket, status, roomId, userName, notify]);

  const hasVideo = !!videoFile;
  const sync = useVideoSync({ socket, videoRef, hasVideo });
  const rtc = useWebRTC({ socket, myId: me?.id, peers });

  /* Surface RTC errors as toasts */
  useEffect(() => {
    if (rtc.error) notify({ kind: 'error', title: 'Voice/video error', message: rtc.error, duration: 6000 });
  }, [rtc.error, notify]);

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
    notify({ kind: 'success', title: 'Video loaded', message: file.name, duration: 3000 });
  }, [sync, notify]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const copyLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      notify({ kind: 'info', title: 'Link copied', message: 'Send it to anyone you want to watch with', duration: 3000 });
      setTimeout(() => setLinkCopied(false), 1800);
    });
  };

  const leaveRoom = () => {
    if (socket) socket.emit('room:leave');
    navigate('/');
  };

  const toggleCinema = useCallback(() => {
    if (!hasVideo) return;
    setCinemaMode((c) => !c);
  }, [hasVideo]);

  const statusInfo = {
    connecting: { color: 'bg-amber-400', label: 'Connecting' },
    connected: { color: 'bg-emerald-400', label: 'Live' },
    disconnected: { color: 'bg-brand-500', label: 'Disconnected' },
  }[status];

  const peopleCount = 1 + peers.length;
  const myAvatar = me ? avatarFor(me.id) : null;

  return (
    <div className="min-h-full flex flex-col">
      <Toasts toasts={toasts} onDismiss={dismiss} />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <OnboardingHint onDismiss={dismissOnboarding} />
      )}

      {/* Top bar — hidden in cinema mode */}
      {!cinemaMode && (
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

            {/* Avatar peer chips */}
            <div className="hidden md:flex items-center -space-x-2">
              {me && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-surface-900 ring-1 ring-brand-500"
                  style={{ background: myAvatar.gradient }}
                  title={`${me.name} (you)`}
                >
                  {initialsOf(me.name)}
                </div>
              )}
              {peers.slice(0, 4).map((p) => {
                const a = avatarFor(p.id);
                return (
                  <div
                    key={p.id}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-surface-900"
                    style={{ background: a.gradient }}
                    title={p.name}
                  >
                    {initialsOf(p.name)}
                  </div>
                );
              })}
              {peers.length > 4 && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-700 border-2 border-surface-900 text-white">
                  +{peers.length - 4}
                </div>
              )}
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
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="hidden sm:inline">Invite friends</span>
                  <span className="sm:hidden">Invite</span>
                </>
              )}
            </button>
          </div>
        </header>
      )}

      {joinError && !cinemaMode && (
        <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 mt-4">
          <div className="bg-brand-500/10 border border-brand-500/30 text-brand-200 text-sm rounded-lg px-3 py-2">
            {joinError}
          </div>
        </div>
      )}

      {/* Main layout */}
      <main className={cinemaMode
        ? 'fixed inset-0 z-30'
        : 'flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-6'
      }>
        <section className={cinemaMode ? '' : 'min-w-0 animate-fade-in'}>
          <VideoPlayer
            ref={videoRef}
            onFilePicked={handleFilePicked}
            hasVideo={hasVideo}
            isAnyPeerBuffering={sync.isAnyPeerBuffering}
            socket={socket}
            cinemaMode={cinemaMode}
            onToggleCinema={toggleCinema}
          />
          {!cinemaMode && hasVideo && (
            <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
              <svg className="w-3.5 h-3.5 text-brand-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span>Now playing</span>
              <span className="text-white truncate flex-1">{videoFile.name}</span>
              <span className="hidden sm:inline text-surface-500/60 text-[11px]">Press F for cinema mode</span>
            </div>
          )}
        </section>

        {/* Sidebar — hidden in cinema mode */}
        {!cinemaMode && (
          <aside className="flex flex-col gap-4 min-h-0 lg:h-[calc(100vh-7.5rem)] animate-fade-in" style={{ animationDelay: '0.1s' }}>
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
        )}
      </main>
    </div>
  );
}

/* ---- Onboarding overlay ---- */
function OnboardingHint({ onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onDismiss}>
      <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 max-w-md w-full shadow-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold mb-1">Welcome! A few quick tips</h3>
            <p className="text-xs text-surface-500">First time here? Here's what makes movie night work.</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {[
            { num: '1', text: 'Click "Choose video" and both viewers must pick the same file.' },
            { num: '2', text: 'Press F or click the expand icon for cinema mode.' },
            { num: '3', text: 'Send floating reactions during the movie — react with the emoji bar.' },
            { num: '4', text: 'Open the Voice tab and Join to talk while you watch.' },
          ].map((tip) => (
            <div key={tip.num} className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {tip.num}
              </div>
              <p className="text-sm text-surface-200 leading-relaxed">{tip.text}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full bg-brand-500 hover:bg-brand-400 text-white font-medium py-2.5 rounded-lg transition shadow-brand-glow-sm"
        >
          Got it, let's watch
        </button>
      </div>
    </div>
  );
}
