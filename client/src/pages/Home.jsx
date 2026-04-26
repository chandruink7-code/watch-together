import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../config.js';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'join'

  useEffect(() => {
    const stored = localStorage.getItem('wt:name');
    if (stored) setName(stored);
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
    navigate(`/room/${joinCode.trim()}?name=${encodeURIComponent(name || 'Guest')}`);
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Top brand bar */}
      <header className="px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-brand-500 flex items-center justify-center shadow-brand-glow-sm">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <span className="display text-2xl tracking-wider">WATCH<span className="text-brand-500">.</span>TOGETHER</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-8 sm:py-12">
        <div className="w-full max-w-5xl grid lg:grid-cols-[1fr_440px] gap-10 lg:gap-16 items-center">

          {/* Left: pitch */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-slow"></span>
              MOVIE NIGHT, FROM ANYWHERE
            </div>
            <h1 className="display text-5xl sm:text-7xl lg:text-8xl leading-[0.9] mb-6">
              Watch.<br/>
              <span className="text-brand-500">Together.</span><br/>
              Always in sync.
            </h1>
            <p className="text-surface-500 text-lg max-w-md leading-relaxed">
              Sync video playback across devices, talk in real time over voice.
              No uploads, no streaming costs — your files stay on your machine.
            </p>

            <div className="hidden lg:flex items-center gap-6 mt-10 text-surface-500 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Synced playback</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Voice + video chat</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Private rooms</span>
              </div>
            </div>
          </div>

          {/* Right: form card */}
          <div className="animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
            <div className="bg-surface-900/80 backdrop-blur border border-surface-700 rounded-2xl p-6 shadow-panel">
              {/* Name */}
              <label className="block text-xs font-medium text-surface-500 uppercase tracking-wider mb-2">
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => persistName(e.target.value)}
                placeholder="Type your name"
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition mb-6"
              />

              {/* Tabs */}
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
                    className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 shadow-brand-glow-sm"
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      Room code
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
                    className="w-full bg-surface-700 hover:bg-surface-600 border border-surface-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                  >
                    Join Room
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" />
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

      <footer className="px-6 py-4 text-center text-xs text-surface-500/60">
        Built for movie nights with people far away.
      </footer>
    </div>
  );
}
