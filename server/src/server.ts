import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { config } from "./config";
import { registerGameHandlers } from "./sockets/gameSocket";
import { cleanupRooms } from "./rooms/roomManager";
import { clearRoomTimers } from "./game/engine";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/api/status", (_req, res) => {
  res.json({ success: true, service: "wordigo-server" });
});

io.on("connection", (socket) => {
  registerGameHandlers(io, socket);
});

// Periodic cleanup of abandoned rooms.
setInterval(() => {
  const removed = cleanupRooms(config.roomEmptyTtlMs, config.lobbyTtlMs);
  if (removed.length > 0) {
    removed.forEach((roomId) => clearRoomTimers(roomId));
    console.log(`[cleanup] removed ${removed.length} abandoned room(s)`);
  }
}, config.roomCleanupIntervalMs);

const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Wordigo server running on port ${PORT}`);
});
