import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Lightbulb, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MaskedWord } from "@/components/game/MaskedWord";
import { CountdownTimer } from "@/components/game/CountdownTimer";
import { GuessInput } from "@/components/game/GuessInput";
import { ScoreBadge } from "@/components/game/ScoreBadge";
import { toast } from "sonner";
import {
  OfflineConfig,
} from "./OfflineSetupView";
import {
  OfflineRound,
  OfflineStats,
  applyGuess,
  buyLetterHint,
  createOfflineRound,
  firstHiddenPosition,
  loadOfflineStats,
  loadSettings,
  maskWord,
  recordRound,
  scoreRound,
} from "@/lib/offline-game";
import {
  playCorrect, playDefeat, playHint, playRoundStart, playVictory, playWrong, setSoundEnabled,
} from "@/lib/sounds";
import { AppView } from "./HomeView";

interface OfflineGameViewProps {
  onNavigate: (view: AppView) => void;
  config: OfflineConfig;
}

type Phase = "playing" | "round-end" | "game-end";

export function OfflineGameView({ onNavigate, config }: OfflineGameViewProps) {
  const settings = loadSettings();
  const isPractice = config.difficulty === "practice";

  const [phase, setPhase] = useState<Phase>("playing");
  const [round, setRound] = useState<OfflineRound | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [hintsCount, setHintsCount] = useState(0);
  const [personalHint, setPersonalHint] = useState<string | null>(null);
  const [lastPoints, setLastPoints] = useState<{ show: boolean; points: number }>({ show: false, points: 0 });
  const [stats, setStats] = useState<OfflineStats>(() => loadOfflineStats());
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const comboRef = useRef(0);
  const usedWordsRef = useRef<Set<string>>(new Set());
  const savedRef = useRef(false);

  useEffect(() => {
    setSoundEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  const startRound = useCallback(() => {
    const r = createOfflineRound(config.difficulty, usedWordsRef.current);
    usedWordsRef.current.add(r.word.word);
    setRound(r);
    setPersonalHint(null);
    setPhase("playing");
    setEndsAt(Date.now() + config.roundDurationSec * 1000);
    playRoundStart();
  }, [config.difficulty, config.roundDurationSec]);

  useEffect(() => {
    startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishGame = useCallback(
    (finalScore: number, finalCorrect: number, finalWrong: number, finalHints: number, won: boolean) => {
      setPhase("game-end");
      if (!isPractice && !savedRef.current) {
        savedRef.current = true;
        setStats(recordRound(loadOfflineStats(), {
          won,
          score: finalScore,
          correct: finalCorrect,
          wrong: finalWrong,
          hints: finalHints,
        }));
      }
      if (won) playVictory(); else playDefeat();
    },
    [isPractice]
  );

  const nextRound = useCallback(() => {
    if (roundNumber >= config.rounds) {
      finishGame(score, correctCount, wrongCount, hintsCount, correctCount > 0);
    } else {
      setRoundNumber((n) => n + 1);
      startRound();
    }
  }, [roundNumber, config.rounds, score, correctCount, wrongCount, hintsCount, finishGame, startRound]);

  const handleExpire = useCallback(() => {
    setPhase((current) => {
      if (current !== "playing") return current;
      return current;
    });
    if (phase !== "playing" || !round || round.solved) return;
    const updated: OfflineRound = { ...round, failed: true };
    setRound(updated);
    comboRef.current = 0;
    setCombo(0);
    playWrong();
    setPhase("round-end");
  }, [phase, round]);

  const handleGuess = (guess: string) => {
    if (!round || phase !== "playing") return;
    const { round: updated, correct, fullySolved } = applyGuess(round, guess);

    if (fullySolved) {
      const timeLeft = Math.max(0, ((endsAt || 0) - Date.now()) / 1000);
      const points = isPractice ? 0 : scoreRound(updated, timeLeft, config.roundDurationSec, comboRef.current);
      comboRef.current += 1;
      setRound(updated);
      setScore((s) => s + points);
      setCorrectCount((c) => c + 1);
      setCombo(comboRef.current);
      setLastPoints({ show: true, points });
      setTimeout(() => setLastPoints({ show: false, points: 0 }), 1100);
      playCorrect();
      setPhase("round-end");
      if (comboRef.current >= 3) {
        toast.success(`🔥 ${comboRef.current}x combo streak!`);
      }
    } else if (!correct) {
      setWrongCount((w) => w + 1);
      setShake(true);
      setTimeout(() => setShake(false), 450);
      playWrong();
      if (!isPractice) setScore((s) => Math.max(0, s - 5));
    } else {
      setRound(updated);
      playCorrect();
    }
  };

  const handleHint = () => {
    if (!round || phase !== "playing") return;
    const { round: updated, letter, textHint, cost } = buyLetterHint(round);
    if (!letter && !textHint) {
      toast.error("No more hints available for this word.");
      return;
    }
    setRound(updated);
    setHintsCount((h) => h + 1);
    if (letter) {
      playHint();
      toast.success(`💡 Letter "${letter}" revealed! (−${Math.abs(cost)})`);
    } else if (textHint) {
      setPersonalHint(textHint);
      playHint();
    }
    if (!isPractice) setScore((s) => Math.max(0, s + cost)); // cost is negative
  };

  const goHome = () => {
    // Persist partial progress when leaving mid-game.
    if (phase === "playing" && !isPractice && !savedRef.current && (correctCount > 0 || wrongCount > 0)) {
      savedRef.current = true;
      recordRound(loadOfflineStats(), {
        won: false, score, correct: correctCount, wrong: wrongCount, hints: hintsCount,
      });
    }
    onNavigate("home");
  };

  if (!round) return null;

  const masked = maskWord(round.word.word, round.guessedLetters);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col p-4">
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={goHome}>
            <ArrowLeft className="h-4 w-4" /> Exit
          </Button>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
              Round {roundNumber} / {config.rounds}
            </span>
            <CountdownTimer endsAt={phase === "playing" ? endsAt : null} onExpired={handleExpire} />
          </div>
        </div>

        <div className="relative flex-1">
          <ScoreBadge show={lastPoints.show} points={lastPoints.points} />
          <Card className="border-white/20 bg-black/20 text-white backdrop-blur">
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                  {round.word.category}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                  {round.word.difficulty}
                </span>
              </div>

              <MaskedWord maskedWord={masked} shake={shake} />

              {personalHint && (
                <div className="anim-slide-down rounded-lg bg-yellow-400/20 p-3 text-sm">
                  💡 <b>Hint:</b> {personalHint}
                </div>
              )}

              {phase === "playing" && (
                <GuessInput onSubmit={handleGuess} placeholder="Type the word..." />
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  Score: <b className="font-mono text-lg">{score}</b>
                  {combo >= 2 && <span className="ml-2 text-yellow-300">🔥 x{combo}</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/40 text-white hover:bg-white/10"
                  onClick={handleHint}
                  disabled={
                    phase !== "playing" ||
                    firstHiddenPosition(round.word.word, round.hintedPositions) === null &&
                      ((round.hintsUsed >= 1 && !round.word.hint2) || round.hintsUsed >= 2)
                  }
                >
                  <Lightbulb className="h-4 w-4" />
                  Hint (−25)
                </Button>
              </div>

              {/* Attempt history */}
              {round.attempts.length > 0 && (
                <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg bg-black/20 p-2 text-xs">
                  {round.attempts.slice(-6).map((a, i) => (
                    <div key={i} className={a.correct ? "text-green-300" : "text-red-300 line-through"}>
                      {a.guess}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Round end overlay */}
        {phase === "round-end" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-sm border-white/30 anim-bounce-in">
              <CardContent className="space-y-4 p-6 text-center">
                <div className="text-4xl">{round.solved ? "🎉" : "😔"}</div>
                <h2 className="text-xl font-black">
                  {round.solved ? "Correct!" : "Time's up!"}
                </h2>
                <p className="text-muted-foreground">
                  The word was <b className="text-primary">{round.word.word}</b>
                </p>
                {round.solved && !isPractice && (
                  <p className="font-bold text-green-600 dark:text-green-400">+{lastPoints.points} points</p>
                )}
                <Button className="h-11 w-full font-bold" onClick={nextRound}>
                  {roundNumber >= config.rounds ? "See Results" : "Next Round"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Game end */}
        {phase === "game-end" && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-sm border-white/30 anim-bounce-in">
              <CardContent className="space-y-4 p-6 text-center">
                <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
                <h2 className="text-2xl font-black">
                  {isPractice ? "Practice Complete!" : stats.currentStreak > 0 ? `🏆 ${stats.currentStreak} Win Streak!` : "Game Complete!"}
                </h2>
                {!isPractice && (
                  <div className="space-y-1 text-sm">
                    <p>Final score: <b className="font-mono text-lg">{score}</b></p>
                    <p className="text-muted-foreground">
                      ✅ {correctCount} correct · ❌ {wrongCount} wrong · 💡 {hintsCount} hints
                    </p>
                    <p className="text-muted-foreground">Best score: {stats.bestScore}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="h-11 flex-1" onClick={() => onNavigate("home")}>
                    Home
                  </Button>
                  <Button
                    className="h-11 flex-1 font-bold"
                    onClick={() => {
                      setScore(0); setCorrectCount(0); setWrongCount(0); setHintsCount(0);
                      setRoundNumber(1); comboRef.current = 0; usedWordsRef.current.clear();
                      savedRef.current = false;
                      startRound();
                    }}
                  >
                    Play Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
