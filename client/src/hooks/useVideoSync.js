import { useEffect, useRef, useCallback } from 'react';
import { HEARTBEAT_INTERVAL_MS } from '../config.js';

/**
 * useVideoSync
 * ---------------------------------------------------------------
 * SYNCED EVENTS (MVP surface):
 *   - play
 *   - pause
 *   - seek
 *   - drift correction (gentle, every 3s)
 *
 * NOT SYNCED:
 *   - buffering / waiting / canplay / ready
 *
 * IMPORTANT — DRIFT CORRECTION TUNING
 * The previous version corrected at >0.3s drift and ran on every
 * heartbeat. With two tabs on the same machine sharing CPU, one tab
 * is always ~0.3s ahead, so every heartbeat triggered a re-seek —
 * and setting `video.currentTime` makes the decoder re-buffer that
 * position, which is visible as a stop every few seconds.
 *
 * Fixes:
 *   1. Raised threshold to 1.0s (still feels in-sync to viewers).
 *   2. Cooldown of 5s between corrections so we never re-seek twice
 *      in a row.
 *   3. Skip correction for 2s after any explicit action event —
 *      play/pause/seek already aligned us, no need to "fix" it.
 *   4. Only correct when both peers agree on the play/pause state.
 */

// Tunables for drift correction.
const DRIFT_THRESHOLD_SEC = 1.0;       // > 1s drift triggers correction
const DRIFT_COOLDOWN_MS = 5000;        // min gap between corrections
const ACTION_GRACE_MS = 2000;          // don't correct for 2s after a remote action

export default function useVideoSync({ socket, videoRef, hasVideo }) {
  // When true, the next play/pause/seek event came from the network
  // and should NOT be re-emitted.
  const applyingRemoteRef = useRef(false);

  // Throttle for outgoing seek emits (rapid scrubs).
  const lastSeekEmitRef = useRef(0);

  // Drift correction bookkeeping.
  const lastDriftCorrectionRef = useRef(0);  // when we last seeked due to drift
  const lastActionAppliedRef = useRef(0);    // when we last applied a remote action

  /** Emit a sync action to peers. */
  const emitAction = useCallback((action, extra = {}) => {
    if (!socket || !videoRef.current) return;
    socket.emit('video:action', {
      action,
      currentTime: videoRef.current.currentTime,
      ...extra,
    });
  }, [socket, videoRef]);

  /** Wrap remote application so we don't echo. */
  const applyRemote = useCallback((fn) => {
    applyingRemoteRef.current = true;
    try {
      fn();
    } finally {
      Promise.resolve().then(() => {
        applyingRemoteRef.current = false;
      });
    }
  }, []);

  /* -------------------- Local -> Remote -------------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !socket) return;

    const onPlay = () => {
      if (applyingRemoteRef.current) return;
      emitAction('play');
    };
    const onPause = () => {
      if (applyingRemoteRef.current) return;
      emitAction('pause');
    };
    const onSeeked = () => {
      if (applyingRemoteRef.current) return;
      const now = Date.now();
      if (now - lastSeekEmitRef.current < 100) return; // throttle
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

      // Mark that we just applied an action — drift correction will
      // skip itself for a couple of seconds afterwards.
      lastActionAppliedRef.current = Date.now();

      switch (action) {
        case 'play':
          // Snap to peer's time before resuming, but only if the gap
          // is meaningful — avoid micro-seeks.
          if (typeof currentTime === 'number' &&
              Math.abs(video.currentTime - currentTime) > DRIFT_THRESHOLD_SEC) {
            applyRemote(() => { video.currentTime = currentTime; });
          }
          applyRemote(() => {
            video.play().catch(() => {/* autoplay block — user must click */});
          });
          break;

        case 'pause':
          applyRemote(() => { video.pause(); });
          if (typeof currentTime === 'number' &&
              Math.abs(video.currentTime - currentTime) > 0.5) {
            applyRemote(() => { video.currentTime = currentTime; });
          }
          break;

        case 'seek':
          if (typeof currentTime === 'number') {
            applyRemote(() => { video.currentTime = currentTime; });
          }
          break;

        default:
          break;
      }
    };

    const onHeartbeat = ({ currentTime, isPlaying }) => {
      const video = videoRef.current;
      if (!video) return;
      if (typeof currentTime !== 'number') return;

      // Both peers must be in the same play/pause state. If they're
      // not, an action event is already in flight — let it handle it.
      const localIsPlaying = !video.paused;
      if (localIsPlaying !== isPlaying) return;

      // Don't correct right after we just applied an action.
      const now = Date.now();
      if (now - lastActionAppliedRef.current < ACTION_GRACE_MS) return;

      // Cooldown: don't correct twice in quick succession.
      if (now - lastDriftCorrectionRef.current < DRIFT_COOLDOWN_MS) return;

      const delta = Math.abs(currentTime - video.currentTime);
      if (delta < DRIFT_THRESHOLD_SEC) return;

      lastDriftCorrectionRef.current = now;
      applyRemote(() => { video.currentTime = currentTime; });
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
  }, [socket, videoRef, applyRemote]);

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
      applyRemote(() => {
        video.currentTime = state.currentTime || 0;
        if (state.isPlaying) video.play().catch(() => {});
      });
    });
  }, [socket, videoRef, applyRemote]);

  return {
    requestSync,
    isAnyPeerBuffering: false,
  };
}
