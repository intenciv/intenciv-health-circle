/**
 * Socket.io singleton attached to the Express HTTP server.
 *
 * Client convention: after login, the mobile app emits
 *   socket.emit('join', { token })
 * The server validates the JWT and joins room `client:<user.id>`.
 *
 * Receptionist availing a coupon emits to that room from the route.
 */
const { Server } = require('socket.io');
const { verify } = require('../utils/jwt');

let io = null;

function init(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: (process.env.SOCKET_CORS_ORIGIN || '*').split(',').map(s => s.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.on('join', (payload = {}) => {
      try {
        const token = payload.token || socket.handshake.auth?.token;
        if (!token) return;
        const decoded = verify(token);
        socket.join(`client:${decoded.id}`);
        socket.emit('joined', { room: `client:${decoded.id}` });
      } catch (_err) {
        socket.emit('join_error', { message: 'invalid_token' });
      }
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToClient(clientId, event, payload) {
  if (!io) return;
  io.to(`client:${clientId}`).emit(event, payload);
}

module.exports = { init, getIO, emitToClient };
