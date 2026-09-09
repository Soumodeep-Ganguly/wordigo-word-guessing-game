import {
  ServerRoom,
  ServerRoundState,
  PublicRoomState,
  PublicChallenge,
  RoundKind,
  RoundResult,
  ChallengeReport,
  RoundPhase,
  Difficulty,
} from "../types/game";
import { pickRandomWord } from "../data/words";
import { validateChallenge } from "./challenge";
import { computeSystemRoundPoints, computePlayerRoundGuesserPoints, computeChallengeScore, computeWordMasterBonus, maskedWord, pickRevealedLetters, pickRevealableLetter } from "./scoring";

export interface EngineTimers {
  phaseTimer: NodeJS.Timeout | null;
}

export type EmitFn = (event: string, payload: unknown) => void;

/** Every engine action takes the room and these callbacks; sockets layer wires them up. */
export interface EngineContext {
  broadcast: (room: ServerRoom, event: string, payload?: unknown) => void;
  sendToPlayer: (room: ServerRoom, playerId: string, event: string, payload?: unknown) => void;
  /** Schedules `fn` to run after `ms` and returns the timeout handle. */
  schedule: (room: ServerRoom, ms: number, fn: () => void) => NodeJS.Timeout;
}

// Per-room timer registry so phase timers can be cancelled when the round changes.
const timers = new Map<string, NodeJS.Timeout[]>();

export function clearRoomTimers(roomId: string) {
  const list = timers.get(roomId);
  if (list) {
    list.forEach(clearTimeout);
    timers.delete(roomId);
  }
}

/**
 * Schedule a phase timer through ctx.schedule (so tests can accelerate time)
 * and track the returned handle in the room registry so it can be cancelled
 * when the round changes or ends early.
 */
function scheduleTimer(room: ServerRoom, ms: number, fn: () => void, ctx: EngineContext) {
  const list = timers.get(room.roomId) || [];
  const t = ctx.schedule(room, ms, () => {
    const current = timers.get(room.roomId);
    if (current) {
      const idx = current.indexOf(t);
      if (idx !== -1) current.splice(idx, 1);
    }
    fn();
  });
  list.push(t);
  timers.set(room.roomId, list);
}

// ─── Public room state projection (never leaks the secret word) ─────────────

export function toPublicState(room: ServerRoom): PublicRoomState {
  const round = room.round;
  const solvable = round && round.phase === "guessing" && round.publicChallenge;
  // Deadlines are exposed for every timed phase so clients can render live
  // countdowns (3-2-1 between rounds, Word Master progress bar, etc.).
  const timedPhase =
    round &&
    (round.phase === "guessing" || round.phase === "countdown" || round.phase === "creating");
  return {
    roomId: room.roomId,
    players: room.players.map((p) => ({
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
    })),
    hostId: room.hostId,
    settings: room.settings,
    started: room.started,
    round: round
      ? {
          roundNumber: round.roundNumber,
          kind: round.kind,
          phase: round.phase,
          wordMasterId: round.wordMasterId,
          endsAt: solvable ? round.phaseEndsAt : null,
          // Live deadline for all timed phases (guessing / countdown / creating).
          phaseEndsAt: timedPhase ? round.phaseEndsAt : null,
          challenge: solvable ? round.publicChallenge : null,
          guessLog: round.guessLog.slice(-20),
          result: round.result,
        }
      : null,
    roundNumber: round?.roundNumber ?? 0,
    totalRounds: room.settings.rounds,
    summary: room.summary,
  };
}

// ─── Match / round flow ─────────────────────────────────────────────────────

function planRoundKinds(room: ServerRoom): RoundKind[] {
  const { mode, rounds, playerRounds, requireAllWordMasters } = room.settings;
  const kinds: RoundKind[] = [];
  if (mode === "classic") {
    for (let i = 0; i < rounds; i++) kinds.push("system");
    return kinds;
  }
  if (mode === "player-words") {
    for (let i = 0; i < rounds; i++) kinds.push("player");
    return kinds;
  }
  // mixed: alternate starting with system
  const playerCount = Math.min(playerRounds, rounds);
  let placed = 0;
  for (let i = 0; i < rounds; i++) {
    if (i % 2 === 1 && placed < playerCount) {
      kinds.push("player");
      placed++;
    } else {
      kinds.push("system");
    }
  }
  // If requireAllWordMasters and not enough player slots, upgrade some system rounds.
  if (requireAllWordMasters) {
    const needed = room.players.length - kinds.filter((k) => k === "player").length;
    for (let i = 0; i < kinds.length && needed > 0; i++) {
      if (kinds[i] === "system") {
        kinds[i] = "player";
        break; // upgrade at most one here; additional handling at runtime
      }
    }
  }
  return kinds;
}

