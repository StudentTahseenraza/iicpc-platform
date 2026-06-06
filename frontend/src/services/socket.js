import { io } from 'socket.io-client';

let socket = null;

// Use environment variable for production
const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const initSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket.IO connected:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
    });
  }
  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const subscribeLeaderboard = (callback) => {
  const socket = getSocket();
  socket.emit('subscribe-leaderboard');
  socket.on('leaderboard-update', (data) => {
    callback(data);
  });
  return () => {
    socket.off('leaderboard-update');
  };
};

export const subscribeTestCompleted = (callback) => {
  const socket = getSocket();
  socket.on('test-completed', (data) => {
    callback(data);
  });
  return () => {
    socket.off('test-completed');
  };
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};