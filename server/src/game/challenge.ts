import { Difficulty } from "../types/game";
import { containsProfanity } from "../data/profanity";

export interface ChallengeInput {
  word: string;
  category: string;
  hint1: string;
  hint2?: string;
  difficulty: Difficulty;
  /** Positions (0-based) the Word Master chose to reveal at round start. */
  revealedPositions?: number[];
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  value?: ChallengeInput;
}

const WORD_MIN_LEN = 3;
const WORD_MAX_LEN = 15;
const HINT_MAX_LEN = 120;
/** How many letters the Word Master may pre-reveal: max half the word, always keeping 2 hidden. */
export function maxRevealablePositions(wordLength: number): number {
  return Math.max(0, Math.floor(wordLength / 2) - 1);
}
const CATEGORIES = [
  "Animals", "Food", "Movies", "Sports", "Countries",
  "Technology", "Nature", "General",
];

function cleanWord(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, "");
}

/** The word must not appear inside its own hints (case-insensitive). */
function hintsRevealWord(word: string, hints: string[]): boolean {
  const w = word.toLowerCase();
  return hints.some((h) => h.toLowerCase().includes(w));
}

/**
 * Validate a Word Master challenge submission.
 * Returns a friendly error message on failure — the client shows it as-is.
 */
export function validateChallenge(
  raw: unknown,
  previousWords: Set<string>
): ValidationResult {
  if (!raw || typeof raw !== "object")
    return { ok: false, error: "Invalid challenge data." };

  const input = raw as Record<string, unknown>;
  const word = cleanWord(String(input.word ?? ""));
  const category = String(input.category ?? "General");
  const hint1 = String(input.hint1 ?? "").trim();
  const hint2 = input.hint2 ? String(input.hint2).trim() : undefined;
  const difficulty: Difficulty =
    input.difficulty === "Easy" || input.difficulty === "Medium" || input.difficulty === "Hard"
      ? input.difficulty
      : "Medium";

  if (word.length < WORD_MIN_LEN)
    return { ok: false, error: `The word must be at least ${WORD_MIN_LEN} letters.` };
  if (word.length > WORD_MAX_LEN)
    return { ok: false, error: `The word can be at most ${WORD_MAX_LEN} letters.` };
  if (!hint1)
    return { ok: false, error: "Please provide at least one hint." };
  if (hint1.length > HINT_MAX_LEN || (hint2 && hint2.length > HINT_MAX_LEN))
    return { ok: false, error: `Hints must be at most ${HINT_MAX_LEN} characters.` };
  if (hintsRevealWord(word, hint2 ? [hint1, hint2] : [hint1]))
    return { ok: false, error: "Hints cannot contain the secret word itself!" };
  if (containsProfanity(word))
    return { ok: false, error: "That word is not allowed. Please pick another." };
  if (containsProfanity(hint1) || (hint2 && containsProfanity(hint2)))
    return { ok: false, error: "Hints contain inappropriate content. Please revise them." };
  if (previousWords.has(word))
    return { ok: false, error: "You already used that word this match. Pick a new one!" };
  if (!CATEGORIES.includes(category))
    return { ok: false, error: "Please pick a valid category." };

  // Optional starting-letter picker: sanitize client-supplied positions.
  let revealedPositions: number[] | undefined;
  const rawPositions = input.revealedPositions;
  if (Array.isArray(rawPositions) && rawPositions.length > 0) {
    const seen = new Set<number>();
    for (const p of rawPositions) {
      const idx = typeof p === "number" ? Math.floor(p) : NaN;
      if (Number.isNaN(idx) || idx < 0 || idx >= word.length || seen.has(idx))
        return { ok: false, error: "Invalid starting letter selection." };
      seen.add(idx);
    }
    if (seen.size > maxRevealablePositions(word.length))
      return {
        ok: false,
        error: `You can reveal at most ${maxRevealablePositions(word.length)} starting letters (at least 2 must stay hidden).`,
      };
    revealedPositions = [...seen].sort((a, b) => a - b);
  }

  return {
    ok: true,
    value: {
      word,
      category,
      hint1,
      hint2: hint2 || undefined,
      difficulty,
      revealedPositions,
    },
  };
}
