import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../config.js';

// Cinematic abstract gradient backgrounds for the hero carousel.
// We use SVG data URLs so we don't depend on external images that
// might be copyrighted. Each is a unique cinematic vibe.
const HERO_BACKGROUNDS = [
  // Red/black noir
  `radial-gradient(ellipse at 30% 40%, rgba(229,9,20,0.5), transparent 50%),
   radial-gradient(ellipse at 70% 60%, rgba(139,5,11,0.4), transparent 50%),
   linear-gradient(135deg, #1a0a0c 0%, #0a0a0c 100%)`,
  // Deep blue/red contrast
  `radial-gradient(ellipse at 20% 50%, rgba(229,9,20,0.4), transparent 60%),
   radial-gradient(ellipse at 80% 30%, rgba(30,64,175,0.3), transparent 60%),
   linear-gradient(135deg, #0a0a14 0%, #0a0a0c 100%)`,
  // Crimson dawn
  `radial-gradient(ellipse at 50% 80%, rgba(229,9,20,0.6), transparent 50%),
   radial-gradient(ellipse at 0% 0%, rgba(168,85,247,0.2), transparent 50%),
   linear-gradient(180deg, #0a0a0c 0%, #1a0810 100%)`,
];

const TAGLINES = [
  { headline: 'Watch.', accent: 'Together.', tail: 'Always in sync.' },
  { headline: 'Your room.', accent: 'Their movie.', tail: 'One screen.' },
  { headline: 'Distance', accent: 'is over.', tail: 'Press play together.' },
];

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('wt:name');
    if (stored) setName(stored);
  }, []);

  // Auto-rotate hero carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_BACKGROUNDS.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  function persistName(value) {
    setName(value);
    localStorage.setItem('wt:name', value);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName || undefined }),
      });
      if (!res.ok) throw new Error('Server error');
      const { roomId } = await res.json();
      navigate(`/room/${roomId}?name=${encodeURIComponent(name || 'Guest')}`);
    } catch (err) {
      setError('Could not reach the server. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  function handleJoin(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    // Allow pasting a full URL — extract just the room ID
    let code = joinCode.trim();
    const match = code.match(/\/room\/([^/?]+)/);
    if (match) code = match[1];
    navigate(`/room/${code}?name=${encodeURIComponent(name || 'Guest')}`);
  }

  const tagline = TAGLINES[heroIndex];

  return (
    <div className="min-h-full flex flex-col relative overflow-hidden">
      {/* Hero rotating background */}
      <div className="absolute inset-0 -z-10">
        {HERO_BACKGROUNDS.map((bg, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-[2000ms] ${
              i === heroIndex ? 'opacity-100 animate-ken-burns' : 'opacity-0'
            }`}
            style={{ background: bg }}
          />
        ))}
        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* Top brand bar */}
      <header className="px-6 py-5 sm:px-10 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-brand-500 flex items-center justify-center shadow-brand-glow-sm animate-glow-pulse">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <span className="display text-2xl tracking-wider">WATCH<span className="text-brand-500">.</span>TOGETHER</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-surface-500">
            {HERO_BACKGROUNDS.map((_, i) => (
              <button
                key={i}
                onClick={() => setHeroIndex(i)}
                className={`h-1 rounded-full transition-all ${
                  i === heroIndex ? 'w-6 bg-brand-500' : 'w-2 bg-surface-700 hover:bg-surface-600'
                }`}
                aria-label={`Hero ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1fr_440px] gap-10 lg:gap-16 items-center">

          {/* Left: pitch */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow"></span>
              MOVIE NIGHT, FROM ANYWHERE
            </div>
            <h1 className="display text-5xl sm:text-7xl lg:text-8xl leading-[0.9] mb-6">
              <span key={`h-${heroIndex}`} className="inline-block animate-fade-in">
                {tagline.headline}<br/>
                <span className="text-brand-500">{tagline.accent}</span><br/>
                {tagline.tail}
              </span>
            </h1>
            <p className="text-surface-500 text-lg max-w-md leading-relaxed">
              Sync video playback across devices, talk in real time over voice,
              react with floating emojis. Files stay on your device — nothing uploads.
            </p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-10 text-surface-500 text-sm">
              {[
                { label: 'Synced playback' },
                { label: 'Voice + video' },
                { label: 'Live reactions' },
                { label: 'Private rooms' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form card */}
          <div className="animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
            <div className="bg-surface-900/80 backdrop-blur-xl border border-surface-700 rounded-2xl p-6 shadow-panel">
              <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => persistName(e.target.value)}
                placeholder="Type your name"
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition mb-6"
              />

              <div className="flex gap-1 p-1 bg-surface-800 rounded-lg mb-5">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                    activeTab === 'create'
                      ? 'bg-brand-500 text-white shadow-brand-glow-sm'
                      : 'text-surface-500 hover:text-white'
                  }`}
                >
                  Create Room
                </button>
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition ${
                    activeTab === 'join'
                      ? 'bg-brand-500 text-white shadow-brand-glow-sm'
                      : 'text-surface-500 hover:text-white'
                  }`}
                >
                  Join Room
                </button>
              </div>

              {activeTab === 'create' ? (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
                      Room name <span className="text-surface-500/60 normal-case">(optional)</span>
                    </label>
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Friday movie night"
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-brand-glow-sm group"
                  >
                    {busy ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                        </svg>
                        Creating…
                      </>
                    ) : (
                      <>
                        Start watching
                        <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
                      Room code or link
                    </label>
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Paste room code or full link"
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-surface-700 hover:bg-surface-600 border border-surface-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 group"
                  >
                    Join Room
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                </form>
              )}

              {error && (
                <p className="mt-4 text-sm text-brand-200 bg-brand-500/10 border border-brand-500/30 rounded-lg px-3 py-2 animate-fade-in">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-5 text-center text-xs text-surface-500/60 relative z-10">
        Built for movie nights with people far away.
      </footer>
    </div>
  );
}
