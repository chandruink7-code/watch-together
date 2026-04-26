import { useEffect, useRef, useState } from 'react';

export default function ChatPanel({ socket, me }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
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
    <div className="bg-ink-800 border border-ink-700 rounded-xl flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-ink-700 text-sm font-medium">Chat</div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-ink-500 text-xs text-center mt-6">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m) => {
            const mine = me && m.from.id === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${mine ? 'bg-accent text-white' : 'bg-ink-700 text-ink-100'} rounded-lg px-3 py-1.5`}>
                  {!mine && <div className="text-[10px] opacity-70 mb-0.5">{m.from.name}</div>}
                  <div className="text-sm whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={send} className="border-t border-ink-700 p-2 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 bg-ink-700 border border-ink-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-accent hover:bg-accent-hover disabled:opacity-40 px-3 rounded-lg text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}
