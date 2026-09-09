import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:8081";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

socket.on("connect", () => {
  console.log("[socket] connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[socket] disconnected:", reason);
});

export function isOnline(): boolean {
  return navigator.onLine && socket.connected;
}

export function useNetworkStatus(): boolean {
  // Simple hook-less helper: components subscribe to online/offline events
  // and socket connect/disconnect themselves.
  return isOnline();
}
