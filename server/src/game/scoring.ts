import { ScoringConfig, Difficulty } from "../types/game";

/**
 * Classic round scoring: base + speed bonus, minus hint usage.
 * Solve fraction: 1.0 = instant, 0.0 = at time expiry.
 */
export function computeSystemRoundPoints(
  scoring: ScoringConfig,
  timeLeftSec: number,
  roundDurationSec: number,
  usedHint: boolean,
  comboIndex: number // consecutive correct guesses across rounds (0-based)
): { base: number; speedBonus: number; hintPenalty: number; comboMultiplier: number; total: number } {
  const base = scoring.correct;
  const solveFraction = Math.max(0, Math.min(1, timeLeftSec / Math.max(1, roundDurationSec)));
  const speedBonus = Math.round(scoring.speedBonusMax * solveFraction);
  const hintPenalty = usedHint ? scoring.hintPenalty : 0;
  const comboMultiplier = 1 + Math.min(0.5, comboIndex * 0.1); // up to x1.5
  const total = Math.max(
    0,
    Math.round((base + speedBonus + hintPenalty) * comboMultiplier)
  );
  return { base, speedBonus, hintPenalty, comboMultiplier, total };
}

/** Guesser points in "Your Word, Our Guess" rounds. */
export function computePlayerRoundGuesserPoints(
  scoring: ScoringConfig,
  solverIndex: number, // 0 = first solver
  hint2Revealed: boolean
): number {
  const table = [scoring.firstCorrect, scoring.secondCorrect, scoring.thirdCorrect];
  const base = solverIndex < table.length ? table[solverIndex] : scoring.laterCorrect;
  return hint2Revealed ? Math.round(base * scoring.hintPenaltyFactor) : base;
}

/**
 * Challenge Score (0–100) for a Word Master: how good was their challenge?
 * Balanced across solvers, solve speed, hints, and difficulty.
 */
export function computeChallengeScore(params: {
  playersSolved: number;
  totalGuessers: number;
  averageSolveTimeSec: number;
  hintsUsed: number;
  difficulty: Difficulty;
}): {
  challengeScore: number;
  tooEasy: boolean;
  tooHard: boolean;
} {
  const { playersSolved, totalGuessers, averageSolveTimeSec, hintsUsed, difficulty } = params;

  // Participation: ideal is roughly half the guessers solving it.
  const idealSolved = Math.max(1, Math.floor(totalGuessers / 2));
  let participation: number;
  if (playersSolved === 0) {
    participation = 0.15; // too hard, but a brave attempt
  } else if (playersSolved >= totalGuessers) {
    participation = 0.5; // everyone solved it — too easy
  } else {
    participation = 1 - Math.abs(playersSolved - idealSolved) / Math.max(totalGuessers, 1);
  }

  // Solve time: ~10–40s sweet spot scales with difficulty.
  const sweetSpot = difficulty === "Easy" ? 15 : difficulty === "Medium" ? 30 : 45;
  const timeScore = playersSolved === 0 ? 0.5 :
    Math.max(0, 1 - Math.abs(averageSolveTimeSec - sweetSpot) / (sweetSpot * 2));

  // Hints: fewer hints used = better challenge.
  const hintScore = playersSolved === 0 ? 1 :
    hintsUsed === 0 ? 1 : hintsUsed === 1 ? 0.7 : 0.4;

  // Difficulty bravery: harder words are worth more if solvable.
  const diffScore = difficulty === "Easy" ? 0.6 : difficulty === "Medium" ? 0.85 : 1;

  const raw = participation * 0.45 + timeScore * 0.25 + hintScore * 0.15 + diffScore * 0.15;
  const challengeScore = Math.round(Math.max(5, Math.min(100, raw * 100)));

  return {
    challengeScore,
    tooEasy: playersSolved === totalGuessers && playersSolved > 0,
    tooHard: playersSolved === 0,
  };
}

/** Word Master bonus points after a player-word round. */
export function computeWordMasterBonus(
  scoring: ScoringConfig,
  playersSolved: number
): number {
  if (playersSolved <= 0) return scoring.wordMasterNoSolver;
  if (playersSolved === 1) return scoring.wordMasterBase + scoring.wordMasterOneSolverBonus;
  return scoring.wordMasterBase + scoring.wordMasterMultiSolverBonus;
}

/**
 * Mask a word, showing only the letters at the given positions.
 * Position-based (not letter-based) so revealing "A" in BANANA doesn't
 * automatically light up every A.
 */
export function maskedWord(word: string, revealedPositions: Set<number>): string {
  return word
    .split("")
    .map((ch, i) => (revealedPositions.has(i) ? ch : "_"))
    .join(" ");
}

// ─── Letter reveals ─────────────────────────────────────────────────────────
/**
 * A few letters are pre-revealed at round start (like the mockup "B _ _ _ S")
 * so guessers always have a foothold. Count scales with difficulty — the
 * harder the word, the fewer free letters.
 *
 * The reveal set is a set of POSITIONS (indexes), not characters: revealing
 * every occurrence of a letter (e.g. both B's in BOOKS) gives away too much,
 * while positions keep the board interesting.
 */
const REVEAL_FRACTION: Record<Difficulty, number> = {
  Easy: 0.3,
  Medium: 0.2,
  Hard: 0.1,
};

export function initialRevealCount(word: string, difficulty: Difficulty): number {
  const usable = Math.max(0, word.length - 2); // keep at least 2 letters hidden
  const byDifficulty = Math.floor(word.length * REVEAL_FRACTION[difficulty]);
  return Math.min(usable, Math.max(1, byDifficulty));
}

/** Positions whose letters will be shown at round start (deterministic per word + difficulty). */
export function pickRevealedLetters(word: string, difficulty: Difficulty): Set<number> {
  const count = initialRevealCount(word, difficulty);
  const indexes = word.split("").map((_, i) => i);
  // Deterministic pseudo-shuffle from the word itself: same word → same board.
  const seed = [...word].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  let rng = seed || 1;
  for (let i = indexes.length - 1; i > 0; i--) {
    rng = (rng * 1103515245 + 12345) >>> 0;
    const j = rng % (i + 1);
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }
  return new Set(indexes.slice(0, count));
}

/**
 * Pick the next hidden position to reveal when a player uses a hint.
 * Prefers the FIRST hidden position so the word fills left-to-right,
 * which is much easier for players to reason about.
 */
export function pickRevealableLetter(word: string, alreadyRevealed: Set<number>): number | null {
  for (let i = 0; i < word.length; i++) {
    if (!alreadyRevealed.has(i)) return i;
  }
  return null;
}
