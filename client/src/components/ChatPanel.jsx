import { useEffect, useRef, useState } from 'react';

export default function ChatPanel({ socket, me }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on('chat:message', onMessage);
    return () => socket.off('chat:message', onMessage);
  }, [socket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !socket) return;
    socket.emit('chat:message', { text });
    setInput('');
  }

  return (
    <div className="bg-surface-900/80 backdrop-blur border border-surface-700 rounded-xl flex flex-col h-full min-h-0 shadow-panel overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-700/60 flex items-center gap-2">
        <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span className="text-sm font-semibold">Chat</span>
        {messages.length > 0 && (
          <span className="ml-auto text-[10px] text-surface-500">{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
            <div className="w-10 h-10 rounded-full bg-surface-700 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-surface-500 text-xs">No messages yet</p>
            <p className="text-surface-500/60 text-[11px] mt-0.5">Be the first to say hi 👋</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = me && m.from.id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                  mine
                    ? 'bg-brand-500 text-white rounded-br-md'
                    : 'bg-surface-700 text-white rounded-bl-md'
                }`}>
                  {!mine && (
                    <div className="text-[10px] font-medium text-surface-500 mb-0.5">{m.from.name}</div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="border-t border-surface-700/60 p-2.5 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message…"
          className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-brand-500 hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 rounded-lg text-sm transition flex items-center justify-center"
          aria-label="Send"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
