import { OfflineWordEntry, pickOfflineWord } from "./offline-words";

export type OfflineDifficulty = "Easy" | "Medium" | "Hard" | "practice";

export interface OfflineStats {
  gamesPlayed: number;
  gamesWon: number;
  correctGuesses: number;
  wrongGuesses: number;
  hintsUsed: number;
  bestScore: number;
  currentStreak: number;
  longestStreak: number;
  totalScore: number;
}

const STATS_KEY = "wordigo_offline_stats";
const SETTINGS_KEY = "wordigo_settings";

export const DEFAULT_STATS: OfflineStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  correctGuesses: 0,
  wrongGuesses: 0,
  hintsUsed: 0,
  bestScore: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalScore: 0,
};

export function loadOfflineStats(): OfflineStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveOfflineStats(stats: OfflineStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // storage might be unavailable
  }
}

export function resetOfflineStats(): void {
  saveOfflineStats({ ...DEFAULT_STATS });
}

export function recordRound(stats: OfflineStats, result: {
  won: boolean;
  score: number;
  correct: number;
  wrong: number;
  hints: number;
}): OfflineStats {
  const next = { ...stats };
  next.gamesPlayed += 1;
  next.gamesWon += result.won ? 1 : 0;
  next.correctGuesses += result.correct;
  next.wrongGuesses += result.wrong;
  next.hintsUsed += result.hints;
  next.totalScore += result.score;
  next.bestScore = Math.max(next.bestScore, result.score);
  if (result.won) {
    next.currentStreak += 1;
    next.longestStreak = Math.max(next.longestStreak, next.currentStreak);
  } else {
    next.currentStreak = 0;
  }
  saveOfflineStats(next);
  return next;
}

// ─── Settings persistence ───────────────────────────────────────────────────

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  theme: "dark" | "light";
  difficulty: OfflineDifficulty;
  rounds: number;
  roundDurationSec: number;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  soundEnabled: true,
  musicEnabled: false,
  theme: "dark",
  difficulty: "Medium",
  rounds: 5,
  roundDurationSec: 60,
};

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

// ─── Offline round engine ───────────────────────────────────────────────────

export interface OfflineRound {
  word: OfflineWordEntry;
  masked: string[];
  guessedLetters: Set<string>;
  /** Positions revealed as hints/pre-reveal — these are free, not player guesses. */
  hintedPositions: Set<number>;
  hintsUsed: number;
  solved: boolean;
  failed: boolean;
  attempts: { guess: string; correct: boolean }[];
  startedAt: number;
  solveTimeMs: number;
}

export interface OfflineScoring {
  correct: number;
  speedBonusMax: number;
  hintPenalty: number;
  wrongPenalty: number;
}

export const OFFLINE_SCORING: OfflineScoring = {
  correct: 100,
  speedBonusMax: 100,
  hintPenalty: -25,
  wrongPenalty: -5,
};

export function maskWord(word: string, guessed: Set<string>): string {
  return word
    .split("")
    .map((ch) => (guessed.has(ch) ? ch : "_"))
    .join(" ");
}

// ─── Letter reveals ─────────────────────────────────────────────────────────
/** Fraction of the word pre-revealed at round start, by difficulty. */
const OFFLINE_REVEAL_FRACTION: Record<"Easy" | "Medium" | "Hard", number> = {
  Easy: 0.3,
  Medium: 0.2,
  Hard: 0.1,
};

/** Number of letters shown for free at round start (always ≥1, ≥2 letters stay hidden). */
export function initialRevealCount(word: string, difficulty: "Easy" | "Medium" | "Hard"): number {
  const usable = Math.max(0, word.length - 2);
  const byDifficulty = Math.floor(word.length * OFFLINE_REVEAL_FRACTION[difficulty]);
  return Math.min(usable, Math.max(1, byDifficulty));
}

