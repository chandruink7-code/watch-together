import { useEffect, useRef, useState, useCallback } from 'react';
import { ICE_SERVERS } from '../config.js';

/**
 * useWebRTC
 * ---------------------------------------------------------------
 * Manages peer-to-peer audio/video for everyone in the room.
 *
 * Design:
 *   - One RTCPeerConnection per remote peer, keyed by socket id.
 *   - Local mic/camera is captured once and shared across all PCs.
 *   - "Polite peer" tie-break: the peer with the lexicographically
 *     smaller socket id is the offerer when a new peer joins. This
 *     prevents glare (both sides offering simultaneously).
 *
 * Signaling messages used (relayed by the server, see server/index.js):
 *   rtc:offer            { to, sdp }
 *   rtc:answer           { to, sdp }
 *   rtc:ice-candidate    { to, candidate }
 *
 * Media controls:
 *   - toggleMic / toggleCam mutate the *track.enabled* flag rather
 *     than re-negotiating, which keeps the call stable.
 */
export default function useWebRTC({ socket, myId, peers }) {
  const pcsRef = useRef(new Map());            // Map<peerId, RTCPeerConnection>
  const localStreamRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // { peerId: MediaStream }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState(null);

  /** Acquire mic (and optionally camera) once. */
  const startCall = useCallback(async ({ withVideo = false } = {}) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: withVideo ? { width: 320, height: 240 } : false,
      });
      localStreamRef.current = stream;
      setMicOn(true);
      setCamOn(withVideo);
      setCallActive(true);
      setError(null);
      return stream;
    } catch (err) {
      console.error('getUserMedia failed', err);
      setError('Could not access microphone. Check browser permissions.');
      throw err;
    }
  }, []);

  /** Tear down everything (used on unmount and on "leave call"). */
  const endCall = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStreams({});
    setCallActive(false);
    setCamOn(false);
  }, []);

  /** Build a fresh PC for a peer, attach handlers and local tracks. */
  const createPeerConnection = useCallback((peerId) => {
    if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Send any local tracks we have.
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Forward ICE candidates to the peer via the server.
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('rtc:ice-candidate', {
          to: peerId,
          candidate: event.candidate,
        });
      }
    };

    // Collect inbound tracks into a single MediaStream per peer.
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      }
    };

    pcsRef.current.set(peerId, pc);
    return pc;
  }, [socket]);

  /**
   * Whenever the peer list changes, ensure we have a PC for each peer.
   * Tie-break: only the peer with the *smaller* id sends the offer.
   */
  useEffect(() => {
    if (!callActive || !socket || !myId) return;

    peers.forEach((peer) => {
      const peerId = peer.id;
      if (pcsRef.current.has(peerId)) return;

      const pc = createPeerConnection(peerId);

      // Polite-peer rule prevents both sides from offering at once.
      const shouldOffer = myId < peerId;
      if (shouldOffer) {
        (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('rtc:offer', { to: peerId, sdp: offer });
          } catch (err) {
            console.error('Offer failed', err);
          }
        })();
      }
    });

    // Drop PCs for peers that left.
    const peerIds = new Set(peers.map((p) => p.id));
    Array.from(pcsRef.current.keys()).forEach((id) => {
      if (!peerIds.has(id)) {
        pcsRef.current.get(id).close();
        pcsRef.current.delete(id);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [peers, callActive, socket, myId, createPeerConnection]);

  /** Wire up signaling listeners. */
  useEffect(() => {
    if (!socket) return;

    const onOffer = async ({ from, sdp }) => {
      if (!callActive) return;
      const pc = createPeerConnection(from);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('rtc:answer', { to: from, sdp: answer });
      } catch (err) {
        console.error('Handling offer failed', err);
      }
    };

    const onAnswer = async ({ from, sdp }) => {
      const pc = pcsRef.current.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      } catch (err) {
        console.error('setRemoteDescription(answer) failed', err);
      }
    };

    const onIce = async ({ from, candidate }) => {
      const pc = pcsRef.current.get(from);
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('addIceCandidate failed', err);
      }
    };

    socket.on('rtc:offer', onOffer);
    socket.on('rtc:answer', onAnswer);
    socket.on('rtc:ice-candidate', onIce);

    return () => {
      socket.off('rtc:offer', onOffer);
      socket.off('rtc:answer', onAnswer);
      socket.off('rtc:ice-candidate', onIce);
    };
  }, [socket, callActive, createPeerConnection]);

  /** Toggle mic on the existing local stream (no renegotiation needed). */
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [micOn]);

  /**
   * Toggle camera. If we never acquired a video track, request one and
   * add it to all peer connections. This requires re-negotiation per peer.
   */
  const toggleCam = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const existing = stream.getVideoTracks()[0];
    if (existing) {
      const next = !camOn;
      existing.enabled = next;
      setCamOn(next);
      return;
    }

    // No video track yet — add one.
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
      });
      const videoTrack = camStream.getVideoTracks()[0];
      stream.addTrack(videoTrack);

      // Add the track to each peer connection and renegotiate.
      for (const [peerId, pc] of pcsRef.current.entries()) {
        pc.addTrack(videoTrack, stream);
        // Re-negotiate; only the "polite" peer drives this.
        if (myId < peerId) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('rtc:offer', { to: peerId, sdp: offer });
        }
      }
      setCamOn(true);
    } catch (err) {
      console.error('Enabling camera failed', err);
      setError('Could not access camera.');
    }
  }, [camOn, myId, socket]);

  // Cleanup on unmount.
  useEffect(() => () => endCall(), [endCall]);

  return {
    startCall,
    endCall,
    toggleMic,
    toggleCam,
    micOn,
    camOn,
    callActive,
    localStream: localStreamRef.current,
    remoteStreams,
    error,
  };
}