function nextWordMasterId(room: ServerRoom, _roundNumber: number): string | undefined {
  const eligible = room.players;
  if (eligible.length === 0) return undefined;
  // Rotate per PLAYER-round, not per round number. In mixed mode player rounds
  // are always even-numbered, so a round-number index would hand every turn to
  // the same player (e.g. with 2 players: (2-1)%2 = 1, (4-1)%2 = 1 ...).
  const anyRoom = room as ServerRoom & { __wmIndex?: number };
  if (typeof anyRoom.__wmIndex !== "number") anyRoom.__wmIndex = 0;
  const id = eligible[anyRoom.__wmIndex % eligible.length].id;
  anyRoom.__wmIndex = (anyRoom.__wmIndex + 1) % eligible.length;
  return id;
}

export function startMatch(ctx: EngineContext, room: ServerRoom) {
  if (room.started) return;
  if (room.players.length < 2) throw new Error("Need at least 2 players to start");

  room.started = true;
  room.summary = null;
  // Fair Word Master rotation starts from the first player each match.
  (room as ServerRoom & { __wmIndex?: number }).__wmIndex = 0;
  room.players.forEach((p) => {
    p.score = 0;
    p.wordsCreated = 0;
    p.wordsGuessed = 0;
    p.totalGuessTimeMs = 0;
    p.correctGuessCount = 0;
    p.bestChallengeScore = 0;
    p.hasSubmittedChallenge = false;
  });

  ctx.broadcast(room, "game-started", { state: toPublicState(room) });
  beginRound(ctx, room, 1);
}

/** Start the next round forcing a system word (used when a Word Master disconnects). */
export function beginRoundForced(ctx: EngineContext, room: ServerRoom) {
  const roundNumber = room.round?.roundNumber || 1;
  clearRoomTimers(room.roomId);
  const round: ServerRoundState = {
    roundNumber,
    kind: "system",
    phase: "countdown",
    phaseEndsAt: null,
    publicChallenge: null,
    solvers: [],
    guessLog: [],
    correctAtByPlayer: {},
    wrongGuessCount: {},
    hintUsed: {},
    result: null,
  };
  room.round = round;
  room.lastActivityAt = Date.now();
  startSystemRound(ctx, room);
}

export function beginRound(ctx: EngineContext, room: ServerRoom, roundNumber: number) {
  clearRoomTimers(room.roomId);
  const kinds = planRoundKinds(room);
  const kind: RoundKind =
    kinds[roundNumber - 1] ||
    (room.settings.mode === "classic" ? "system" : "player");

  const round: ServerRoundState = {
    roundNumber,
    kind,
    phase: "countdown",
    phaseEndsAt: null,
    publicChallenge: null,
    solvers: [],
    guessLog: [],
    correctAtByPlayer: {},
    wrongGuessCount: {},
    hintUsed: {},
    result: null,
  };
  room.round = round;
  room.lastActivityAt = Date.now();

  if (kind === "player") {
    const wmId = nextWordMasterId(room, roundNumber);
    round.wordMasterId = wmId;
    round.phase = "creating";
    room.players.forEach((p) => (p.hasSubmittedChallenge = false));
    const wm = room.players.find((p) => p.id === wmId);
    // Deadline is stored on the round so clients can render a draining
    // progress bar while the Word Master composes (100% → 0%).
    round.phaseEndsAt = Date.now() + room.settings.wordMasterTimeSec * 1000;
    ctx.broadcast(room, "round-started", {
      state: toPublicState(room),
      yourTurnToCreate: wmId,
    });
    // Deadline to submit a challenge
    scheduleTimer(room, room.settings.wordMasterTimeSec * 1000, () => {
      handleWordMasterTimeout(ctx, room);
    }, ctx);
    // Secret nudge for the Word Master
    if (wm) {
      ctx.sendToPlayer(room, wm.id, "your-turn-to-create", {
        deadlineAt: Date.now() + room.settings.wordMasterTimeSec * 1000,
        roundNumber,
      });
    }
  } else {
    startSystemRound(ctx, room);
  }
}

