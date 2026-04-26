import { useEffect, useRef } from 'react';

function PeerMedia({ stream, name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled !== false);
  const initials = name ? name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() : '?';

  return (
    <div className="bg-surface-800 rounded-xl overflow-hidden relative aspect-video flex items-center justify-center border border-surface-700/60">
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${hasVideo ? '' : 'hidden'}`}
      />
      {!hasVideo && (
        <div className="flex flex-col items-center gap-1.5 text-surface-500">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-semibold text-white shadow-brand-glow-sm">
            {initials}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1.5">
        <div className="bg-black/60 backdrop-blur text-[10px] px-2 py-0.5 rounded-md font-medium truncate">
          {name}
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow shadow-md shadow-emerald-400/50"></div>
      </div>
    </div>
  );
}

export default function CallPanel({
  callActive,
  micOn,
  camOn,
  startCall,
  endCall,
  toggleMic,
  toggleCam,
  remoteStreams,
  peers,
  error,
}) {
  return (
    <div className="bg-surface-900/80 backdrop-blur border border-surface-700 rounded-xl p-4 space-y-3 shadow-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="text-sm font-semibold">Voice & video</span>
        </div>
        {!callActive ? (
          <button
            onClick={() => startCall({ withVideo: false })}
            className="bg-brand-500 hover:bg-brand-400 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow-brand-glow-sm flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.26 1.13a11 11 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"/>
            </svg>
            Join
          </button>
        ) : (
          <button
            onClick={endCall}
            className="bg-brand-700/80 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
          >
            Leave
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-amber-100 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
          {error}
        </p>
      )}

      {callActive ? (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                micOn
                  ? 'bg-surface-700 hover:bg-surface-600 text-white border border-surface-600'
                  : 'bg-brand-500/20 text-brand-200 border border-brand-500/40'
              }`}
            >
              {micOn ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
              {micOn ? 'Mute' : 'Unmute'}
            </button>
            <button
              onClick={toggleCam}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                camOn
                  ? 'bg-brand-500 text-white shadow-brand-glow-sm'
                  : 'bg-surface-700 hover:bg-surface-600 text-white border border-surface-600'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {camOn ? 'Camera on' : 'Camera'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {peers.map((p) => (
              <PeerMedia key={p.id} name={p.name} stream={remoteStreams[p.id]} />
            ))}
            {peers.length === 0 && (
              <div className="col-span-2 text-center text-surface-500 text-xs py-6 bg-surface-800/50 rounded-xl border border-dashed border-surface-700">
                Waiting for someone to join…
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs text-surface-500 leading-relaxed bg-surface-800/50 rounded-lg p-3 border border-surface-700/60">
          Click <span className="text-brand-300 font-medium">Join</span> to enable your microphone.
          Camera is optional — toggle it after joining.
        </div>
      )}
    </div>
  );
}
