import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

// One env var (VITE_API_URL) drives both REST calls and the socket
// connection — REST needs the /api suffix, but Socket.io connects at the
// server root, so it's stripped back off here rather than requiring a
// second env var that has to be kept in sync with the first.
function getSocketBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || '';
  return apiUrl.replace(/\/api\/?$/, '');
}

export function connectSocket(): Socket {
  const token = localStorage.getItem('mes_token');

  // Reuses the existing connection rather than opening a new one — safe to
  // call this from every component that wants live updates without
  // worrying about duplicate sockets. Note that updating .auth on an
  // already-connected socket doesn't re-authenticate it immediately; it
  // only takes effect on the next reconnect.
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  socket = io(getSocketBaseUrl(), {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
