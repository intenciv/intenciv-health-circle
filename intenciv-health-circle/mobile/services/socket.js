import { io } from 'socket.io-client';
import { CONFIG } from '../constants/config';
import * as storage from './storage';

let socket = null;

export async function connectSocket() {
  if (socket?.connected) return socket;
  const token = await storage.getAccess();
  socket = io(CONFIG.SOCKET_URL, {
    transports: ['websocket'],
    auth: { token },
  });
  socket.on('connect', () => socket.emit('join', { token }));
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
