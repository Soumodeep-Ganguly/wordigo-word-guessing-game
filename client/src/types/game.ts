export type Difficulty = "Easy" | "Medium" | "Hard";

export type GameMode = "classic" | "player-words" | "mixed";

export type RoundKind = "system" | "player";

export type RoundPhase =
  | "countdown"
  | "creating"
  | "guessing"
  | "round-end"
  | "game-end";

export interface ScoringConfig {
  correct: number;
  speedBonusMax: number;
  wrongGuessPenalty: number;
  hintPenalty: number;
  firstCorrect: number;
  secondCorrect: number;
  thirdCorrect: number;
  laterCorrect: number;
  wordMasterBase: number;
  wordMasterOneSolverBonus: number;
  wordMasterMultiSolverBonus: number;
  wordMasterNoSolver: number;
  hintPenaltyFactor: number;
}

export interface RoomSettings {
  rounds: number;
  roundDurationSec: number;
  wordMasterTimeSec: number;
  maxHints: 1 | 2;
  mode: GameMode;
  requireAllWordMasters: boolean;
  playerRounds: number;
  maxPlayers: number;
  scoring: ScoringConfig;
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

export interface PublicChallenge {
  roundKind: RoundKind;
  category: string;
  difficulty: Difficulty;
  hints: string[];
  hint2Available: boolean;
  wordMasterName?: string;
  wordMasterId?: string;
  wordLength: number;
  maskedWord: string;
}

export interface GuessLogEntry {
  playerName: string;
  correct: boolean;
  at: number;
}

export interface ChallengeReport {
  challengeScore: number;
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
  endsAt: number | null;
  /** Live deadline for all timed phases (guessing / countdown / creating). */
  phaseEndsAt: number | null;
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
