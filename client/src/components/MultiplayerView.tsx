import { ArrowLeft, Dices, Globe, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppView } from "./HomeView";

interface MultiplayerViewProps {
  onNavigate: (view: AppView) => void;
}

const MODES = [
  {
    icon: Globe,
    title: "🌐 Classic Guessing",
    desc: "Everyone guesses system-generated words.",
    },
  {
    icon: UserRound,
    title: "👤 Your Word, Our Guess",
    desc: "Players take turns creating their own words and hints.",
  },
  {
    icon: Dices,
    title: "🎲 Mixed Mode",
    desc: "Automatically alternates between system and player challenges.",
  },
];

export function MultiplayerView({ onNavigate }: MultiplayerViewProps) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center">
            <CardTitle className="text-2xl font-black text-white">MULTIPLAYER</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MODES.map(({ icon: Icon, title, desc }) => (
              <button
                key={title}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-white/25 bg-white/10 p-3.5 text-left transition-all hover:border-white/50 hover:bg-white/20 active:scale-[0.98]"
                onClick={() => onNavigate("create-room")}
              >
                <Icon className="h-7 w-7 shrink-0 text-white" />
                <span>
                  <span className="block font-bold text-white">{title}</span>
                  <span className="block text-xs text-white/75">{desc}</span>
                </span>
              </button>
            ))}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onNavigate("home")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button className="h-11 flex-1 font-bold" onClick={() => onNavigate("join-room")}>
                Join with Code
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
