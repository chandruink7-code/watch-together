import { forwardRef, useEffect, useState } from 'react';

/** Format seconds to mm:ss or h:mm:ss */
function fmt(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * File picker is intentionally unrestricted. Any `accept` filter —
 * even `video/*` — relies on the OS having tagged the file with a
 * recognised video MIME type, which doesn't happen consistently for
 * .mkv / .avi / .mov / re-extensioned files on Windows or Linux.
 * So we let the user pick anything and validate after.
 */
const FILE_ACCEPT = '';

/**
 * VideoPlayer
 * - The <video> ref is forwarded so the sync hook can attach listeners.
 * - Custom controls (not the native ones) because native seek bars
 *   fire too many events for our throttled sync.
 * - Detects unsupported formats via the <video> 'error' event and
 *   surfaces a friendly message.
 */
const VideoPlayer = forwardRef(function VideoPlayer(
  { onFilePicked, hasVideo, isAnyPeerBuffering },
  videoRef
) {
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [formatError, setFormatError] = useState(null);
  const [pickedName, setPickedName] = useState('');

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => {
      setDuration(v.duration || 0);
      setFormatError(null); // metadata loaded → format is fine
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      // MediaError codes:
      //   1 ABORTED, 2 NETWORK, 3 DECODE, 4 SRC_NOT_SUPPORTED
      const code = v.error?.code;
      if (code === 4 || code === 3) {
        setFormatError(
          `This video format may not be supported by your browser. Try MP4 (H.264) or WebM.`
        );
      }
    };

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
    };
  }, [videoRef, hasVideo]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function onSeekChange(e) {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrent(t);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormatError(null);
    setPickedName(file.name);

    // Since the picker is unrestricted, reject obvious non-video files
    // by extension. We can't trust file.type because Windows often
    // leaves it empty for .mkv etc.
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const videoExts = new Set([
      'mp4', 'm4v', 'webm', 'ogv', 'ogg',
      'mkv', 'mov', 'avi', '3gp', 'flv', 'wmv', 'mpg', 'mpeg', 'ts',
    ]);
    if (!file.type?.startsWith('video/') && !videoExts.has(ext)) {
      setFormatError(
        `"${file.name}" doesn't look like a video file. Pick a video (MP4, WebM, MKV, MOV, etc.).`
      );
      return; // don't pass it to the player
    }

    // Pre-flight check using the browser's own codec table. canPlayType
    // returns "" (no), "maybe", or "probably". Empty = warn but still try.
    if (file.type) {
      const v = document.createElement('video');
      const verdict = v.canPlayType(file.type);
      if (verdict === '') {
        setFormatError(
          `This video format (${file.type || ext}) may not be supported by your browser. Try MP4 (H.264) or WebM.`
        );
        // Still pass it on — some files lie about their MIME type.
      }
    }

    onFilePicked(file);
  }

  return (
    <div className="w-full">
      <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full"
          // Sync engine drives play/pause; native controls fire too many
          // seek events to be useful here.
          onClick={togglePlay}
          playsInline
        />
        {!hasVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <svg className="w-12 h-12 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-ink-500 text-sm">Pick a video file to start watching</p>
            <label className="cursor-pointer bg-accent hover:bg-accent-hover text-sm font-medium px-4 py-2 rounded-lg transition">
              Choose video
              <input type="file" accept={FILE_ACCEPT} onChange={handleFile} className="hidden" />
            </label>
            <p className="text-ink-500 text-xs max-w-xs">
              Both viewers must select the same file. Files stay on your device — nothing is uploaded.
            </p>
            <p className="text-ink-500 text-[11px] max-w-xs">
              Best support: MP4 (H.264) and WebM. MKV/AVI/MOV may not play on all browsers.
            </p>
          </div>
        )}
        {hasVideo && isAnyPeerBuffering && (
          <div className="absolute top-3 left-3 bg-yellow-500/20 border border-yellow-500/40 text-yellow-200 text-xs px-2 py-1 rounded-md">
            Peer is buffering…
          </div>
        )}
      </div>

      {/* Format warning */}
      {formatError && (
        <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div>{formatError}</div>
            {pickedName && <div className="opacity-70 mt-0.5">File: {pickedName}</div>}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 px-1">
        <div className="flex items-center gap-3 text-xs text-ink-500">
          <span className="tabular-nums">{fmt(current)}</span>
          <input
            type="range"
            className="seek flex-1"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={onSeekChange}
            disabled={!hasVideo}
          />
          <span className="tabular-nums">{fmt(duration)}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={!hasVideo}
            className="bg-ink-700 hover:bg-ink-600 disabled:opacity-40 px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition"
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          {hasVideo && (
            <label className="bg-ink-700 hover:bg-ink-600 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition">
              Change file
              <input type="file" accept={FILE_ACCEPT} onChange={handleFile} className="hidden" />
            </label>
          )}

          <div className="ml-auto flex items-center gap-2 text-ink-500 text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (videoRef.current) videoRef.current.volume = v;
              }}
              className="seek w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
