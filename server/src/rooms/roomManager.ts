import {
  ServerRoom,
  DEFAULT_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RoomSettings,
  generateRoomCode,
  PLAYER_COLORS,
} from "../types/game";

const rooms: Map<string, ServerRoom> = new Map();

export function getRoom(roomId: string): ServerRoom | undefined {
  return rooms.get(roomId);
}

export function roomExists(roomId: string): boolean {
  return rooms.has(roomId);
}

export function createRoom(
  hostPlayer: { id: string; name: string },
  settings: Partial<RoomSettings>
): ServerRoom {
  let roomId = generateRoomCode();
  while (rooms.has(roomId)) roomId = generateRoomCode();

  const room: ServerRoom = {
    roomId,
    hostId: hostPlayer.id,
    players: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
    started: false,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    round: null,
    summary: null,
  };
  rooms.set(roomId, room);
  return room;
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
}

export function allRooms(): ServerRoom[] {
  return [...rooms.values()];
}

/**
 * Periodic cleanup: remove rooms that have been empty (no connected players)
 * for longer than the empty TTL, and inactive lobbies older than the lobby TTL.
 */
export function cleanupRooms(
  emptyTtlMs: number,
  lobbyTtlMs: number
): string[] {
  const now = Date.now();
  const removed: string[] = [];
  for (const [roomId, room] of rooms) {
    const hasConnected = room.players.some((p) => p.connected);
    const idleMs = now - room.lastActivityAt;
    if (!hasConnected && idleMs > emptyTtlMs) {
      rooms.delete(roomId);
      removed.push(roomId);
    } else if (!room.started && now - room.createdAt > lobbyTtlMs) {
      rooms.delete(roomId);
      removed.push(roomId);
    }
  }
  return removed;
}

/** Clamp and normalize user-supplied settings. */
export function sanitizeSettings(input: unknown): Partial<RoomSettings> {
  if (!input || typeof input !== "object") return {};
  const s = input as Record<string, unknown>;
  const out: Partial<RoomSettings> = {};

  if (typeof s.rounds === "number")
    out.rounds = Math.max(1, Math.min(15, Math.round(s.rounds)));
  if (typeof s.roundDurationSec === "number")
    out.roundDurationSec = Math.max(20, Math.min(180, Math.round(s.roundDurationSec)));
  if (typeof s.wordMasterTimeSec === "number")
    out.wordMasterTimeSec = Math.max(20, Math.min(120, Math.round(s.wordMasterTimeSec)));
  if (s.maxHints === 1 || s.maxHints === 2) out.maxHints = s.maxHints;
  if (s.mode === "classic" || s.mode === "player-words" || s.mode === "mixed")
    out.mode = s.mode;
  if (typeof s.requireAllWordMasters === "boolean")
    out.requireAllWordMasters = s.requireAllWordMasters;
  if (typeof s.playerRounds === "number")
    out.playerRounds = Math.max(0, Math.min(15, Math.round(s.playerRounds)));
  if (typeof s.maxPlayers === "number")
    out.maxPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, Math.round(s.maxPlayers)));
  if (s.scoring && typeof s.scoring === "object") {
    // Hosts may override scoring but we keep values in sane bounds.
    const sc = s.scoring as Record<string, unknown>;
    const num = (v: unknown, min: number, max: number, fallback: number) =>
      typeof v === "number" ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
    out.scoring = {
      correct: num(sc.correct, 10, 500, 100),
      speedBonusMax: num(sc.speedBonusMax, 0, 300, 100),
      wrongGuessPenalty: num(sc.wrongGuessPenalty, -50, 0, -5),
      hintPenalty: num(sc.hintPenalty, -100, 0, -25),
      firstCorrect: num(sc.firstCorrect, 25, 500, 150),
      secondCorrect: num(sc.secondCorrect, 25, 500, 125),
      thirdCorrect: num(sc.thirdCorrect, 25, 500, 100),
      laterCorrect: num(sc.laterCorrect, 0, 500, 75),
      wordMasterBase: num(sc.wordMasterBase, 0, 300, 50),
      wordMasterOneSolverBonus: num(sc.wordMasterOneSolverBonus, 0, 300, 100),
      wordMasterMultiSolverBonus: num(sc.wordMasterMultiSolverBonus, 0, 300, 75),
      wordMasterNoSolver: num(sc.wordMasterNoSolver, 0, 300, 25),
      hintPenaltyFactor: typeof sc.hintPenaltyFactor === "number"
        ? Math.max(0.1, Math.min(1, sc.hintPenaltyFactor))
        : 0.75,
    };
  }
  return out;
}

export function canJoin(room: ServerRoom): { ok: boolean; reason?: string } {
  if (room.players.length >= room.settings.maxPlayers)
    return { ok: false, reason: `This room is full (${room.settings.maxPlayers} players max).` };
  return { ok: true };
}

export function addPlayer(
  room: ServerRoom,
  playerId: string,
  name: string
): { ok: boolean; error?: string } {
  const trimmed = (name || "").trim();
  if (trimmed.length < 1 || trimmed.length > 20)
    return { ok: false, error: "Name must be 1–20 characters." };

  const existing = room.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  if (existing && existing.id !== playerId && existing.connected)
    return { ok: false, error: "That name is already taken in this room." };

  // Reconnect path: same socket rejoining after a refresh mid-match.
  const rejoin = room.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase() && !p.connected);
  if (rejoin) {
    rejoin.id = playerId;
    rejoin.connected = true;
    room.lastActivityAt = Date.now();
    return { ok: true };
  }

  if (room.started)
    return { ok: false, error: "This game has already started." };
  if (room.players.length >= room.settings.maxPlayers)
    return { ok: false, error: `This room is full (${room.settings.maxPlayers} players max).` };

  room.players.push({
    id: playerId,
    name: trimmed,
    color: PLAYER_COLORS[room.players.length % PLAYER_COLORS.length],
    score: 0,
    connected: true,
    hasSubmittedChallenge: false,
    wordsCreated: 0,
    wordsGuessed: 0,
    totalGuessTimeMs: 0,
    correctGuessCount: 0,
    bestChallengeScore: 0,
  });
  room.lastActivityAt = Date.now();
  return { ok: true };
}

export function markDisconnected(room: ServerRoom, playerId: string): void {
  const player = room.players.find((p) => p.id === playerId);
  if (player) {
    player.connected = false;
    room.lastActivityAt = Date.now();
  }
}

export function removePlayer(room: ServerRoom, playerId: string): void {
  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return;
  const wasHost = room.players[idx].id === room.hostId;
  room.players.splice(idx, 1);
  if (wasHost && room.players.length > 0) {
    room.hostId = room.players.find((p) => p.connected)?.id || room.players[0].id;
  }
  room.lastActivityAt = Date.now();
}

export function ensureMinPlayers(room: ServerRoom): boolean {
  return room.players.length >= MIN_PLAYERS;
}

export function toPublicPlayers(room: ServerRoom) {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    score: p.score,
    connected: p.connected,
    isHost: p.id === room.hostId,
    hasSubmittedChallenge: p.hasSubmittedChallenge,
    wordsCreated: p.wordsCreated,
    wordsGuessed: p.wordsGuessed,
    totalGuessTimeMs: p.totalGuessTimeMs,
    correctGuessCount: p.correctGuessCount,
    bestChallengeScore: p.bestChallengeScore,
  }));
}
