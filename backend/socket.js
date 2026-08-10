const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    // Wide open deliberately — the frontend is deployed across more than
    // one origin (Vercel + whatever else) and there's no per-origin secret
    // being protected here beyond the JWT check below. Narrow this to the
    // real frontend origin(s) if that ever changes.
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Missing auth token'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (error) {
      return next(new Error('Invalid or expired token'));
    }
  });

  // Room model: all Executives share one room (they see everything), while
  // Managers and Operators each get their own private room keyed by their
  // own user id. A manager's browser tab connecting twice just joins the
  // same room twice — emits still reach both tabs once each, no dedup
  // needed on this end.
  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    if (role === 'EXECUTIVE') socket.join('executives');
    if (role === 'MANAGER') socket.join(`manager:${id}`);
    if (role === 'OPERATOR') socket.join(`operator:${id}`);
  });

  console.log('Socket.io initialized');
  return io;
}

// All three emit* helpers below fail silently (no error, no log) if `io`
// hasn't been initialized yet or the target id is missing/null — by design,
// so a controller can always call these without checking socket state
// first. That also means a "why didn't the UI update live" investigation
// won't show anything here; check whether initSocket() ran and whether the
// id being passed in is actually correct before assuming the emit fired.
function emitToManager(managerId, event, payload) {
  if (!io || !managerId) return;
  io.to(`manager:${managerId}`).emit(event, payload);
}

function emitToOperator(operatorId, event, payload) {
  if (!io || !operatorId) return;
  io.to(`operator:${operatorId}`).emit(event, payload);
}

function emitToExecutives(event, payload) {
  if (!io) return;
  io.to('executives').emit(event, payload);
}

module.exports = { initSocket, emitToManager, emitToOperator, emitToExecutives };
