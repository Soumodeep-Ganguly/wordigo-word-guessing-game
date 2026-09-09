import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Lightbulb, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MaskedWord } from "@/components/game/MaskedWord";
import { CountdownTimer } from "@/components/game/CountdownTimer";
import { GuessInput } from "@/components/game/GuessInput";
import { PlayerList, PodiumList } from "@/components/game/PlayerList";
import { ScoreBadge } from "@/components/game/ScoreBadge";
import { socket } from "@/lib/socket";
import { PublicRoomState, RoundResult } from "@/types/game";
import {
  playCorrect, playCountdown, playDefeat, playHint,
  playRoundStart, playScoreUpdate, playVictory, playWrong, setSoundEnabled,
} from "@/lib/sounds";
import { loadSettings } from "@/lib/offline-game";
import { AppView } from "./HomeView";

interface GameViewProps {
  state: PublicRoomState;
  myId: string;
  onNavigate: (view: AppView) => void;
}

const CATEGORIES = [
  "Animals", "Food", "Movies", "Sports", "Countries", "Technology", "Nature", "General",
];

export function GameView({ state, myId, onNavigate }: GameViewProps) {
  const settings = loadSettings();
  const [liveState, setLiveState] = useState<PublicRoomState>(state);
  const [guessError, setGuessError] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [createDeadline, setCreateDeadline] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [lastPoints, setLastPoints] = useState<{ show: boolean; points: number }>({ show: false, points: 0 });
  const [finalFlash, setFinalFlash] = useState(false);
  const [challengeForm, setChallengeForm] = useState({
    word: "",
    category: "Animals",
    hint1: "",
    hint2: "",
    difficulty: "Medium" as "Easy" | "Medium" | "Hard",
  });

  const myPlayer = liveState.players.find((p) => p.id === myId);
  const round = liveState.round;
  const isMyTurnToCreate =
    round?.phase === "creating" && round?.wordMasterId === myId && round?.kind === "player";

  useEffect(() => setSoundEnabled(settings.soundEnabled), [settings.soundEnabled]);

  // ─── Socket event wiring ────────────────────────────────────────────────
  const applyUpdate = useCallback((payload: unknown) => {
    const state = (payload as { state?: PublicRoomState })?.state;
    if (state) setLiveState(state);
  }, []);

  useEffect(() => {
    const handlers: Record<string, (...args: unknown[]) => void> = {
      "room-state": (p) => applyUpdate(p),
      "player-joined": (p) => applyUpdate(p),
      "player-left": (p) => applyUpdate(p),
      "player-reconnected": (p) => applyUpdate(p),
      "round-started": (p) => {
        applyUpdate(p);
        setRoundResult(null);
        playRoundStart();
      },
      "guessing-started": (p) => {
        applyUpdate(p);
        setChallengeError(null);
      },
      "correct-guess": (p) => {
        const { state, playerName, points } = p as { state: PublicRoomState; playerName: string; points: number };
        applyUpdate({ state });
        if (playerName === myPlayer?.name) {
          setLastPoints({ show: true, points });
          setTimeout(() => setLastPoints({ show: false, points: 0 }), 1100);
          playCorrect();
          playScoreUpdate();
        } else {
          toast.message(`${playerName} guessed the word! +${points}`);
        }
      },
      "wrong-guess": (p) => {
        const { state, playerName } = p as { state: PublicRoomState; playerName: string };
        applyUpdate({ state });
        if (playerName === myPlayer?.name) playWrong();
      },
      "hint-revealed": (p) => {
        const { state, hint } = p as { state: PublicRoomState; hint: string };
        applyUpdate({ state });
        playHint();
        toast.message(`💡 New hint: ${hint}`);
      },
      "hint-revealed-personal": (p) => {
        const { hint } = p as { hint: string };
        playHint();
        toast.message(`💡 ${hint}`);
      },
      "letter-revealed": (p) => {
        const { state, letter, byPlayer } = p as {
          state: PublicRoomState; letter: string; byPlayer: string;
        };
        applyUpdate({ state });
        playHint();
        if (byPlayer === myPlayer?.name) {
          toast.message(`💡 Hint used — letter "${letter}" revealed!`);
        } else {
          toast.message(`💡 ${byPlayer} used a hint — letter "${letter}" revealed!`);
        }
      },
      "round-ended": (p) => {
        const { state, result } = p as { state: PublicRoomState; result: RoundResult };
        applyUpdate({ state });
        setRoundResult(result);
      },
      "game-ended": (p) => {
        const { state } = p as { state: PublicRoomState };
        applyUpdate({ state });
        setFinalFlash(true);
        const me = state.players.find((pl) => pl.id === myId);
        const winner = state.summary?.rankings[0];
        if (winner && me && winner.playerId === me.id) playVictory();
        else playDefeat();
      },
      "challenge-skipped": (p) => {
        const { state, reason } = p as { state: PublicRoomState; reason: string };
        applyUpdate({ state });
        toast.message(reason);
      },
      "challenge-cancelled": (p) => {
        const { state, reason } = p as { state: PublicRoomState; reason: string };
        applyUpdate({ state });
        toast.message(reason);
      },
      "your-turn-to-create": (p) => {
        const { deadlineAt } = p as { deadlineAt: number };
        setCreateDeadline(deadlineAt);
        toast.message("✏️ Your turn to create a challenge!");
      },
      "guess-error": (p) => setGuessError((p as { message: string }).message),
      "challenge-error": (p) => setChallengeError((p as { message: string }).message),
      "room-error": (p) => toast.error((p as { message: string }).message),
    };

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler as never);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler as never);
      }
    };
  }, [applyUpdate, myPlayer?.name, myId]);

  // Countdown sound when a new round starts
  const lastRoundRef = useRef(0);
  useEffect(() => {
    if (round && round.roundNumber !== lastRoundRef.current) {
      lastRoundRef.current = round.roundNumber;
      if (round.phase === "countdown") playCountdown();
    }
  }, [round?.roundNumber, round?.phase, round]);

  // ─── Actions ────────────────────────────────────────────────────────────
  const submitGuess = (g: string) => {
    setGuessError(null);
    socket.emit("submit-guess", { roomId: liveState.roomId, guess: g });
  };

  const useMyHint = () => {
    socket.emit("use-hint", { roomId: liveState.roomId });
  };

  const revealHint2 = () => {
    socket.emit("reveal-hint2", { roomId: liveState.roomId });
  };

  const submitChallenge = () => {
    setChallengeError(null);
    socket.emit("submit-challenge", {
      roomId: liveState.roomId,
      challenge: {
        word: challengeForm.word,
        category: challengeForm.category,
        hint1: challengeForm.hint1,
        hint2: challengeForm.hint2 || undefined,
        difficulty: challengeForm.difficulty,
      },
    });
  };

  const nextRound = () => socket.emit("next-round", { roomId: liveState.roomId });
  const playAgain = () => {
    setFinalFlash(false);
    setRoundResult(null);
    socket.emit("play-again", { roomId: liveState.roomId });
  };
  const leave = () => {
    socket.emit("leave-room", { roomId: liveState.roomId });
    onNavigate("home");
  };

  const guessers = useMemo(
    () => liveState.players.filter((p) => p.id !== round?.wordMasterId),
    [liveState.players, round?.wordMasterId]
  );

  // ─── Word Master creation UI ────────────────────────────────────────────
  if (isMyTurnToCreate) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
          <Card className="border-white/30 shadow-2xl">
            <CardContent className="space-y-4 p-5">
              <div className="text-center">
                <h2 className="text-xl font-black text-white">✏️ YOUR TURN TO CREATE A CHALLENGE</h2>
                {createDeadline && (
                  <p className="mt-1 text-xs text-white/75">
                    Submit within <CountdownTimer endsAt={createDeadline} /> or a system word is used
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/90">Secret word</Label>
                <Input
                  value={challengeForm.word}
                  onChange={(e) => setChallengeForm({ ...challengeForm, word: e.target.value })}
                  placeholder="e.g. DOLPHIN"
                  maxLength={15}
                  className="h-11 bg-white/10 border-white/30 text-white uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/90">Category</Label>
                <Select
                  value={challengeForm.category}
                  onValueChange={(v) => setChallengeForm({ ...challengeForm, category: v })}
                >
                  <SelectTrigger className="h-11 w-full bg-white/10 border-white/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/90">Hint 1</Label>
                <Input
                  value={challengeForm.hint1}
                  onChange={(e) => setChallengeForm({ ...challengeForm, hint1: e.target.value })}
                  placeholder="A clue that doesn't reveal the word"
                  maxLength={120}
                  className="h-11 bg-white/10 border-white/30 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/90">Hint 2 (optional)</Label>
                <Input
                  value={challengeForm.hint2}
                  onChange={(e) => setChallengeForm({ ...challengeForm, hint2: e.target.value })}
                  placeholder="Extra hint you can reveal mid-round"
                  maxLength={120}
                  className="h-11 bg-white/10 border-white/30 text-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-white/90">Difficulty</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Easy", "Medium", "Hard"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setChallengeForm({ ...challengeForm, difficulty: d })}
                      className={`rounded-lg border-2 py-2 text-sm font-bold transition-all active:scale-95 ${
                        challengeForm.difficulty === d
                          ? "border-white bg-white/20 text-white"
                          : "border-white/25 text-white/80 hover:border-white/50"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {challengeError && (
                <p className="text-sm font-semibold text-destructive">{challengeError}</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="h-11 flex-1" onClick={leave}>
                  <ArrowLeft className="h-4 w-4" /> Leave
                </Button>
                <Button
                  className="h-11 flex-[2] font-bold"
                  disabled={!challengeForm.word.trim() || !challengeForm.hint1.trim()}
                  onClick={submitChallenge}
                >
                  CREATE CHALLENGE
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Final results ──────────────────────────────────────────────────────
  if (liveState.summary) {
    const winner = liveState.summary.rankings[0];
    return (
      <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
          <Card className="border-white/30 shadow-2xl anim-bounce-in">
            <CardContent className="space-y-4 p-6 text-center">
              <div className="text-5xl">🏆</div>
              <h2 className="text-2xl font-black text-white">GAME COMPLETE!</h2>
              {winner && (
                <p className="text-lg font-bold text-yellow-300">
                  🥇 {winner.name} — {winner.score} points
                </p>
              )}
              <div className="rounded-xl bg-black/25 p-3 text-left">
                <PodiumList
                  players={liveState.summary.rankings.map((r) => ({
                    ...myPlayer!,
                    id: r.playerId,
                    name: r.name,
                    color: r.color,
                    score: r.score,
                  }))}
                />
              </div>

              <div className="space-y-1 rounded-xl bg-white/10 p-3 text-sm text-white/90">
                {liveState.summary.awards.bestGuesser && (
                  <p>🎯 Best Guess: <b>{liveState.summary.awards.bestGuesser.name}</b> ({liveState.summary.awards.bestGuesser.value})</p>
                )}
                {liveState.summary.awards.bestWordMaster && (
                  <p>✏️ Best Word Master: <b>{liveState.summary.awards.bestWordMaster.name}</b> ({liveState.summary.awards.bestWordMaster.value})</p>
                )}
                {liveState.summary.awards.fastestGuess && (
                  <p>⚡ Fastest Guess: <b>{liveState.summary.awards.fastestGuess.name}</b> ({liveState.summary.awards.fastestGuess.value})</p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="h-11 flex-1" onClick={leave}>
                  Return to Lobby
                </Button>
                {liveState.hostId === myId && (
                  <Button className="h-11 flex-1 font-bold" onClick={playAgain}>
                    Play Again
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Waiting for host (between matches) ─────────────────────────────────
  if (!round) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-indigo-600 to-fuchsia-600 p-4 dark:from-indigo-950 dark:to-fuchsia-950">
        <Card className="border-white/30">
          <CardContent className="p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-8 w-8 animate-pulse text-primary" />
            <p>Waiting for the host to start the game...</p>
            <Button variant="outline" className="mt-4" onClick={leave}>Leave</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Main gameplay ──────────────────────────────────────────────────────
  const challenge = round.challenge;
  const amIWordMaster = round.wordMasterId === myId;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col p-3 sm:p-4">
        {/* Top bar */}
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={leave}>
            <ArrowLeft className="h-4 w-4" /> Exit
          </Button>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
              Round {round.roundNumber} / {liveState.totalRounds}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white">
              {round.kind === "player" ? "✏️ Player word" : "🌐 System word"}
            </span>
          </div>
        </div>

        {/* Countdown between rounds */}
        {round.phase === "countdown" && (
          <Card className="border-white/20 bg-black/20 text-white backdrop-blur">
            <CardContent className="p-8 text-center">
              <div className="text-4xl font-black anim-pop-in">3...</div>
              <p className="mt-2 text-sm text-white/80">Get ready!</p>
            </CardContent>
          </Card>
        )}

        {/* Word Master composing (non-creators wait) */}
        {round.phase === "creating" && !isMyTurnToCreate && (
          <Card className="border-white/20 bg-black/20 text-white backdrop-blur">
            <CardContent className="p-8 text-center">
              <div className="text-3xl anim-glow">✏️</div>
              <p className="mt-2 font-bold">
                {challenge?.wordMasterName ||
                  liveState.players.find((p) => p.id === round.wordMasterId)?.name ||
                  "A player"}{" "}
              is creating a challenge...
              </p>
              <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-white/60" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Guessing phase */}
        {(round.phase === "guessing" || round.phase === "round-end") && challenge && (
          <div className="relative flex-1">
            <ScoreBadge show={lastPoints.show} points={lastPoints.points} />
            <Card className="border-white/20 bg-black/20 text-white backdrop-blur">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                    {challenge.category}
                  </span>
                  <CountdownTimer
                    endsAt={round.phase === "guessing" ? round.endsAt : null}
                  />
                </div>

                {challenge.wordMasterName && (
                  <p className="text-center text-sm text-white/80">
                    Word Master: <b>{challenge.wordMasterName}</b>
                  </p>
                )}

                <div className="space-y-2 rounded-xl bg-white/10 p-3">
                  {challenge.hints.map((h, i) => (
                    <p key={i} className="text-sm">
                      💡 <b>Hint {i + 1}:</b> {h}
                    </p>
                  ))}
                </div>

                <MaskedWord
                  maskedWord={round.phase === "round-end" && round.result
                    ? round.result.word.split("").join(" ")
                    : challenge.maskedWord}
                  revealed={round.phase === "round-end"}
                />

                {round.phase === "guessing" && !amIWordMaster && (
                  <>
                    <GuessInput onSubmit={submitGuess} placeholder="Type the word..." />
                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={useMyHint}>
                        <Lightbulb className="h-4 w-4" /> Get hint + reveal letter (−25)
                      </Button>
                    </div>
                    {guessError && <p className="text-sm font-semibold text-destructive">{guessError}</p>}
                  </>
                )}

                {amIWordMaster && round.phase === "guessing" && (
                  <p className="text-center text-sm text-white/75">
                    🔒 Players are guessing your word...
                    {challenge.hint2Available && (
                      <button
                        className="ml-2 underline hover:text-white"
                        onClick={revealHint2}
                      >
                        Reveal hint 2
                      </button>
                    )}
                  </p>
                )}

                {/* Live guess feed */}
                {round.guessLog.length > 0 && (
                  <div className="max-h-24 space-y-1 overflow-y-auto rounded-lg bg-black/25 p-2 text-xs">
                    {round.guessLog.slice(-8).map((g, i) => (
                      <div key={i} className={g.correct ? "font-bold text-green-300" : "text-red-300/90 line-through"}>
                        {g.playerName}: {g.correct ? "✅ guessed it!" : "❌ wrong"}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <div className="mt-3 rounded-xl bg-black/20 p-3 backdrop-blur">
              <PlayerList
                players={guessers}
                highlightId={round.wordMasterId}
              />
            </div>
          </div>
        )}

        {/* Round end reveal */}
        {round.phase === "round-end" && roundResult && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
            <Card className="w-full max-w-sm border-white/30 anim-bounce-in">
              <CardContent className="space-y-3 p-6 text-center">
                <div className="text-4xl">🎉</div>
                <h2 className="text-xl font-black">ROUND COMPLETE!</h2>
                <p className="text-muted-foreground text-sm">The word was:</p>
                <p className="text-2xl font-black tracking-widest text-primary">{roundResult.word}</p>
                {roundResult.wordMasterName && (
                  <p className="text-sm text-muted-foreground">
                    Created by: <b>{roundResult.wordMasterName}</b>
                  </p>
                )}

                {roundResult.solvers.length > 0 && (
                  <div className="space-y-1 rounded-xl bg-secondary p-3">
                    {roundResult.solvers.map((s, i) => (
                      <p key={s.playerId} className="text-sm font-semibold">
                        {["🥇", "🥈", "🥉"][i] ?? "•"} {s.name} — {s.points} pts ({s.timeSec}s)
                      </p>
                    ))}
                  </div>
                )}

                {roundResult.challengeReport && (
                  <div className="rounded-xl bg-yellow-500/10 p-3 text-sm ring-1 ring-yellow-500/30">
                    <p className="font-black">Challenge Score: {roundResult.challengeReport.challengeScore}/100 ⭐</p>
                    <p className="text-xs text-muted-foreground">
                      Players solved: {roundResult.challengeReport.playersSolved}/{roundResult.challengeReport.totalGuessers} ·
                      Avg time: {roundResult.challengeReport.averageSolveTimeSec}s ·
                      Hints: {roundResult.challengeReport.hintsUsed}
                    </p>
                  </div>
                )}

                {liveState.hostId === myId && (
                  <Button className="h-11 w-full font-bold" onClick={nextRound}>
                    Next Round
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Game ended banner (in case summary view missed) */}
        {finalFlash && !liveState.summary && <div className="h-2" />}
      </div>
    </div>
  );
}


