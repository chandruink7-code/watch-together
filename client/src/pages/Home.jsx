import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../config.js';

export default function Home() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Persist user name across rooms with localStorage.
  function persistName(value) {
    setName(value);
    localStorage.setItem('wt:name', value);
  }

  // Initialize from storage.
  if (name === '' && typeof window !== 'undefined') {
    const stored = localStorage.getItem('wt:name');
    if (stored) setName(stored);
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
      setError('Could not reach the server. Is it running on port 3001?');
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
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/20 mb-4">
            <svg className="w-6 h-6 text-accent-hover" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Watch Together</h1>
          <p className="text-ink-500 mt-2">Sync video playback and talk in real time.</p>
        </div>

        <div className="bg-ink-800 rounded-2xl border border-ink-700 p-6 space-y-6">
          <div>
            <label className="text-sm text-ink-500 mb-1.5 block">Your name</label>
            <input
              value={name}
              onChange={(e) => persistName(e.target.value)}
              placeholder="Enter your name"
              className="w-full bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <form onSubmit={handleCreate} className="space-y-3">
            <label className="text-sm text-ink-500 block">Create a new room</label>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Room name (optional)"
              className="w-full bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
            >
              {busy ? 'Creating…' : 'Create Room'}
            </button>
          </form>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-ink-700" />
            <span className="text-xs text-ink-500">OR</span>
            <div className="flex-1 h-px bg-ink-700" />
          </div>

          <form onSubmit={handleJoin} className="space-y-3">
            <label className="text-sm text-ink-500 block">Join an existing room</label>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Room code"
              className="w-full bg-ink-700 border border-ink-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="w-full bg-ink-700 hover:bg-ink-600 border border-ink-600 text-white font-medium py-2.5 rounded-lg transition"
            >
              Join Room
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