// ─── Letter reveals ─────────────────────────────────────────────────────────
/** Reveal-set stored per round (positions). */
function getRevealSet(room: ServerRoom): Set<number> {
  const anyRoom = room as ServerRoom & { __revealSet?: Set<number> };
  if (!anyRoom.__revealSet) anyRoom.__revealSet = new Set();
  return anyRoom.__revealSet;
}

/** Per-player hint letter reveal: only the hint buyer sees the extra letter. */
function getPlayerRevealSet(round: ServerRoundState, playerId: string): Set<number> {
  const anyRound = round as ServerRoundState & { __playerReveals?: Record<string, Set<number>> };
  if (!anyRound.__playerReveals) anyRound.__playerReveals = {};
  const set = anyRound.__playerReveals[playerId] || new Set<number>();
  anyRound.__playerReveals[playerId] = set;
  return set;
}

/**
 * Compute the shared/private masked words after a hint-letter reveal.
 * The shared board only changes when the shared reveal set grows (pre-start
 * reveals and Word Master actions); a player's hint letter is personal.
 */
function revealLetterForPlayer(
  ctx: EngineContext,
  room: ServerRoom,
  playerId: string
): { position: number; letter: string } | null {
  const round = room.round;
  if (!round?.secret || !round.publicChallenge) return null;

  const shared = getRevealSet(room);
  const personal = getPlayerRevealSet(round, playerId);
  const already = new Set<number>([...shared, ...personal]);
  const pos = pickRevealableLetter(round.secret.word, already);
  if (pos === null) return null;

  personal.add(pos);
  const letter = round.secret.word[pos];

  // The buying player sees their personal masked word immediately.
  ctx.sendToPlayer(room, playerId, "board-update", {
    state: toPublicState(room),
    maskedWord: maskedWord(round.secret.word, new Set([...shared, ...personal])),
  });

  // Everyone else only learns THAT a letter was revealed (fairness info),
  // never which letter — the masked board stays untouched for them.
  ctx.broadcast(room, "letter-revealed", {
    state: toPublicState(room),
    byPlayer: room.players.find((p) => p.id === playerId)?.name,
    letter: null,
  });
  return { position: pos, letter };
}

function startSystemRound(ctx: EngineContext, room: ServerRoom) {
  const round = room.round!;
  const entry = pickRandomWord({ exclude: usedWords(room) });
  round.secret = {
    word: entry.word,
    category: entry.category,
    difficulty: entry.difficulty,
    hint1: entry.hint,
    hint2: entry.hint2,
    hint2Revealed: false,
    createdAt: Date.now(),
  };
  // Pre-reveal a few letters (e.g. "B _ _ _ S" for BOOKS) as a starting foothold.
  const reveal = pickRevealedLetters(entry.word, entry.difficulty);
  (room as ServerRoom & { __revealSet?: Set<number> }).__revealSet = reveal;
  round.publicChallenge = {
    roundKind: "system",
    category: entry.category,
    difficulty: entry.difficulty,
    hints: [entry.hint],
    hint2Available: Boolean(entry.hint2),
    wordLength: entry.word.length,
    maskedWord: maskedWord(entry.word, reveal),
  };
  startCountdown(ctx, room);
}

function usedWords(room: ServerRoom): Set<string> {
  // Persist used words across rounds via a side-map on the room object.
  const anyRoom = room as ServerRoom & { __usedWords?: Set<string> };
  if (!anyRoom.__usedWords) anyRoom.__usedWords = new Set();
  return anyRoom.__usedWords;
}

/** Per-room combo tracker: consecutive system rounds with a correct guess. */
function getComboMap(room: ServerRoom): Map<string, number> {
  const anyRoom = room as ServerRoom & { __combo?: Map<string, number> };
  if (!anyRoom.__combo) anyRoom.__combo = new Map();
  return anyRoom.__combo;
}

