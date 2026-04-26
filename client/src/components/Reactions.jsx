import { useState, useEffect, useRef } from 'react';

const EMOJIS = ['❤️', '😂', '👏', '🔥', '😮', '😢', '🍿', '🎬'];

/**
 * Two pieces:
 *   - <ReactionsOverlay/> renders floating emojis over the video
 *   - <ReactionsBar/> the row of buttons users click to send
 *
 * Animation: each emoji is a div absolutely positioned at a random x near
 * the bottom; CSS keyframes float it up + fade it out over 3 seconds.
 */

export function ReactionsOverlay({ socket }) {
  const [floating, setFloating] = useState([]);
  const counterRef = useRef(0);

  useEffect(() => {
    if (!socket) return;
    const onReaction = ({ emoji }) => {
      const id = ++counterRef.current;
      const x = 10 + Math.random() * 80; // 10% – 90% from left
      const drift = (Math.random() - 0.5) * 60; // sideways drift
      const delay = Math.random() * 100;
      setFloating((prev) => [...prev, { id, emoji, x, drift, delay }]);
      // remove after animation finishes
      setTimeout(() => {
        setFloating((prev) => prev.filter((f) => f.id !== id));
      }, 3500);
    };
    socket.on('reaction:send', onReaction);
    return () => socket.off('reaction:send', onReaction);
  }, [socket]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {floating.map((f) => (
        <div
          key={f.id}
          className="absolute bottom-0 text-4xl select-none"
          style={{
            left: `${f.x}%`,
            animation: `float-up 3s ease-out ${f.delay}ms forwards`,
            // we use CSS variable so the keyframe can pick it up
            ['--drift']: `${f.drift}px`,
          }}
        >
          {f.emoji}
        </div>
      ))}
    </div>
  );
}

export function ReactionsBar({ socket, disabled }) {
  const [pulse, setPulse] = useState(null);

  function send(emoji) {
    if (!socket || disabled) return;
    socket.emit('reaction:send', { emoji });
    setPulse(emoji);
    setTimeout(() => setPulse(null), 250);
  }

  return (
    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-2 py-1.5">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => send(emoji)}
          disabled={disabled}
          className={`w-9 h-9 rounded-full flex items-center justify-center text-lg hover:bg-white/10 transition disabled:opacity-40 ${
            pulse === emoji ? 'scale-125' : ''
          }`}
          style={{ transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1), background 200ms' }}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
