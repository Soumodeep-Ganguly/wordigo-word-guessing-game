import { useState } from "react";
import { ArrowLeft, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OfflineDifficulty, loadSettings, saveSettings,
} from "@/lib/offline-game";
import { AppView } from "./HomeView";

interface OfflineSetupViewProps {
  onNavigate: (view: AppView) => void;
  onStart: (config: OfflineConfig) => void;
}

export interface OfflineConfig {
  difficulty: OfflineDifficulty;
  rounds: number;
  roundDurationSec: number;
}

export function OfflineSetupView({ onNavigate, onStart }: OfflineSetupViewProps) {
  const settings = loadSettings();
  const [difficulty, setDifficulty] = useState<OfflineDifficulty>(settings.difficulty);
  const [rounds, setRounds] = useState(String(settings.rounds));
  const [duration, setDuration] = useState(String(settings.roundDurationSec));

  const start = () => {
    const cfg: OfflineConfig = {
      difficulty,
      rounds: Math.max(1, Math.min(15, parseInt(rounds) || 5)),
      roundDurationSec: Math.max(20, Math.min(180, parseInt(duration) || 60)),
    };
    saveSettings({ ...settings, difficulty, rounds: cfg.rounds, roundDurationSec: cfg.roundDurationSec });
    onStart(cfg);
  };

  const difficulties: { value: OfflineDifficulty; label: string; desc: string }[] = [
    { value: "Easy", label: "🙂 Easy", desc: "Common words, longer timer feels relaxed" },
    { value: "Medium", label: "😐 Medium", desc: "A balanced challenge" },
    { value: "Hard", label: "evil Hard", desc: "Rare words — experts only" },
    { value: "practice", label: "🧘 Practice", desc: "Free play — no score, no pressure" },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 text-2xl font-black text-white">
              <Zap className="h-6 w-6" /> Offline Game
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/90">Difficulty</Label>
              <div className="grid grid-cols-2 gap-2">
                {difficulties.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`rounded-lg border-2 p-2.5 text-left transition-all active:scale-95 ${
                      difficulty === d.value
                        ? "border-white bg-white/20"
                        : "border-white/20 bg-black/10 hover:border-white/40"
                    }`}
                  >
                    <div className="text-sm font-bold text-white">{d.label}</div>
                    <div className="text-[10px] text-white/70">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-white/90">Rounds</Label>
                <Input
                  type="number" min={1} max={15} value={rounds}
                  onChange={(e) => setRounds(e.target.value)}
                  className="h-11 bg-white/10 border-white/30 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/90">Seconds / round</Label>
                <Input
                  type="number" min={20} max={180} value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-11 bg-white/10 border-white/30 text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onNavigate("home")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button className="h-11 flex-[2] font-bold" onClick={start}>
                <Play className="h-4 w-4" /> Start Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
