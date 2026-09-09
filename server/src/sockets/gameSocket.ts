import { Server, Socket } from "socket.io";
import {
  addPlayer,
  createRoom,
  getRoom,
  markDisconnected,
  removePlayer,
  roomExists,
  sanitizeSettings,
} from "../rooms/roomManager";
import {
  beginRound,
  beginRoundForced,
  endRound,
  EngineContext,
  resetForRematch,
  revealHint2,
  startMatch,
  submitChallenge,
  submitGuess,
  toPublicState,
  useHint,
} from "../game/engine";
import { MIN_PLAYERS, ServerRoom } from "../types/game";

export interface SocketData {
  roomId?: string;
}

export function makeEngineContext(io: Server): EngineContext {
  return {
    broadcast: (room, event, payload) => io.to(room.roomId).emit(event, payload),
    sendToPlayer: (room, playerId, event, payload) =>
      io.to(playerId).emit(event, payload),
    schedule: (_room, ms, fn) => setTimeout(fn, ms),
  };
}

function requireRoom(roomId: unknown): ServerRoom | undefined {
  if (typeof roomId !== "string") return undefined;
  return getRoom(roomId);
}

export function registerGameHandlers(io: Server, socket: Socket) {
  const ctx = makeEngineContext(io);

  socket.on("create-room", ({ playerName, settings }: {
    playerName?: string;
    settings?: Record<string, unknown>;
  }) => {
    const name = (playerName || "").trim();
    if (!name) {
      socket.emit("room-error", { message: "Please enter a name." });
      return;
    }
    const room = createRoom({ id: socket.id, name }, sanitizeSettings(settings));
    const res = addPlayer(room, socket.id, name);
    if (!res.ok) {
      socket.emit("room-error", { message: res.error });
      return;
    }
    socket.join(room.roomId);
    socket.emit("room-created", { state: toPublicState(room) });
  });

  socket.on("join-room", ({ roomId, playerName }: {
    roomId?: string;
    playerName?: string;
  }) => {
    const code = String(roomId || "").trim().toUpperCase();
    const name = (playerName || "").trim();
    if (!code || !name) {
      socket.emit("room-error", { message: "Enter a room code and your name." });
      return;
    }
    const room = getRoom(code);
    if (!room) {
      socket.emit("room-error", { message: "Room not found. Check the code and try again." });
      return;
    }

    // Reconnection: an existing disconnected player with the same name rejoins.
    const disconnected = room.players.find(
      (p) => p.name.toLowerCase() === name.toLowerCase() && !p.connected
    );
    if (disconnected) {
      disconnected.id = socket.id;
      disconnected.connected = true;
      socket.join(room.roomId);
      socket.data.roomId = room.roomId;
      io.to(room.roomId).emit("player-reconnected", { state: toPublicState(room), playerName: name });
      socket.emit("room-joined", { state: toPublicState(room) });
      return;
    }

    if (room.started) {
      socket.emit("room-error", { message: "This game has already started." });
      return;
    }
    if (room.players.length >= room.settings.maxPlayers) {
      socket.emit("room-error", {
        message: `This room is full (${room.settings.maxPlayers} players max).`,
      });
      return;
    }
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.connected)) {
      socket.emit("room-error", { message: "That name is already taken in this room." });
      return;
    }

    const res = addPlayer(room, socket.id, name);
    if (!res.ok) {
      socket.emit("room-error", { message: res.error });
      return;
    }
    socket.join(room.roomId);
    socket.data.roomId = room.roomId;
    io.to(room.roomId).emit("player-joined", { state: toPublicState(room), playerName: name });
    socket.emit("room-joined", { state: toPublicState(room) });
  });

  socket.on("start-game", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (!room) return socket.emit("room-error", { message: "Room not found." });
    if (room.hostId !== socket.id)
      return socket.emit("room-error", { message: "Only the host can start the game." });
    if (room.started)
      return socket.emit("room-error", { message: "The game is already running." });
    if (room.players.length < MIN_PLAYERS)
      return socket.emit("room-error", { message: "Need at least 2 players to start." });

    try {
      startMatch(ctx, room);
    } catch (err) {
      socket.emit("room-error", {
        message: err instanceof Error ? err.message : "Failed to start the game.",
      });
    }
  });

  socket.on("submit-challenge", ({ roomId, challenge }: {
    roomId?: string;
    challenge?: unknown;
  }) => {
    const room = requireRoom(roomId);
    if (!room) return socket.emit("room-error", { message: "Room not found." });
    const res = submitChallenge(ctx, room, socket.id, challenge);
    if (!res.ok) socket.emit("challenge-error", { message: res.error });
  });

  socket.on("submit-guess", ({ roomId, guess }: { roomId?: string; guess?: string }) => {
    const room = requireRoom(roomId);
    if (!room) return;
    const res = submitGuess(ctx, room, socket.id, String(guess || ""));
    if (!res.ok) socket.emit("guess-error", { message: res.error });
  });

  socket.on("use-hint", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (!room) return;
    const res = useHint(ctx, room, socket.id);
    if (!res.ok) socket.emit("guess-error", { message: res.error });
  });

  socket.on("reveal-hint2", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (!room) return;
    const res = revealHint2(ctx, room, socket.id);
    if (!res.ok) socket.emit("guess-error", { message: res.error });
  });

  socket.on("next-round", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (!room || !room.started) return;
    if (room.hostId !== socket.id)
      return socket.emit("room-error", { message: "Only the host can skip ahead." });
    const round = room.round;
    if (round && round.phase === "round-end") {
      beginRound(ctx, room, round.roundNumber + 1);
    }
  });

  socket.on("play-again", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (!room) return socket.emit("room-error", { message: "Room not found." });
    if (room.hostId !== socket.id)
      return socket.emit("room-error", { message: "Only the host can restart." });
    resetForRematch(room);
    io.to(room.roomId).emit("room-state", { state: toPublicState(room) });
    startMatch(ctx, room);
  });

  socket.on("leave-room", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (!room) return;
    removePlayer(room, socket.id);
    socket.leave(room.roomId);
    if (room.players.length === 0) {
      // Room will be cleaned up by TTL sweep; notify others just in case.
    }
    io.to(room.roomId).emit("player-left", { state: toPublicState(room) });
  });

  socket.on("get-room-state", ({ roomId }: { roomId?: string }) => {
    const room = requireRoom(roomId);
    if (room) socket.emit("room-state", { state: toPublicState(room) });
  });

  socket.on("disconnect", () => {
    // Mark player disconnected in every room they might be in.
    const roomId = socket.data.roomId as string | undefined;
    const candidates = roomId ? [roomId] : [];
    for (const rid of candidates) {
      const room = getRoom(rid);
      if (!room) continue;
      markDisconnected(room, socket.id);

      // Cancel the round if the disconnected player was the active Word Master.
      const round = room.round;
      if (round && round.phase === "creating" && round.wordMasterId === socket.id) {
        round.wordMasterId = undefined;
        round.kind = "system";
        ctx.broadcast(room, "challenge-cancelled", {
          state: toPublicState(room),
          reason: "The Word Master disconnected. Using a system word instead!",
        });
        beginRoundForced(ctx, room);
        continue;
      }

      const anyConnected = room.players.some((p) => p.connected);
      if (!anyConnected) continue;

      if (round && round.phase === "guessing") {
        // If fewer than 2 connected players remain, end the round gracefully.
        const connectedCount = room.players.filter((p) => p.connected).length;
        if (connectedCount < 2) {
          endRound(ctx, room, "not-enough-players");
        }
      }

      io.to(room.roomId).emit("player-left", { state: toPublicState(room) });
    }
  });
}
