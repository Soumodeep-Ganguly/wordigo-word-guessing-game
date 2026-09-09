import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import express from "express";

import { registerGameHandlers } from "../src/sockets/gameSocket";
import { createRoom, addPlayer, getRoom, sanitizeSettings } from "../src/rooms/roomManager";
import {
  startMatch,
  beginRound,
  submitChallenge,
  submitGuess,
  endRound,
  useHint,
  toPublicState,
  EngineContext,
} from "../src/game/engine";
import { validateChallenge, maxRevealablePositions } from "../src/game/challenge";
import type { PublicRoomState } from "../src/types/game";

let httpServer: ReturnType<typeof createServer>;
let ioServer: IOServer;
let port: number;

beforeAll(async () => {
  const app = express();
  httpServer = createServer(app);
  ioServer = new IOServer(httpServer, { cors: { origin: "*" } });
  ioServer.on("connection", (socket) => registerGameHandlers(ioServer, socket));
  await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()));
  const addr = httpServer.address();
  port = typeof addr === "object" && addr ? addr.port : 0;
});

afterAll(async () => {
  ioServer.close();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

function connect(): Promise<ClientSocket> {
  return new Promise((resolve) => {
    const client = ioClient(`http://localhost:${port}`, { transports: ["websocket"] });
    client.on("connect", () => resolve(client));
  });
}

function waitFor<T>(client: ClientSocket, event: string, timeoutMs = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs);
    client.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/**
 * Engine context for engine-level tests: compresses short phase timers
 * (countdown, word-master deadline, between-round waits) so tests run fast,
 * while keeping real round timers so guessing windows don't instantly expire.
 */
function testCtx(
  events: { event: string; payload: unknown }[] = []
): EngineContext {
  return {
    broadcast: (_room, event, payload) => {
      events.push({ event, payload });
    },
    sendToPlayer: (_room, _playerId, _event, _payload) => {},
    schedule: (_room, ms, fn) => setTimeout(fn, ms <= 3000 ? Math.min(ms, 25) : ms) as NodeJS.Timeout,
  };
}

describe("multiplayer over sockets", () => {
  it("room lifecycle: create → join → start → guess → round end", async () => {
    const host = await connect();
    const guest = await connect();

    host.emit("create-room", { playerName: "Alex", settings: { rounds: 2, roundDurationSec: 20, mode: "classic" } });
    const created = await waitFor<{ state: PublicRoomState }>(host, "room-created");
    const roomId = created.state.roomId;
    expect(roomId).toHaveLength(6);

    guest.emit("join-room", { roomId, playerName: "Sam" });
    await waitFor<{ state: PublicRoomState }>(host, "player-joined");
    const joined = await waitFor<{ state: PublicRoomState }>(guest, "room-joined");
    expect(joined.state.players).toHaveLength(2);
    expect(joined.state.hostId).toBe(host.id);

    // guest tries to start — should be rejected
    guest.emit("start-game", { roomId });
    const err = await waitFor<{ message: string }>(guest, "room-error");
    expect(err.message).toMatch(/host/i);

    // host starts
    host.emit("start-game", { roomId });
    const started = await waitFor<{ state: PublicRoomState }>(guest, "game-started");
    expect(started.state.started).toBe(true);

    // wait through the 3s countdown for the guessing phase
    const guessing = await waitFor<{ state: PublicRoomState; roundEndsAt: number }>(guest, "guessing-started", 8000);
    expect(guessing.state.round?.challenge).toBeTruthy();
    // Challenge must not leak the secret word
    expect(JSON.stringify(guessing.state.round.challenge)).not.toMatch(/"word"\s*:/i);

    const room = getRoom(roomId);
    expect(room).toBeTruthy();
    const secretWord = room!.round!.secret!.word;

    // Wrong guess costs 5 points but never goes below zero.
    guest.emit("submit-guess", { roomId, guess: "WRONGGUESS" });
    await waitFor<{ state: PublicRoomState }>(guest, "wrong-guess");
    const sam = room!.players.find((p) => p.name === "Sam")!;
    expect(sam.score).toBe(0); // 0 - 5 clamped to 0

    // Host guesses correctly.
    host.emit("submit-guess", { roomId, guess: secretWord });
    const correct = await waitFor<{ state: PublicRoomState; points: number }>(host, "correct-guess");
    expect(correct.points).toBeGreaterThan(0);

    const roundEnd = await waitFor<{
      state: PublicRoomState;
      result: { word: string; solvers: { name: string }[] };
      isLastRound: boolean;
    }>(guest, "round-ended");
    expect(roundEnd.result.word).toBe(secretWord);
    expect(roundEnd.result.solvers.some((s) => s.name === "Alex")).toBe(true);
    expect(roundEnd.isLastRound).toBe(false);

    host.disconnect();
    guest.disconnect();
  }, 20000);

  it("only the word master can submit a challenge, and validation errors surface", async () => {
    const host = await connect();
    const guest = await connect();

    host.emit("create-room", { playerName: "Alex", settings: { rounds: 2, mode: "player-words", wordMasterTimeSec: 30 } });
    const created = await waitFor<{ state: PublicRoomState }>(host, "room-created");
    const roomId = created.state.roomId;

    guest.emit("join-room", { roomId, playerName: "Sam" });
    await waitFor<{ state: PublicRoomState }>(host, "player-joined");
    await waitFor<{ state: PublicRoomState }>(guest, "room-joined");

    // Register listeners BEFORE starting: your-turn-to-create is emitted
    // synchronously with game-started on the server.
    const turnPromise = waitFor<{ roundNumber: number }>(host, "your-turn-to-create", 6000);
    const startedPromise = waitFor<{ state: PublicRoomState }>(guest, "game-started", 6000);

    host.emit("start-game", { roomId });
    await startedPromise;

    // First round is a player round: the first word master (host) is told it's their turn.
    const turn = await turnPromise;
    expect(turn.roundNumber).toBe(1);

    // Guest (not the master) attempts to submit — should fail.
    guest.emit("submit-challenge", {
      roomId,
      challenge: { word: "TIGER", category: "Animals", difficulty: "Easy", hint1: "A big cat" },
    });
    const err = await waitFor<{ message: string }>(guest, "challenge-error");
    expect(err.message).toMatch(/turn/i);

    // Host submits an invalid challenge (hint contains the word).
    host.emit("submit-challenge", {
      roomId,
      challenge: { word: "TIGER", category: "Animals", difficulty: "Easy", hint1: "A TIGER is a big cat" },
    });
    const invalid = await waitFor<{ message: string }>(host, "challenge-error");
    expect(invalid.message).toMatch(/hint/i);

    // Host submits a valid challenge.
    host.emit("submit-challenge", {
      roomId,
      challenge: { word: "TIGER", category: "Animals", difficulty: "Easy", hint1: "A big striped cat" },
    });

    // Round proceeds to guessing.
    await waitFor<{ state: PublicRoomState; roundEndsAt: number }>(guest, "guessing-started", 8000);

    const room = getRoom(roomId);
    expect(room!.round!.secret!.word).toBe("TIGER");

    // Register round-ended listener BEFORE the solving guess: round-ended is
    // broadcast to the room in the same tick as correct-guess, so a listener
    // registered after awaiting on another socket can miss it.
    const roundEndPromise = waitFor<{ result: { challengeReport?: { challengeScore: number } } }>(host, "round-ended", 6000);

    // Guest solves it — first solver gets 150 in player rounds.
    guest.emit("submit-guess", { roomId, guess: "TIGER" });
    const correct = await waitFor<{ state: PublicRoomState; points: number }>(guest, "correct-guess");
    expect(correct.points).toBe(150);

    const roundEnd = await roundEndPromise;
    expect(roundEnd.result.challengeReport).toBeTruthy();
    expect(roundEnd.result.challengeReport!.challengeScore).toBeGreaterThan(0);

    host.disconnect();
    guest.disconnect();
  }, 20000);

  it("guests cannot start the game and wrong-guess penalties are clamped at zero", async () => {
    const room = createRoom({ id: "h4", name: "A" }, { rounds: 1 });
    addPlayer(room, "h4", "A");
    addPlayer(room, "p2", "B");
    const ctx = testCtx();
    startMatch(ctx, room);
    await new Promise((r) => setTimeout(r, 60));
    room.round!.phase = "guessing";
    room.round!.phaseEndsAt = Date.now() + 30000;
    room.round!.secret = {
      word: "TESTWORD", category: "General", difficulty: "Easy",
      hint1: "hint", hint2Revealed: false, createdAt: Date.now(),
    };

    const r1 = submitGuess(ctx, room, "p2", "NOPE");
    expect(r1.ok).toBe(true);
    const r2 = submitGuess(ctx, room, "p2", "NOPE"); // blocked by rate limiter
    expect(r2.ok).toBe(false);
    const score = room.players.find((p) => p.id === "p2")!.score;
    expect(score).toBe(0); // clamped, never negative
    expect(room.round!.guessLog.filter((g) => !g.correct)).toHaveLength(1);
  });

  it("engine-level: scoring, combo, and match end flow", async () => {
    const room = createRoom({ id: "host-1", name: "A" }, { rounds: 1, roundDurationSec: 30, mode: "classic" });
    addPlayer(room, "host-1", "A");
    addPlayer(room, "p2", "B");

    const events: { event: string; payload: unknown }[] = [];
    const ctx = testCtx(events);

    startMatch(ctx, room);
    // countdown → guessing (compressed to ≤30ms)
    await new Promise((r) => setTimeout(r, 120));
    expect(events.some((e) => e.event === "guessing-started")).toBe(true);

    const word = room.round!.secret!.word;

    // While the round is still being guessed, the public projection must not
    // contain the secret word anywhere (challenge/masked fields are safe).
    const duringGuess = JSON.stringify(toPublicState(room));
    expect(duringGuess).not.toContain(`"word":"${word}"`);
    expect(duringGuess).not.toContain(word); // guessing phase hides it entirely

    submitGuess(ctx, room, "p2", word);
    expect(room.players.find((p) => p.id === "p2")!.score).toBe(200); // base + max speed

    // round should have ended and, with rounds=1, match should end shortly
    await new Promise((r) => setTimeout(r, 200));
    expect(events.some((e) => e.event === "round-ended")).toBe(true);
    expect(events.some((e) => e.event === "game-ended")).toBe(true);
    expect(room.summary!.rankings[0].name).toBe("B");

    // After round end the word is intentionally revealed in the result.
    const afterEnd = JSON.stringify(toPublicState(room));
    expect(afterEnd).toContain(word);
  });

  it("engine-level: word master timeout falls back to a system word", async () => {
    const room = createRoom({ id: "host-1", name: "A" }, { rounds: 1, mode: "player-words", wordMasterTimeSec: 1 });
    addPlayer(room, "host-1", "A");
    addPlayer(room, "p2", "B");

    const events: { event: string; payload: unknown }[] = [];
    const ctx = testCtx(events);

    startMatch(ctx, room);
    await new Promise((r) => setTimeout(r, 250));

    // Round 1 is player-kind; master (first player) never submits → skip to system word.
    expect(events.some((e) => e.event === "challenge-skipped")).toBe(true);
    expect(room.round!.kind).toBe("system");
    expect(room.round!.secret).toBeTruthy();
    expect(room.round!.publicChallenge!.roundKind).toBe("system");
  });

  it("engine-level: hint usage is per-player and scored once", async () => {
    const room = createRoom({ id: "h2", name: "X" }, { rounds: 1 });
    addPlayer(room, "h2", "X");
    addPlayer(room, "g1", "Y");
    const ctx = testCtx();

    beginRound(ctx, room, 1);
    room.round!.phase = "guessing";
    room.round!.secret = {
      word: "TESTWORD",
      category: "General",
      difficulty: "Easy",
      hint1: "Primary hint",
      hint2: "Secondary hint",
      hint2Revealed: false,
      createdAt: Date.now(),
    };
    room.round!.publicChallenge = {
      roundKind: "system",
      category: "General",
      difficulty: "Easy",
      hints: ["Primary hint"],
      hint2Available: true,
      wordLength: 8,
      maskedWord: "_ _ _ _ _ _ _ _",
    };
    room.round!.phaseEndsAt = Date.now() + 60000; // full window → max speed bonus

    const res1 = useHint(ctx, room, "g1");
    expect(res1.ok).toBe(true);
    expect(res1.hint).toBe("Secondary hint");
    const res2 = useHint(ctx, room, "g1");
    expect(res2.ok).toBe(false); // already used

    // Solve with hint → penalty applied
    submitGuess(ctx, room, "g1", "TESTWORD");
    const score = room.players.find((p) => p.id === "g1")!.score;
    expect(score).toBe(100 + 100 - 25); // base + max speed - hint penalty
  });

  it("engine-level: round end is idempotent and guarded against double calls", async () => {
    const room = createRoom({ id: "h3", name: "A" }, { rounds: 2 });
    addPlayer(room, "h3", "A");
    addPlayer(room, "p2", "B");
    const ctx = testCtx();

    startMatch(ctx, room);
    await new Promise((r) => setTimeout(r, 100));
    const word = room.round!.secret!.word;
    submitGuess(ctx, room, "p2", word);
    expect(room.round!.phase).toBe("round-end");

    // A second endRound call (e.g. racing timer) must not corrupt state.
    endRound(ctx, room, "time-expired");
    expect(room.round!.phase).toBe("round-end");
  });

  it("engine-level: word master rotation is fair in mixed mode with 2 players", async () => {
    const room = createRoom(
      { id: "mix-host", name: "A" },
      { rounds: 4, mode: "mixed", playerRounds: 2 }
    );
    addPlayer(room, "mix-host", "A");
    addPlayer(room, "mix-p2", "B");
    const ctx = testCtx();

    startMatch(ctx, room);
    // R1 = system, R2 = player (master A), R3 = system, R4 = player (master B)
    expect(room.round!.kind).toBe("system");

    beginRound(ctx, room, 2);
    expect(room.round!.kind).toBe("player");
    expect(room.round!.wordMasterId).toBe("mix-host"); // first player hosts round 2

    beginRound(ctx, room, 3);
    expect(room.round!.kind).toBe("system");

    beginRound(ctx, room, 4);
    expect(room.round!.kind).toBe("player");
    expect(room.round!.wordMasterId).toBe("mix-p2"); // second player gets their turn
  });

  it("challenge validation: starting-letter picker rules", () => {
    const prev = new Set<string>();

    // Valid pick: 2 positions of a 8-letter word (max = 4-1 = 3).
    const ok = validateChallenge(
      { word: "TESTWORD", category: "General", difficulty: "Easy", hint1: "a hint", revealedPositions: [0, 3] },
      prev
    );
    expect(ok.ok).toBe(true);
    expect(ok.value?.revealedPositions).toEqual([0, 3]);

    // No pick → undefined (system fallback).
    const none = validateChallenge(
      { word: "TESTWORD", category: "General", difficulty: "Easy", hint1: "a hint" },
      prev
    );
    expect(none.ok).toBe(true);
    expect(none.value?.revealedPositions).toBeUndefined();

    // Out of range / duplicates rejected.
    const oob = validateChallenge(
      { word: "TESTWORD", category: "General", difficulty: "Easy", hint1: "a hint", revealedPositions: [0, 99] },
      prev
    );
    expect(oob.ok).toBe(false);
    const dup = validateChallenge(
      { word: "TESTWORD", category: "General", difficulty: "Easy", hint1: "a hint", revealedPositions: [1, 1] },
      prev
    );
    expect(dup.ok).toBe(false);

    // Too many revealed: 5 for a 8-letter word (max 3) must fail.
    const tooMany = validateChallenge(
      { word: "TESTWORD", category: "General", difficulty: "Easy", hint1: "a hint", revealedPositions: [0, 1, 2, 3, 4] },
      prev
    );
    expect(tooMany.ok).toBe(false);
    expect(tooMany.error).toMatch(/at least 2/i);

    // Max for a 3-letter word is 0 — any pick rejected.
    expect(maxRevealablePositions(3)).toBe(0);
    const tiny = validateChallenge(
      { word: "CAT", category: "Animals", difficulty: "Easy", hint1: "a pet", revealedPositions: [0] },
      prev
    );
    expect(tiny.ok).toBe(false);
  });

  it("engine-level: word master picks which letters are visible at start", async () => {
    const room = createRoom(
      { id: "wm-reveal", name: "A" },
      { rounds: 1, mode: "player-words", wordMasterTimeSec: 30 }
    );
    addPlayer(room, "wm-reveal", "A");
    addPlayer(room, "wm-p2", "B");
    const ctx = testCtx();

    startMatch(ctx, room);
    const res = submitChallenge(ctx, room, "wm-reveal", {
      word: "ELEPHANT",
      category: "Animals",
      difficulty: "Easy",
      hint1: "The largest land animal",
      revealedPositions: [0, 7], // E.....T
    });
    expect(res.ok).toBe(true);
    expect(room.round!.phase).toBe("countdown");
    // Only the chosen positions are revealed; the rest hidden.
    expect(room.round!.publicChallenge!.maskedWord).toBe("E _ _ _ _ _ _ T");
  });

  it("engine-level: rate limiting blocks rapid-fire guesses", async () => {
    const room = createRoom({ id: "h5", name: "A" }, { rounds: 1 });
    addPlayer(room, "h5", "A");
    addPlayer(room, "p2", "B");
    const ctx = testCtx();
    startMatch(ctx, room);
    await new Promise((r) => setTimeout(r, 60));
    room.round!.phase = "guessing";
    room.round!.phaseEndsAt = Date.now() + 30000;
    room.round!.secret = {
      word: "TESTWORD", category: "General", difficulty: "Easy",
      hint1: "hint", hint2Revealed: false, createdAt: Date.now(),
    };

    const r1 = submitGuess(ctx, room, "p2", "WRONG1");
    expect(r1.ok).toBe(true);
    const r2 = submitGuess(ctx, room, "p2", "WRONG2");
    expect(r2.ok).toBe(false); // too fast
    expect(r2.error).toMatch(/slow/i);
  });

  it("room manager: host-selected maxPlayers is enforced", () => {
    // Room capped at 3 players.
    const room = createRoom({ id: "cap-host", name: "H" }, { rounds: 3, maxPlayers: 3 });
    expect(room.settings.maxPlayers).toBe(3);
    expect(addPlayer(room, "h1", "H").ok).toBe(true);
    expect(addPlayer(room, "p2", "B").ok).toBe(true);
    expect(addPlayer(room, "p3", "C").ok).toBe(true);
    const full = addPlayer(room, "p4", "D");
    expect(full.ok).toBe(false);
    expect(full.error).toMatch(/full \(3 players max\)/);

    // Values outside 2–8 are clamped by sanitizeSettings.
    const clamped = sanitizeSettings({ maxPlayers: 99 });
    expect(clamped.maxPlayers).toBe(8);
    const clampedLow = sanitizeSettings({ maxPlayers: 1 });
    expect(clampedLow.maxPlayers).toBe(2);
  });

  it("room manager: joining players are broadcast to the whole room", async () => {
    const host = await connect();
    const guest = await connect();

    host.emit("create-room", { playerName: "Alex", settings: { rounds: 2, maxPlayers: 3 } });
    const created = await waitFor<{ state: PublicRoomState }>(host, "room-created");
    const roomId = created.state.roomId;
    expect(created.state.settings.maxPlayers).toBe(3);

    // Host receives player-joined when the guest joins.
    const joinPromise = waitFor<{ state: PublicRoomState; playerName: string }>(host, "player-joined");
    guest.emit("join-room", { roomId, playerName: "Sam" });
    const joined = await joinPromise;
    expect(joined.playerName).toBe("Sam");
    expect(joined.state.players.map((p) => p.name)).toContain("Sam");
    expect(joined.state.players).toHaveLength(2);

    host.disconnect();
    guest.disconnect();
  }, 15000);
});
