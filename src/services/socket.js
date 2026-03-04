// src/services/socket.js
import { io } from "socket.io-client"

// ✅ Use same origin as the page — lets Vite proxy handle the WebSocket
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: 15,
  timeout: 20000,
  path: "/socket.io",         // explicit — matches Vite proxy rule above
  transports: ["websocket", "polling"], // try WebSocket first, fall back to polling
})

export function connectSocket() {
  if (!socket.connected) socket.connect()
}

export function disconnectSocket(force = false) {
  if (force) {
    socket.disconnect()
  }
}