import { useState } from "react";
import { ArrowLeft, BarChart3, Trophy, Target, Flame, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadOfflineStats, resetOfflineStats } from "@/lib/offline-game";
import { AppView } from "./HomeView";

interface StatisticsViewProps {
  onNavigate: (view: AppView) => void;
}

export function StatisticsView({ onNavigate }: StatisticsViewProps) {
  const [stats, setStats] = useState(loadOfflineStats);

  const cards = [
    { icon: BarChart3, label: "Games Played", value: stats.gamesPlayed },
    { icon: Trophy, label: "Games Won", value: stats.gamesWon },
    { icon: Target, label: "Correct Guesses", value: stats.correctGuesses },
    { icon: Target, label: "Wrong Guesses", value: stats.wrongGuesses },
    { icon: Lightbulb, label: "Hints Used", value: stats.hintsUsed },
    { icon: Flame, label: "Longest Streak", value: stats.longestStreak },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 text-2xl font-black text-white">
              <BarChart3 className="h-6 w-6" /> Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              {cards.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl bg-secondary p-3 text-center">
                  <Icon className="mx-auto mb-1 h-5 w-5 text-primary" />
                  <div className="text-xl font-black">{value}</div>
                  <div className="text-[11px] text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-yellow-500/15 p-3 text-center ring-1 ring-yellow-500/30">
                <div className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{stats.bestScore}</div>
                <div className="text-[11px] text-muted-foreground">Best Score</div>
              </div>
              <div className="rounded-xl bg-orange-500/15 p-3 text-center ring-1 ring-orange-500/30">
                <div className="text-2xl font-black text-orange-600 dark:text-orange-400">{stats.currentStreak}</div>
                <div className="text-[11px] text-muted-foreground">Current Streak</div>
              </div>
            </div>

            <div className="rounded-xl bg-secondary p-3 text-center text-sm">
              Total points earned: <b className="font-mono">{stats.totalScore}</b>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onNavigate("home")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                variant="destructive"
                className="h-11 flex-1"
                onClick={() => {
                  resetOfflineStats();
                  setStats(loadOfflineStats());
                }}
              >
                Reset Stats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