export function startCountdown(ctx: EngineContext, room: ServerRoom) {
  const round = room.round!;
  round.phase = "countdown";
  round.phaseEndsAt = Date.now() + 3000;
  ctx.broadcast(room, "round-started", { state: toPublicState(room) });
  scheduleTimer(room, 3000, () => {
    startGuessing(ctx, room);
  }, ctx);
}

export function startGuessing(ctx: EngineContext, room: ServerRoom) {
  const round = room.round!;
  round.phase = "guessing";
  const durationMs = room.settings.roundDurationSec * 1000;
  round.phaseEndsAt = Date.now() + durationMs;
  ctx.broadcast(room, "guessing-started", {
    state: toPublicState(room),
    roundEndsAt: round.phaseEndsAt,
  });
  scheduleTimer(room, durationMs, () => {
    endRound(ctx, room, "time-expired");
  }, ctx);
}

// ─── Word Master challenge submission ───────────────────────────────────────

export function submitChallenge(
  ctx: EngineContext,
  room: ServerRoom,
  playerId: string,
  raw: unknown
): { ok: boolean; error?: string } {
  const round = room.round;
  if (!round || round.phase !== "creating" || round.kind !== "player")
    return { ok: false, error: "Not waiting for a challenge right now." };
  if (round.wordMasterId !== playerId)
    return { ok: false, error: "It's not your turn to create a challenge." };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "You are not in this room." };

  const result = validateAndStore(room, raw, player.id);
  if (!result.ok) return result;

  startCountdown(ctx, room);
  return { ok: true };
}

function validateAndStore(
  room: ServerRoom,
  raw: unknown,
  wordMasterId: string
): { ok: boolean; error?: string } {
  const wm = room.players.find((p) => p.id === wordMasterId);
  const previousWords = (room as ServerRoom & { __wmWords?: Map<string, Set<string>> }).__wmWords
    ?.get(wordMasterId) || new Set<string>();

  const res = validateChallenge(raw, previousWords);
  if (!res.ok || !res.value) return { ok: false, error: res.error };

  const v = res.value;
  const round = room.round!;
  round.secret = {
    word: v.word,
    category: v.category,
    difficulty: v.difficulty,
    hint1: v.hint1,
    hint2: v.hint2,
    hint2Revealed: false,
    createdById: wordMasterId,
    createdAt: Date.now(),
  };
  // Pre-reveal a few letters for player-created words too.
  const reveal = pickRevealedLetters(v.word, v.difficulty);
  (room as ServerRoom & { __revealSet?: Set<number> }).__revealSet = reveal;
  round.publicChallenge = {
    roundKind: "player",
    category: v.category,
    difficulty: v.difficulty,
    hints: [v.hint1],
    hint2Available: Boolean(v.hint2),
    wordMasterId,
    wordMasterName: wm?.name,
    wordLength: v.word.length,
    maskedWord: maskedWord(v.word, reveal),
  };

  // Track words used per Word Master to prevent repeats within a match.
  const anyRoom = room as ServerRoom & { __wmWords?: Map<string, Set<string>> };
  if (!anyRoom.__wmWords) anyRoom.__wmWords = new Map();
  const set = anyRoom.__wmWords.get(wordMasterId) || new Set<string>();
  set.add(v.word);
  anyRoom.__wmWords.set(wordMasterId, set);

  if (wm) {
    wm.hasSubmittedChallenge = true;
    wm.wordsCreated += 1;
  }
  return { ok: true };
}

export function handleWordMasterTimeout(ctx: EngineContext, room: ServerRoom) {
  const round = room.round;
  if (!round || round.phase !== "creating") return;

  // If the Word Master never submitted, fall back to a system word this round.
  ctx.broadcast(room, "challenge-skipped", {
    state: toPublicState(room),
    reason: "The Word Master ran out of time. Using a system word instead!",
  });
  round.kind = "system";
  round.wordMasterId = undefined;
  round.phaseEndsAt = null;
  startSystemRound(ctx, room);
}

/**
 * Word Master chooses to skip composing and let the system pick the word
 * for their turn. Same fallback as the timeout, but voluntary and instant.
 */
