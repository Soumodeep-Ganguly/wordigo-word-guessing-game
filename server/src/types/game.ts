export type Difficulty = "Easy" | "Medium" | "Hard";

export type GameMode = "classic" | "player-words" | "mixed";

export type RoundKind = "system" | "player";

export type RoundPhase =
  | "countdown"
  | "creating" // Word Master is composing a challenge
  | "guessing"
  | "round-end"
  | "game-end";

export interface RoomSettings {
  rounds: number; // total rounds in the match
  roundDurationSec: number; // guessing timer
  wordMasterTimeSec: number; // deadline to submit a player challenge
  maxHints: 1 | 2;
  mode: GameMode;
  requireAllWordMasters: boolean; // every player creates at least one word
  playerRounds: number; // how many player-created rounds (mixed mode)
  maxPlayers: number; // room capacity, host-selectable (2-8)
  scoring: ScoringConfig;
}

export interface ScoringConfig {
  correct: number; // base points for a correct guess
  speedBonusMax: number; // max speed bonus
  wrongGuessPenalty: number; // negative
  hintPenalty: number; // cost of using a hint
  // "Your Word, Our Guess" guesser rewards
  firstCorrect: number;
  secondCorrect: number;
  thirdCorrect: number;
  laterCorrect: number;
  // Word Master rewards
  wordMasterBase: number;
  wordMasterOneSolverBonus: number;
  wordMasterMultiSolverBonus: number;
  wordMasterNoSolver: number;
  // penalty applied per hint revealed in player rounds (multiplier on available points)
  hintPenaltyFactor: number; // e.g. 0.75 => available points * 0.75 per hint used
}

export const DEFAULT_SCORING: ScoringConfig = {
  correct: 100,
  speedBonusMax: 100,
  wrongGuessPenalty: -5,
  hintPenalty: -25,
  firstCorrect: 150,
  secondCorrect: 125,
  thirdCorrect: 100,
  laterCorrect: 75,
  wordMasterBase: 50,
  wordMasterOneSolverBonus: 100,
  wordMasterMultiSolverBonus: 75,
  wordMasterNoSolver: 25,
  hintPenaltyFactor: 0.75,
};

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 5,
  roundDurationSec: 60,
  wordMasterTimeSec: 45,
  maxHints: 2,
  mode: "classic",
  requireAllWordMasters: true,
  playerRounds: 3,
  maxPlayers: 8,
  scoring: DEFAULT_SCORING,
};

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const ROOM_CODE_LENGTH = 6;
export const REVEAL_DELAY_MS = 5000;

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  connected: boolean;
  isHost: boolean;
  hasSubmittedChallenge: boolean;
  wordsCreated: number;
  wordsGuessed: number;
  totalGuessTimeMs: number;
  correctGuessCount: number;
  bestChallengeScore: number;
}

/** Challenge as seen by guessers — never contains the word. */
export interface PublicChallenge {
  roundKind: RoundKind;
  category: string;
  difficulty: Difficulty;
  hints: string[];
  hint2Available: boolean;
  wordMasterName?: string;
  wordMasterId?: string;
  wordLength: number;
  maskedWord: string; // e.g. "_ _ A _ _ _" — letters already revealed correctly
}

export interface GuessLogEntry {
  playerName: string;
  correct: boolean;
  at: number;
}

export interface ChallengeReport {
  challengeScore: number; // 0-100
  playersSolved: number;
  totalGuessers: number;
  averageSolveTimeSec: number;
  hintsUsed: number;
  difficulty: Difficulty;
  tooEasy: boolean;
  tooHard: boolean;
}

export interface RoundResult {
  roundNumber: number;
  kind: RoundKind;
  word: string;
  category: string;
  difficulty: Difficulty;
  wordMasterName?: string;
  challengeReport?: ChallengeReport;
  solvers: { playerId: string; name: string; points: number; timeSec: number }[];
}

export interface RoundState {
  roundNumber: number;
  kind: RoundKind;
  phase: RoundPhase;
  wordMasterId?: string;
  endsAt: number | null; // epoch ms for the guessing timer (null until guessing)
  phaseEndsAt: number | null; // live deadline for the current timed phase (countdown / creating / guessing)
  challenge: PublicChallenge | null;
  guessLog: GuessLogEntry[];
  result: RoundResult | null;
}

export interface MatchSummary {
  rankings: { playerId: string; name: string; color: string; score: number }[];
  awards: {
    bestGuesser?: { name: string; value: string };
    bestWordMaster?: { name: string; value: string };
    fastestGuess?: { name: string; value: string };
  };
}

export interface PublicRoomState {
  roomId: string;
  players: PublicPlayer[];
  hostId: string;
  settings: RoomSettings;
  started: boolean;
  round: RoundState | null;
  roundNumber: number;
  totalRounds: number;
  summary: MatchSummary | null;
}

/** Internal server-side room. NEVER sent to clients (contains secret word). */
export interface ServerRoom {
  roomId: string;
  hostId: string;
  players: ServerPlayer[];
  settings: RoomSettings;
  started: boolean;
  createdAt: number;
  lastActivityAt: number;
  round: ServerRoundState | null;
  summary: MatchSummary | null;
}

export interface ServerPlayer {
  id: string;
  name: string;
  color: string;
  score: number;
  connected: boolean;
  hasSubmittedChallenge: boolean;
  wordsCreated: number;
  wordsGuessed: number;
  totalGuessTimeMs: number;
  correctGuessCount: number;
  bestChallengeScore: number;
  /** id -> name of disconnected players who may reconnect (for rejoin mapping) */
  rejoinName?: string;
}

export interface ServerRoundState {
  roundNumber: number;
  kind: RoundKind;
  phase: RoundPhase;
  wordMasterId?: string;
  phaseEndsAt: number | null;
  // secret data — never serialized to clients
  secret?: {
    word: string;
    category: string;
    difficulty: Difficulty;
    hint1: string;
    hint2?: string;
    hint2Revealed: boolean;
    createdById?: string;
    createdAt: number;
  };
  publicChallenge: PublicChallenge | null;
  solvers: { playerId: string; name: string; points: number; timeSec: number }[];
  guessLog: GuessLogEntry[];
  correctAtByPlayer: Record<string, number>;
  wrongGuessCount: Record<string, number>;
  hintUsed: Record<string, boolean>;
  result: RoundResult | null;
}

export const PLAYER_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#eab308", // yellow
];

export function generateRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
