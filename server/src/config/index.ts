import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 8081),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  roomCleanupIntervalMs: Number(process.env.ROOM_CLEANUP_INTERVAL_MS || 60000),
  roomEmptyTtlMs: Number(process.env.ROOM_EMPTY_TTL_MS || 600000),
  lobbyTtlMs: Number(process.env.LOBBY_TTL_MS || 1800000),
};
