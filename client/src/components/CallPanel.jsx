import { useEffect, useRef } from 'react';

/** Renders one peer's audio/video element. */
function PeerMedia({ stream, name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);

  const hasVideo = stream && stream.getVideoTracks().some((t) => t.enabled !== false);

  return (
    <div className="bg-ink-700 rounded-lg overflow-hidden relative aspect-video flex items-center justify-center">
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${hasVideo ? '' : 'hidden'}`}
      />
      {!hasVideo && (
        <div className="flex flex-col items-center gap-1.5 text-ink-500">
          <div className="w-10 h-10 rounded-full bg-ink-600 flex items-center justify-center text-sm font-medium text-white">
            {name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-[10px]">audio only</span>
        </div>
      )}
      <div className="absolute bottom-1 left-1 bg-black/60 text-[10px] px-1.5 py-0.5 rounded">
        {name}
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
    <div className="bg-ink-800 border border-ink-700 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Voice & video</div>
        {!callActive ? (
          <button
            onClick={() => startCall({ withVideo: false })}
            className="bg-accent hover:bg-accent-hover px-3 py-1.5 rounded-lg text-xs"
          >
            Join call
          </button>
        ) : (
          <button
            onClick={endCall}
            className="bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg text-xs"
          >
            Leave
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
          {error}
        </p>
      )}

      {callActive && (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 ${
                micOn ? 'bg-ink-700 hover:bg-ink-600' : 'bg-red-500/30 text-red-200'
              }`}
            >
              {micOn ? '🎙️' : '🔇'} {micOn ? 'Mute' : 'Unmute'}
            </button>
            <button
              onClick={toggleCam}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 ${
                camOn ? 'bg-accent text-white' : 'bg-ink-700 hover:bg-ink-600'
              }`}
            >
              {camOn ? '📹' : '📷'} {camOn ? 'Camera on' : 'Camera off'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {peers.map((p) => (
              <PeerMedia
                key={p.id}
                name={p.name}
                stream={remoteStreams[p.id]}
              />
            ))}
            {peers.length === 0 && (
              <div className="col-span-2 text-center text-ink-500 text-xs py-4">
                Waiting for someone to join…
              </div>
            )}
          </div>
        </>
      )}

      {!callActive && (
        <p className="text-xs text-ink-500">
          Click "Join call" to enable your microphone. Camera is optional.
        </p>
      )}
    </div>
  );
}
