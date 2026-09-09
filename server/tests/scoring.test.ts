import { describe, it, expect } from "vitest";
import {
  computeSystemRoundPoints,
  computePlayerRoundGuesserPoints,
  computeChallengeScore,
  computeWordMasterBonus,
  maskedWord,
  pickRevealedLetters,
  pickRevealableLetter,
  initialRevealCount,
} from "../src/game/scoring";
import { DEFAULT_SCORING } from "../src/types/game";
import { validateChallenge } from "../src/game/challenge";
import { WORD_DATABASE, pickRandomWord } from "../src/data/words";

describe("system round scoring", () => {
  it("gives max points for an instant correct guess", () => {
    const r = computeSystemRoundPoints(DEFAULT_SCORING, 60, 60, false, 0);
    expect(r.base).toBe(100);
    expect(r.speedBonus).toBe(100);
    expect(r.total).toBe(200);
  });

  it("gives zero speed bonus at time expiry", () => {
    const r = computeSystemRoundPoints(DEFAULT_SCORING, 0, 60, false, 0);
    expect(r.speedBonus).toBe(0);
    expect(r.total).toBe(100);
  });

  it("applies hint penalty", () => {
    const withHint = computeSystemRoundPoints(DEFAULT_SCORING, 60, 60, true, 0);
    const without = computeSystemRoundPoints(DEFAULT_SCORING, 60, 60, false, 0);
    expect(withHint.total).toBe(without.total - 25);
  });

  it("never returns negative points", () => {
    const r = computeSystemRoundPoints(DEFAULT_SCORING, 0, 60, true, 0);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });

  it("combo multiplier caps at x1.5", () => {
    const a = computeSystemRoundPoints(DEFAULT_SCORING, 60, 60, false, 3);
    const b = computeSystemRoundPoints(DEFAULT_SCORING, 60, 60, false, 10);
    expect(a.comboMultiplier).toBeCloseTo(1.3);
    expect(b.comboMultiplier).toBe(1.5);
  });
});

describe("player round scoring", () => {
  it("rewards first solver most", () => {
    const first = computePlayerRoundGuesserPoints(DEFAULT_SCORING, 0, false);
    const second = computePlayerRoundGuesserPoints(DEFAULT_SCORING, 1, false);
    const later = computePlayerRoundGuesserPoints(DEFAULT_SCORING, 5, false);
    expect(first).toBe(150);
    expect(second).toBe(125);
    expect(later).toBe(75);
  });

  it("reduces points when hint 2 was revealed", () => {
    const withHint = computePlayerRoundGuesserPoints(DEFAULT_SCORING, 0, true);
    expect(withHint).toBe(Math.round(150 * 0.75));
  });

  it("word master bonus follows solver count", () => {
    expect(computeWordMasterBonus(DEFAULT_SCORING, 1)).toBe(150);
    expect(computeWordMasterBonus(DEFAULT_SCORING, 3)).toBe(125);
    expect(computeWordMasterBonus(DEFAULT_SCORING, 0)).toBe(25);
  });
});

describe("challenge score", () => {
  it("is higher when about half the guessers solve", () => {
    const good = computeChallengeScore({
      playersSolved: 2, totalGuessers: 4,
      averageSolveTimeSec: 25, hintsUsed: 0, difficulty: "Medium",
    });
    const everyone = computeChallengeScore({
      playersSolved: 4, totalGuessers: 4,
      averageSolveTimeSec: 25, hintsUsed: 0, difficulty: "Medium",
    });
    const nobody = computeChallengeScore({
      playersSolved: 0, totalGuessers: 4,
      averageSolveTimeSec: 60, hintsUsed: 2, difficulty: "Medium",
    });
    expect(good.challengeScore).toBeGreaterThan(everyone.challengeScore);
    expect(good.challengeScore).toBeGreaterThan(nobody.challengeScore);
    expect(good.challengeScore).toBeLessThanOrEqual(100);
    expect(good.challengeScore).toBeGreaterThanOrEqual(5);
  });

  it("flags too easy and too hard outcomes", () => {
    const easy = computeChallengeScore({
      playersSolved: 3, totalGuessers: 3,
      averageSolveTimeSec: 5, hintsUsed: 0, difficulty: "Easy",
    });
    expect(easy.tooEasy).toBe(true);
    const hard = computeChallengeScore({
      playersSolved: 0, totalGuessers: 3,
      averageSolveTimeSec: 60, hintsUsed: 2, difficulty: "Hard",
    });
    expect(hard.tooHard).toBe(true);
  });
});

describe("masked word", () => {
  it("hides unrevealed letters", () => {
    expect(maskedWord("DOLPHIN", new Set())).toBe("_ _ _ _ _ _ _");
  });

  it("reveals letters only at the given positions", () => {
    expect(maskedWord("BANANA", new Set([1, 3, 5]))).toBe("_ A _ A _ A");
    // Position-based: revealing position 1 (A) does not light up other A's.
    expect(maskedWord("BANANA", new Set([1]))).toBe("_ A _ _ _ _");
  });
});