export function useSystemWord(
  ctx: EngineContext,
  room: ServerRoom,
  playerId: string
): { ok: boolean; error?: string } {
  const round = room.round;
  if (!round || round.phase !== "creating" || round.kind !== "player")
    return { ok: false, error: "Not waiting for a challenge right now." };
  if (round.wordMasterId !== playerId)
    return { ok: false, error: "It's not your turn to create a challenge." };

  ctx.broadcast(room, "challenge-skipped", {
    state: toPublicState(room),
    reason: `${room.players.find((p) => p.id === playerId)?.name ?? "The Word Master"} chose a system word for this round!`,
  });
  round.kind = "system";
  round.wordMasterId = undefined;
  round.phaseEndsAt = null;
  startSystemRound(ctx, room);
  return { ok: true };
}

/** Word Master optionally reveals hint 2 mid-round. */
export function revealHint2(ctx: EngineContext, room: ServerRoom, playerId: string) {
  const round = room.round;
  if (!round || round.phase !== "guessing") return { ok: false, error: "No active round." };
  if (round.wordMasterId && round.wordMasterId !== playerId)
    return { ok: false, error: "Only the Word Master can reveal the second hint." };

  if (!round.secret?.hint2)
    return { ok: false, error: "There is no second hint for this word." };
  if (round.secret.hint2Revealed)
    return { ok: false, error: "The second hint is already revealed." };

  round.secret.hint2Revealed = true;
  if (round.publicChallenge) {
    round.publicChallenge.hints = [...round.publicChallenge.hints, round.secret.hint2];
    round.publicChallenge.hint2Available = false;
  }
  ctx.broadcast(room, "hint-revealed", {
    state: toPublicState(room),
    hint: round.secret.hint2,
  });
  return { ok: true };
}

// ─── Guess handling ─────────────────────────────────────────────────────────

const GUESS_INTERVAL_MS = 800;
const MAX_GUESSES_PER_ROUND = 30;

export function submitGuess(
  ctx: EngineContext,
  room: ServerRoom,
  playerId: string,
  rawGuess: string
): { ok: boolean; error?: string; correct?: boolean } {
  const round = room.round;
  if (!round || round.phase !== "guessing" || !round.secret)
    return { ok: false, error: "No active guessing round." };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "You are not in this room." };

  // Word Master cannot guess their own challenge.
  if (round.wordMasterId === playerId)
    return { ok: false, error: "You created this word — no guessing your own challenge!" };

  // Duplicate / repeat submissions after solving.
  if (round.correctAtByPlayer[playerId] !== undefined)
    return { ok: false, error: "You already solved this word!" };

  // Rate limiting: min interval between guesses.
  const now = Date.now();
  const anyRound = round as ServerRoundState & { __lastGuessAt?: Record<string, number> };
  if (!anyRound.__lastGuessAt) anyRound.__lastGuessAt = {};
  const lastAt = anyRound.__lastGuessAt[playerId] || 0;
  if (now - lastAt < GUESS_INTERVAL_MS)
    return { ok: false, error: "Slow down a little!" };
  anyRound.__lastGuessAt[playerId] = now;

  // Cap total guesses per round per player.
  const anyRound2 = round as ServerRoundState & { __guessCount?: Record<string, number> };
  if (!anyRound2.__guessCount) anyRound2.__guessCount = {};
  const count = (anyRound2.__guessCount[playerId] || 0) + 1;
  if (count > MAX_GUESSES_PER_ROUND)
    return { ok: false, error: "Too many guesses this round." };
  anyRound2.__guessCount[playerId] = count;

  const normalized = String(rawGuess || "").trim().toUpperCase();
  if (!normalized)
    return { ok: false, error: "Type a guess first!" };

  const correct = normalized === round.secret.word;

  if (correct) {
    const solvedAt = Date.now();
    round.correctAtByPlayer[playerId] = solvedAt;
    const elapsedMs = solvedAt - (round.phaseEndsAt || solvedAt) + room.settings.roundDurationSec * 1000;
    const timeSec = Math.round(elapsedMs / 100) / 10;

    let points: number;
    if (round.kind === "player") {
      points = computePlayerRoundGuesserPoints(
        room.settings.scoring,
        round.solvers.length,
        round.secret.hint2Revealed
      );
    } else {
      const remainingMs = Math.max(0, (round.phaseEndsAt || solvedAt) - solvedAt);
      const comboIndex = getComboMap(room).get(playerId) || 0;
      points = computeSystemRoundPoints(
        room.settings.scoring,
        remainingMs / 1000,
        room.settings.roundDurationSec,
        Boolean(round.hintUsed[playerId]),
        comboIndex
      ).total;
    }

    round.solvers.push({ playerId, name: player.name, points, timeSec });
    player.score += points;
    player.wordsGuessed += 1;
    player.correctGuessCount += 1;
    player.totalGuessTimeMs += elapsedMs;

    // Update masked word to show all letters.
    if (round.publicChallenge) {
      round.publicChallenge.maskedWord = maskedWord(
        round.secret.word,
        new Set(round.secret.word.split("").map((_, i) => i))
      );
    }

    round.guessLog.push({ playerName: player.name, correct: true, at: now });
    ctx.broadcast(room, "correct-guess", {
      state: toPublicState(room),
      playerName: player.name,
      points,
      timeSec,
    });
    endRound(ctx, room, "guessed");
    return { ok: true, correct: true };
  }

  // Wrong guess
  player.score = Math.max(0, player.score + room.settings.scoring.wrongGuessPenalty);
  round.guessLog.push({ playerName: player.name, correct: false, at: now });
  ctx.broadcast(room, "wrong-guess", {
    state: toPublicState(room),
    playerName: player.name,
  });
  return { ok: true, correct: false };
}

