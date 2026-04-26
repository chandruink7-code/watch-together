import { forwardRef, useEffect, useState, useRef } from 'react';
import { ReactionsOverlay, ReactionsBar } from './Reactions.jsx';

function fmt(sec) {
  if (!Number.isFinite(sec)) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const FILE_ACCEPT = '';

const VideoPlayer = forwardRef(function VideoPlayer(
  {
    onFilePicked,
    hasVideo,
    isAnyPeerBuffering,
    socket,
    cinemaMode,
    onToggleCinema,
  },
  videoRef
) {
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [formatError, setFormatError] = useState(null);
  const [pickedName, setPickedName] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverX, setHoverX] = useState(0);
  const hideTimerRef = useRef(null);
  const stageRef = useRef(null);
  const seekTrackRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => {
      setDuration(v.duration || 0);
      setFormatError(null);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      const code = v.error?.code;
      if (code === 4 || code === 3) {
        setFormatError(`This video format may not be supported by your browser. Try MP4 (H.264) or WebM.`);
      }
    };
    const onVolumeChange = () => {
      setVolume(v.volume);
      setIsMuted(v.muted);
    };

    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onError);
    v.addEventListener('volumechange', onVolumeChange);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onError);
      v.removeEventListener('volumechange', onVolumeChange);
    };
  }, [videoRef, hasVideo]);

  // Keyboard shortcuts when in cinema mode (or generally focused)
  useEffect(() => {
    function onKey(e) {
      if (!hasVideo) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const v = videoRef.current;
      if (!v) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (v.paused) v.play().catch(() => {}); else v.pause();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        onToggleCinema?.();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        v.muted = !v.muted;
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasVideo, videoRef, onToggleCinema]);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }

  function onSeekChange(e) {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrent(t);
  }

  function onSeekHover(e) {
    if (!seekTrackRef.current || !duration) return;
    const rect = seekTrackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(pct * duration);
    setHoverX(x);
  }

  function onVolumeSlider(e) {
    const v = videoRef.current;
    const val = Number(e.target.value);
    setVolume(val);
    if (v) {
      v.volume = val;
      v.muted = val === 0;
    }
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormatError(null);
    setPickedName(file.name);

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const videoExts = new Set([
      'mp4', 'm4v', 'webm', 'ogv', 'ogg',
      'mkv', 'mov', 'avi', '3gp', 'flv', 'wmv', 'mpg', 'mpeg', 'ts',
    ]);
    if (!file.type?.startsWith('video/') && !videoExts.has(ext)) {
      setFormatError(`"${file.name}" doesn't look like a video file. Pick a video (MP4, WebM, MKV, MOV, etc.).`);
      return;
    }

    if (file.type) {
      const v = document.createElement('video');
      const verdict = v.canPlayType(file.type);
      if (verdict === '') {
        setFormatError(`This format (${file.type || ext}) may not work in your browser. Try MP4 (H.264) or WebM.`);
      }
    }

    onFilePicked(file);
  }

  function handleMouseMove() {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className={cinemaMode ? 'fixed inset-0 z-40 bg-black flex items-center justify-center' : 'w-full'}>
      <div
        ref={stageRef}
        className={`relative bg-black overflow-hidden flex items-center justify-center group ${
          cinemaMode
            ? 'w-full h-full'
            : 'rounded-2xl aspect-video shadow-2xl ring-1 ring-white/5'
        }`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        style={!cinemaMode ? {
          boxShadow: '0 30px 80px -20px rgba(229, 9, 20, 0.2), 0 0 0 1px rgba(255,255,255,0.05)',
        } : undefined}
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          onClick={togglePlay}
          playsInline
        />

        {/* Reactions floating layer */}
        {hasVideo && socket && <ReactionsOverlay socket={socket} />}

        {/* Empty state */}
        {!hasVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 bg-gradient-to-br from-surface-900 via-black to-surface-900">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-500/20 blur-2xl rounded-full"></div>
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand-glow">
                <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
            </div>
            <div>
              <h3 className="display text-3xl tracking-wide mb-1">Ready to watch</h3>
              <p className="text-surface-500 text-sm max-w-sm">
                Pick a video from your device. Both viewers must select the same file.
              </p>
            </div>
            <label className="cursor-pointer mt-2 bg-brand-500 hover:bg-brand-400 text-sm font-semibold px-6 py-2.5 rounded-lg transition shadow-brand-glow-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Choose video
              <input type="file" accept={FILE_ACCEPT} onChange={handleFile} className="hidden" />
            </label>
            <p className="text-surface-500/60 text-[11px] mt-1">
              Files stay on your device · Best support: MP4, WebM
            </p>
          </div>
        )}

        {/* Buffering overlay */}
        {hasVideo && isAnyPeerBuffering && (
          <div className="absolute top-4 left-4 bg-amber-500/20 backdrop-blur border border-amber-500/40 text-amber-100 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 animate-fade-in">
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Peer is buffering…
          </div>
        )}

        {/* Center play button overlay (when paused) */}
        {hasVideo && !isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition group/play"
          >
            <div className="w-20 h-20 rounded-full bg-brand-500/90 backdrop-blur flex items-center justify-center shadow-brand-glow group-hover/play:scale-110 transition-transform">
              <svg className="w-9 h-9 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
          </button>
        )}

        {/* Cinema-mode integrated controls (overlay on the video) */}
        {cinemaMode && hasVideo && (
          <div
            className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="bg-gradient-to-t from-black via-black/80 to-transparent p-4 sm:p-6">
              {/* Reactions bar */}
              <div className="flex justify-center mb-4">
                <ReactionsBar socket={socket} disabled={!hasVideo} />
              </div>
              {/* Seek + controls (cinema) */}
              <SeekBar
                progress={progress}
                current={current}
                duration={duration}
                onChange={onSeekChange}
                onHover={onSeekHover}
                onLeave={() => setHoverTime(null)}
                hoverTime={hoverTime}
                hoverX={hoverX}
                trackRef={seekTrackRef}
              />
              <ControlsRow
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                onChangeFile={handleFile}
                volume={volume}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                onVolumeSlider={onVolumeSlider}
                cinemaMode
                onToggleCinema={onToggleCinema}
                hasVideo={hasVideo}
              />
            </div>
          </div>
        )}

        {/* Cinema-mode top bar (exit button) */}
        {cinemaMode && (
          <button
            onClick={onToggleCinema}
            className={`absolute top-4 right-4 bg-black/60 backdrop-blur border border-white/10 hover:bg-black/80 text-white p-2 rounded-lg transition ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-label="Exit cinema mode"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
            </svg>
          </button>
        )}
      </div>

      {/* Format warning (only in normal mode) */}
      {!cinemaMode && formatError && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/30 text-amber-100 text-xs rounded-lg px-3 py-2.5 flex items-start gap-2 animate-fade-in">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div>{formatError}</div>
            {pickedName && <div className="opacity-70 mt-0.5">File: {pickedName}</div>}
          </div>
        </div>
      )}

      {/* Normal-mode controls below the video */}
      {!cinemaMode && (
        <div className="mt-4 px-1">
          <SeekBar
            progress={progress}
            current={current}
            duration={duration}
            onChange={onSeekChange}
            onHover={onSeekHover}
            onLeave={() => setHoverTime(null)}
            hoverTime={hoverTime}
            hoverX={hoverX}
            trackRef={seekTrackRef}
          />
          <div className="mt-3">
            <ControlsRow
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onChangeFile={handleFile}
              volume={volume}
              isMuted={isMuted}
              onToggleMute={toggleMute}
              onVolumeSlider={onVolumeSlider}
              cinemaMode={false}
              onToggleCinema={onToggleCinema}
              hasVideo={hasVideo}
              socket={socket}
            />
          </div>
        </div>
      )}
    </div>
  );
});

/* -------- Sub-components for the controls row -------- */

function SeekBar({ progress, current, duration, onChange, onHover, onLeave, hoverTime, hoverX, trackRef }) {
  return (
    <div className="relative">
      <div className="flex items-center gap-3 text-xs text-surface-500/90">
        <span className="tabular-nums font-mono">{fmt(current)}</span>
        <div ref={trackRef} className="flex-1 relative" onMouseMove={onHover} onMouseLeave={onLeave}>
          <input
            type="range"
            className="seek w-full"
            style={{ '--progress': `${progress}%` }}
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={onChange}
            disabled={!duration}
          />
          {hoverTime !== null && (
            <div
              className="absolute -top-8 -translate-x-1/2 bg-black/90 backdrop-blur border border-white/10 text-white text-[11px] px-2 py-0.5 rounded font-mono pointer-events-none"
              style={{ left: hoverX }}
            >
              {fmt(hoverTime)}
            </div>
          )}
        </div>
        <span className="tabular-nums font-mono">{fmt(duration)}</span>
      </div>
    </div>
  );
}

function ControlsRow({
  isPlaying, onTogglePlay, onChangeFile,
  volume, isMuted, onToggleMute, onVolumeSlider,
  cinemaMode, onToggleCinema, hasVideo, socket,
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onTogglePlay}
        disabled={!hasVideo}
        className={`disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition ${
          cinemaMode
            ? 'bg-white/10 hover:bg-white/20 backdrop-blur'
            : 'bg-brand-500 hover:bg-brand-400 shadow-brand-glow-sm'
        }`}
      >
        {isPlaying ? (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>
            Pause
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Play
          </>
        )}
      </button>

      {hasVideo && !cinemaMode && (
        <label className="bg-surface-700 hover:bg-surface-600 px-3 py-2 rounded-lg text-sm cursor-pointer transition border border-surface-600 hover:border-surface-500 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0L8 12m4-4v12" />
          </svg>
          Change
          <input type="file" accept={FILE_ACCEPT} onChange={onChangeFile} className="hidden" />
        </label>
      )}

      {/* Reactions in normal mode (cinema mode shows them above) */}
      {!cinemaMode && hasVideo && socket && (
        <div className="hidden sm:block">
          <ReactionsBar socket={socket} disabled={!hasVideo} />
        </div>
      )}

      <div className={`ml-auto flex items-center gap-2 ${cinemaMode ? 'text-white/70' : 'text-surface-500'}`}>
        {/* Cinema toggle */}
        <button
          onClick={onToggleCinema}
          disabled={!hasVideo}
          className={`p-2 rounded-lg transition disabled:opacity-40 ${
            cinemaMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'hover:bg-surface-700'
          }`}
          aria-label={cinemaMode ? 'Exit cinema mode' : 'Enter cinema mode'}
          title={`${cinemaMode ? 'Exit' : 'Enter'} cinema mode (F)`}
        >
          {cinemaMode ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>

        {/* Volume */}
        <button
          onClick={onToggleMute}
          disabled={!hasVideo}
          className={`p-2 rounded-lg disabled:opacity-40 transition ${
            cinemaMode ? 'hover:bg-white/10' : 'hover:bg-surface-700'
          }`}
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M11 5L6 9H2v6h4l5 4V5z" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={onVolumeSlider}
          className="volume w-20"
        />
      </div>
    </div>
  );
}

export default VideoPlayer;