describe("letter reveals", () => {
  it("pre-reveals letters at round start", () => {
    const positions = pickRevealedLetters("BOOKS", "Medium");
    expect(positions.size).toBe(initialRevealCount("BOOKS", "Medium"));
    expect(positions.size).toBeGreaterThanOrEqual(1);
    // At least 2 letters must stay hidden.
    expect(positions.size).toBeLessThanOrEqual("BOOKS".length - 2);
  });

  it("is deterministic for the same word and difficulty", () => {
    expect(pickRevealedLetters("ELEPHANT", "Easy")).toEqual(
      pickRevealedLetters("ELEPHANT", "Easy")
    );
  });

  it("reveals more letters for easier words", () => {
    expect(initialRevealCount("DOLPHIN", "Easy"))
      .toBeGreaterThan(initialRevealCount("DOLPHIN", "Hard"));
  });

  it("short words still get at least one letter revealed", () => {
    expect(initialRevealCount("CAT", "Hard")).toBe(1);
  });

  it("pickRevealableLetter fills left-to-right and returns null when done", () => {
    expect(pickRevealableLetter("BOOKS", new Set([0, 4]))).toBe(1);
    expect(pickRevealableLetter("BOOKS", new Set([0, 1, 2, 3, 4]))).toBeNull();
  });

  it("produces a mockup-style board like B _ _ _ S", () => {
    const word = "BOOKS";
    const positions = pickRevealedLetters(word, "Medium");
    const board = maskedWord(word, positions).split(" ");
    expect(board).toHaveLength(word.length);
    const shown = board.filter((c) => c !== "_");
    expect(shown.length).toBe(positions.size);
  });
});

describe("challenge validation", () => {
  const base = { category: "Animals", difficulty: "Medium", hint1: "A big animal" };

  it("accepts a valid challenge", () => {
    const res = validateChallenge({ ...base, word: "elephant" }, new Set());
    expect(res.ok).toBe(true);
    expect(res.value?.word).toBe("ELEPHANT");
  });

  it("rejects empty or too-short words", () => {
    expect(validateChallenge({ ...base, word: "  " }, new Set()).ok).toBe(false);
    expect(validateChallenge({ ...base, word: "ab" }, new Set()).ok).toBe(false);
  });

  it("rejects words longer than the max", () => {
    expect(validateChallenge({ ...base, word: "ABCDEFGHIJKLMNOP" }, new Set()).ok).toBe(false);
  });

  it("strips non-letter characters from the word", () => {
    const res = validateChallenge({ ...base, word: "ice-cream!" }, new Set());
    expect(res.ok).toBe(true);
    expect(res.value?.word).toBe("ICECREAM");
  });

  it("rejects hints that contain the secret word", () => {
    const res = validateChallenge(
      { ...base, word: "ELEPHANT", hint1: "An ELEPHANT is huge" },
      new Set()
    );
    expect(res.ok).toBe(false);
  });

  it("rejects empty hint", () => {
    expect(validateChallenge({ ...base, word: "ELEPHANT", hint1: "  " }, new Set()).ok).toBe(false);
  });

  it("rejects profanity in the word or hints", () => {
    expect(validateChallenge({ ...base, word: "SHIT" }, new Set()).ok).toBe(false);
    expect(
      validateChallenge({ ...base, word: "FLOWER", hint1: "what the fuck" }, new Set()).ok
    ).toBe(false);
  });

  it("rejects repeated words by the same master", () => {
    const res = validateChallenge({ ...base, word: "ELEPHANT" }, new Set(["ELEPHANT"]));
    expect(res.ok).toBe(false);
  });
});

describe("word database", () => {
  it("has entries across all difficulties", () => {
    for (const d of ["Easy", "Medium", "Hard"] as const) {
      const pool = WORD_DATABASE.filter((w) => w.difficulty === d);
      expect(pool.length).toBeGreaterThan(5);
    }
  });

  it("covers all eight categories", () => {
    const cats = new Set(WORD_DATABASE.map((w) => w.category));
    for (const c of ["Animals", "Food", "Movies", "Sports", "Countries", "Technology", "Nature", "General"]) {
      expect(cats.has(c)).toBe(true);
    }
  });

  it("every entry has a word, category, difficulty and hint", () => {
    for (const w of WORD_DATABASE) {
      expect(w.word.length).toBeGreaterThanOrEqual(3);
      expect(w.word).toMatch(/^[A-Z]+$/);
      expect(w.category).toBeTruthy();
      expect(["Easy", "Medium", "Hard"]).toContain(w.difficulty);
      expect(w.hint.length).toBeGreaterThan(5);
      if (w.hint2) expect(w.hint2.toLowerCase()).not.toContain(w.word.toLowerCase());
    }
  });

  it("pickRandomWord respects exclusion", () => {
    const exclude = new Set(WORD_DATABASE.map((w) => w.word));
    const picked = pickRandomWord({ exclude });
    expect(WORD_DATABASE.some((w) => w.word === picked.word)).toBe(true);
  });

  it("pickRandomWord filters by difficulty", () => {
    for (let i = 0; i < 20; i++) {
      const w = pickRandomWord({ difficulty: "Hard" });
      expect(w.difficulty).toBe("Hard");
    }
  });
});