export function useHint(
  ctx: EngineContext,
  room: ServerRoom,
  playerId: string
): { ok: boolean; error?: string; hint?: string } {
  const round = room.round;
  if (!round || round.phase !== "guessing" || !round.secret)
    return { ok: false, error: "No active round." };

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return { ok: false, error: "You are not in this room." };
  if (round.hintUsed[playerId])
    return { ok: false, error: "You already used your hint this round." };

  round.hintUsed[playerId] = true;

  // The bought letter is revealed ONLY for the buying player: their board
  // shows the new letter, everyone else's board is untouched.
  const reveal = revealLetterForPlayer(ctx, room, playerId);

  const hint = round.secret.hint2 || round.secret.hint1;
  ctx.sendToPlayer(room, playerId, "hint-revealed-personal", {
    hint,
    letter: reveal?.letter ?? null,
    position: reveal?.position ?? null,
  });
  return { ok: true, hint };
}

// ─── Round / match end ──────────────────────────────────────────────────────

export function endRound(ctx: EngineContext, room: ServerRoom, reason: string) {
  clearRoomTimers(room.roomId);
  const round = room.round;
  if (!round || !round.secret) return;
  if (round.phase === "round-end" || round.phase === "game-end") return; // guard double-calls

  round.phase = "round-end";
  round.phaseEndsAt = null;

  const word = round.secret.word;
  const solvers = [...round.solvers].sort((a, b) => b.points - a.points);
  const totalGuessers =
    room.players.filter((p) => p.id !== round.wordMasterId).length;

  let challengeReport: ChallengeReport | undefined;
  if (round.kind === "player" && round.wordMasterId) {
    const wm = room.players.find((p) => p.id === round.wordMasterId);
    const solverTimes = round.solvers.map((s) => s.timeSec);
    const avgTime = solverTimes.length
      ? solverTimes.reduce((a, b) => a + b, 0) / solverTimes.length
      : room.settings.roundDurationSec;
    const hintsUsed = Object.keys(round.hintUsed).length;

    const report = computeChallengeScore({
      playersSolved: round.solvers.length,
      totalGuessers,
      averageSolveTimeSec: avgTime,
      hintsUsed,
      difficulty: round.secret.difficulty,
    });
    challengeReport = {
      challengeScore: report.challengeScore,
      playersSolved: round.solvers.length,
      totalGuessers,
      averageSolveTimeSec: Math.round(avgTime * 10) / 10,
      hintsUsed,
      difficulty: round.secret.difficulty,
      tooEasy: report.tooEasy,
      tooHard: report.tooHard,
    };

    if (wm) {
      const bonus = computeWordMasterBonus(room.settings.scoring, round.solvers.length);
      wm.score += bonus;
      wm.bestChallengeScore = Math.max(wm.bestChallengeScore, report.challengeScore);
      round.result = {
        roundNumber: round.roundNumber,
        kind: round.kind,
        word,
        category: round.secret.category,
        difficulty: round.secret.difficulty,
        wordMasterName: wm.name,
        challengeReport,
        solvers,
      };
    }
  }

  if (!round.result) {
    round.result = {
      roundNumber: round.roundNumber,
      kind: round.kind,
      word,
      category: round.secret.category,
      difficulty: round.secret.difficulty,
      wordMasterName: round.publicChallenge?.wordMasterName,
      challengeReport,
      solvers,
    };
  }

  const isLastRound = round.roundNumber >= room.settings.rounds;
  ctx.broadcast(room, "round-ended", {
    state: toPublicState(room),
    result: round.result,
    reason,
    isLastRound,
  });

  // Update combo streaks for system rounds.
  if (round.kind === "system") {
    const combo = getComboMap(room);
    const solverIds = new Set(round.solvers.map((s) => s.playerId));
    for (const player of room.players) {
      if (solverIds.has(player.id)) combo.set(player.id, (combo.get(player.id) || 0) + 1);
      else combo.set(player.id, 0);
    }
  }

  if (isLastRound) {
    scheduleTimer(room, 800, () => endMatch(ctx, room), ctx);
  } else {
    scheduleTimer(room, 6000, () => beginRound(ctx, room, round.roundNumber + 1), ctx);
  }
}

