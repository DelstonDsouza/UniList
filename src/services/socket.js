// src/services/socket.js
// Singleton Socket.io client — import this anywhere in the frontend

import { io } from "socket.io-client"

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000"

export const socket = io(SOCKET_URL, {
  autoConnect: false,   // connect manually when needed
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
})

export function connectSocket() {
  if (!socket.connected) socket.connect()
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect()
}