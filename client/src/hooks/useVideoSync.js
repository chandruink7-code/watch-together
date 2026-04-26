import { useEffect, useRef, useCallback } from 'react';
import { HEARTBEAT_INTERVAL_MS } from '../config.js';

/**
 * useVideoSync — hardened against play/pause echo loops.
 *
 * The previous version used a boolean ref + microtask to suppress
 * echoes. That broke for `video.play()` because Chrome fires the
 * 'play' event AFTER the play() promise resolves, which is later
 * than our microtask. Result: each remote-triggered play caused a
 * local re-emit, creating a feedback loop.
 *
 * Fix: time-based suppression window (300ms) + per-action dedup
 * by sender timestamp. The window is long enough to swallow the
 * play/pause/seeked event the browser fires from our own DOM call,
 * but short enough to not block legitimate user actions.
 */

const DRIFT_THRESHOLD_SEC = 1.0;
const DRIFT_COOLDOWN_MS = 5000;
const ACTION_GRACE_MS = 2000;
const SUPPRESS_WINDOW_MS = 300;   // ignore local events for 300ms after applying remote

export default function useVideoSync({ socket, videoRef, hasVideo }) {
  // Time-based suppression. While Date.now() < suppressUntilRef.current,
  // any local play/pause/seek event is treated as an echo and dropped.
  const suppressUntilRef = useRef(0);

  // Throttle for outgoing seek emits.
  const lastSeekEmitRef = useRef(0);

  // Bookkeeping for drift correction.
  const lastDriftCorrectionRef = useRef(0);
  const lastActionAppliedRef = useRef(0);

  // Track our own most recent emit so we can dedupe echoes that arrive
  // back at us via the server (shouldn't happen with socket.io rooms,
  // but defensive).
  const lastEmitSignatureRef = useRef('');

  const suppressNext = useCallback((ms = SUPPRESS_WINDOW_MS) => {
    suppressUntilRef.current = Date.now() + ms;
  }, []);

  const isSuppressed = () => Date.now() < suppressUntilRef.current;

  const emitAction = useCallback((action) => {
    if (!socket || !videoRef.current) return;
    const currentTime = videoRef.current.currentTime;
    // Don't emit if we just emitted the same thing < 100ms ago.
    const sig = `${action}:${currentTime.toFixed(2)}`;
    if (sig === lastEmitSignatureRef.current &&
        Date.now() - lastSeekEmitRef.current < 100) {
      return;
    }
    lastEmitSignatureRef.current = sig;
    socket.emit('video:action', { action, currentTime });
  }, [socket, videoRef]);

  /* -------------------- Local -> Remote -------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !socket) return;

    const onPlay = () => {
      if (isSuppressed()) return;
      emitAction('play');
    };
    const onPause = () => {
      if (isSuppressed()) return;
      emitAction('pause');
    };
    const onSeeked = () => {
      if (isSuppressed()) return;
      const now = Date.now();
      if (now - lastSeekEmitRef.current < 200) return;
      lastSeekEmitRef.current = now;
      emitAction('seek');
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [socket, videoRef, emitAction, hasVideo]);

  /* -------------------- Remote -> Local -------------------- */
  useEffect(() => {
    if (!socket) return;

    const onAction = ({ action, currentTime }) => {
      const video = videoRef.current;
      if (!video) return;

      lastActionAppliedRef.current = Date.now();

      // Open suppression window BEFORE we touch the video element.
      // Any play/pause/seeked event the browser fires from our DOM
      // call within 300ms will be ignored.
      suppressNext(SUPPRESS_WINDOW_MS);

      switch (action) {
        case 'play': {
          if (typeof currentTime === 'number' &&
              Math.abs(video.currentTime - currentTime) > DRIFT_THRESHOLD_SEC) {
            video.currentTime = currentTime;
          }
          // Only call play() if currently paused — calling on already-playing
          // video can re-fire the play event in some browsers.
          if (video.paused) {
            const p = video.play();
            // Extend suppression until the play promise resolves, since
            // Chrome fires the 'play' event right around then.
            if (p && typeof p.then === 'function') {
              p.then(() => suppressNext(150)).catch(() => {});
            }
          }
          break;
        }

        case 'pause': {
          if (!video.paused) {
            video.pause();
          }
          if (typeof currentTime === 'number' &&
              Math.abs(video.currentTime - currentTime) > 0.5) {
            video.currentTime = currentTime;
          }
          break;
        }

        case 'seek': {
          if (typeof currentTime === 'number' &&
              Math.abs(video.currentTime - currentTime) > 0.1) {
            video.currentTime = currentTime;
          }
          break;
        }

        default:
          break;
      }
    };

    const onHeartbeat = ({ currentTime, isPlaying }) => {
      const video = videoRef.current;
      if (!video) return;
      if (typeof currentTime !== 'number') return;

      const localIsPlaying = !video.paused;
      if (localIsPlaying !== isPlaying) return;

      const now = Date.now();
      if (now - lastActionAppliedRef.current < ACTION_GRACE_MS) return;
      if (now - lastDriftCorrectionRef.current < DRIFT_COOLDOWN_MS) return;

      const delta = Math.abs(currentTime - video.currentTime);
      if (delta < DRIFT_THRESHOLD_SEC) return;

      lastDriftCorrectionRef.current = now;
      suppressNext(SUPPRESS_WINDOW_MS);
      video.currentTime = currentTime;
    };

    const onRequestHeartbeat = () => {
      const video = videoRef.current;
      if (!video) return;
      socket.emit('video:heartbeat', {
        currentTime: video.currentTime,
        isPlaying: !video.paused,
      });
    };

    socket.on('video:action', onAction);
    socket.on('video:heartbeat', onHeartbeat);
    socket.on('video:request-heartbeat', onRequestHeartbeat);

    return () => {
      socket.off('video:action', onAction);
      socket.off('video:heartbeat', onHeartbeat);
      socket.off('video:request-heartbeat', onRequestHeartbeat);
    };
  }, [socket, videoRef, suppressNext]);

  /* -------------------- Heartbeat loop -------------------- */
  useEffect(() => {
    if (!socket || !hasVideo) return;
    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      socket.emit('video:heartbeat', {
        currentTime: video.currentTime,
        isPlaying: !video.paused,
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [socket, videoRef, hasVideo]);

  /* -------------------- Late-joiner sync request -------------------- */
  const requestSync = useCallback(() => {
    if (!socket || !videoRef.current) return;
    socket.emit('video:request-sync', null, (state) => {
      if (!state) return;
      const video = videoRef.current;
      if (!video) return;
      lastActionAppliedRef.current = Date.now();
      suppressNext(SUPPRESS_WINDOW_MS);
      video.currentTime = state.currentTime || 0;
      if (state.isPlaying) {
        const p = video.play();
        if (p && typeof p.then === 'function') {
          p.then(() => suppressNext(150)).catch(() => {});
        }
      }
    });
  }, [socket, videoRef, suppressNext]);

  return {
    requestSync,
    isAnyPeerBuffering: false,
  };
}