/** Deterministic positions revealed at round start — same word, same board. */
export function pickRevealedPositions(
  word: string,
  difficulty: "Easy" | "Medium" | "Hard"
): Set<number> {
  const count = initialRevealCount(word, difficulty);
  const indexes = word.split("").map((_, i) => i);
  const seed = [...word].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  let rng = seed || 1;
  for (let i = indexes.length - 1; i > 0; i--) {
    rng = (rng * 1103515245 + 12345) >>> 0;
    const j = rng % (i + 1);
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return new Set(indexes.slice(0, count));
}

/** First still-hidden position — hint reveals fill left-to-right. */
export function firstHiddenPosition(word: string, revealed: Set<number>): number | null {
  for (let i = 0; i < word.length; i++) {
    if (!revealed.has(i)) return i;
  }
  return null;
}

export function createOfflineRound(difficulty: OfflineDifficulty, exclude: Set<string>): OfflineRound {
  const word = pickOfflineWord({
    difficulty: difficulty === "practice" ? undefined : difficulty,
    exclude,
  });
  // Pre-reveal a few letters as a starting foothold (practice gets a generous board).
  const positions = pickRevealedPositions(
    word.word,
    difficulty === "practice" ? "Easy" : difficulty
  );
  const startLetters = new Set(
    [...positions].map((pos) => word.word[pos])
  );
  return {
    word,
    masked: word.word.split(""),
    guessedLetters: startLetters,
    hintedPositions: positions,
    hintsUsed: 0,
    solved: false,
    failed: false,
    attempts: [],
    startedAt: Date.now(),
    solveTimeMs: 0,
  };
}

/** Apply a full-word guess. Returns updated round info. */
export function applyGuess(
  round: OfflineRound,
  guess: string
): { round: OfflineRound; correct: boolean; lettersRevealed: number; fullySolved: boolean } {
  const normalized = guess.trim().toUpperCase();
  const letters = normalized.replace(/[^A-Z]/g, "");
  const guessed = new Set(round.guessedLetters);

  if (!letters) {
    return { round, correct: false, lettersRevealed: 0, fullySolved: round.solved };
  }

  let revealed = 0;
  for (const ch of letters) {
    if (round.word.word.includes(ch) && !guessed.has(ch)) {
      guessed.add(ch);
      revealed++;
    }
  }

  const fullySolved = round.word.word.split("").every((ch) => guessed.has(ch));
  const attempts = [...round.attempts, { guess: normalized, correct: revealed > 0 }];
  const updated: OfflineRound = {
    ...round,
    guessedLetters: guessed,
    attempts,
    solved: fullySolved || round.solved,
    failed: !fullySolved && revealed === 0 ? round.failed : round.failed,
    solveTimeMs: fullySolved ? Date.now() - round.startedAt : round.solveTimeMs,
  };
  return { round: updated, correct: revealed > 0, lettersRevealed: revealed, fullySolved };
}

/**
 * Buy a hint: −25 points, reveals a letter on the board left-to-right
 * (e.g. "B _ _ _ S" → "B O _ _ S") and only charges for a text hint when none are left.
 */
export function buyLetterHint(round: OfflineRound): {
  round: OfflineRound;
  letter: string | null;
  textHint: string | null;
  cost: number;
} {
  const revealed = new Set(round.hintedPositions);
  const pos = firstHiddenPosition(round.word.word, revealed);
  if (pos !== null) {
    revealed.add(pos);
    const letter = round.word.word[pos];
    const updated: OfflineRound = {
      ...round,
      hintedPositions: revealed,
      guessedLetters: new Set([...round.guessedLetters, letter]),
      hintsUsed: round.hintsUsed + 1,
    };
    return { round: updated, letter, textHint: null, cost: OFFLINE_SCORING.hintPenalty };
  }
  // All letters already visible → fall back to the text hint.
  const textHint = round.hintsUsed === 0
    ? round.word.hint
    : round.word.hint2 ?? null;
  if (!textHint) {
    return { round, letter: null, textHint: null, cost: 0 };
  }
  return {
    round: { ...round, hintsUsed: round.hintsUsed + 1 },
    letter: null,
    textHint,
    cost: OFFLINE_SCORING.hintPenalty,
  };
}

export function scoreRound(
  round: OfflineRound,
  timeLeftSec: number,
  durationSec: number,
  comboIndex: number
): number {
  if (!round.solved) return Math.max(0, OFFLINE_SCORING.wrongPenalty * round.attempts.filter((a) => !a.correct).length);
  const solveFraction = Math.max(0, Math.min(1, timeLeftSec / Math.max(1, durationSec)));
  const base = OFFLINE_SCORING.correct;
  const speed = Math.round(OFFLINE_SCORING.speedBonusMax * solveFraction);
  const hints = OFFLINE_SCORING.hintPenalty * round.hintsUsed;
  const combo = 1 + Math.min(0.5, comboIndex * 0.1);
  return Math.max(0, Math.round((base + speed + hints) * combo));
}
