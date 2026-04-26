import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL } from '../config.js';

/**
 * Module-level singleton: React 18's StrictMode mounts every component
 * twice in development, which would otherwise cause us to create and
 * tear down the socket on every render of <Room>. Hoisting it here
 * keeps a single connection for the lifetime of the page.
 */
let socketSingleton = null;
function getSocket() {
  if (!socketSingleton) {
    socketSingleton = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socketSingleton;
}

/**
 * Returns { socket, status } where status is one of:
 *   'connecting' | 'connected' | 'disconnected'
 */
export default function useSocket() {
  const socket = getSocket();
  const [status, setStatus] = useState(socket.connected ? 'connected' : 'connecting');

  useEffect(() => {
    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = () => setStatus('disconnected');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    if (socket.connected) setStatus('connected');

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  return { socket, status };
}