export function endMatch(ctx: EngineContext, room: ServerRoom) {
  const ranked = [...room.players].sort((a, b) => b.score - a.score);

  // Awards
  let bestGuesser: MatchAward | undefined;
  let bestWordMaster: MatchAward | undefined;
  let fastestGuess: MatchAward | undefined;

  const guessers = room.players.filter((p) => p.correctGuessCount > 0);
  if (guessers.length > 0) {
    const best = [...guessers].sort((a, b) => b.correctGuessCount - a.correctGuessCount)[0];
    bestGuesser = {
      name: best.name,
      value: `${best.correctGuessCount} words`,
    };
  }
  const wms = room.players.filter((p) => p.wordsCreated > 0);
  if (wms.length > 0) {
    const best = [...wms].sort((a, b) => b.bestChallengeScore - a.bestChallengeScore)[0];
    bestWordMaster = {
      name: best.name,
      value: `Challenge ${best.bestChallengeScore}/100`,
    };
  }
  const fastest = [...room.players]
    .filter((p) => p.correctGuessCount > 0)
    .sort((a, b) => a.totalGuessTimeMs / a.correctGuessCount - b.totalGuessTimeMs / b.correctGuessCount)[0];
  if (fastest) {
    fastestGuess = {
      name: fastest.name,
      value: `${(fastest.totalGuessTimeMs / fastest.correctGuessCount / 1000).toFixed(1)}s avg`,
    };
  }

  room.summary = {
    rankings: ranked.map((p) => ({
      playerId: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
    })),
    awards: {
      bestGuesser,
      bestWordMaster,
      fastestGuess,
    },
  };

  ctx.broadcast(room, "game-ended", { state: toPublicState(room), summary: room.summary });
}

interface MatchAward {
  name: string;
  value: string;
}

/** Reset for a rematch — host only. */
export function resetForRematch(room: ServerRoom) {
  clearRoomTimers(room.roomId);
  room.started = false;
  room.round = null;
  room.summary = null;
  (room as ServerRoom & { __wmWords?: Map<string, Set<string>> }).__wmWords?.clear();
  (room as ServerRoom & { __usedWords?: Set<string> }).__usedWords?.clear();
  (room as ServerRoom & { __wmIndex?: number }).__wmIndex = 0;
  getComboMap(room).clear();
  (room as ServerRoom & { __revealSet?: Set<number> }).__revealSet?.clear();
  room.players.forEach((p) => {
    p.score = 0;
    p.hasSubmittedChallenge = false;
    p.wordsCreated = 0;
    p.wordsGuessed = 0;
    p.totalGuessTimeMs = 0;
    p.correctGuessCount = 0;
    p.bestChallengeScore = 0;
  });
}

export type { RoundResult, PublicChallenge, RoundPhase, Difficulty };
