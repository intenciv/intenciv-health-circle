import { io } from 'socket.io-client';
import { SOCKET_URL, tokens } from './api';

let socket = null;

export function connectSocket() {
  if (socket?.connected) return socket;
  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: tokens.getAccess() },
  });
  socket.on('connect', () => socket.emit('join', { token: tokens.getAccess() }));
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
