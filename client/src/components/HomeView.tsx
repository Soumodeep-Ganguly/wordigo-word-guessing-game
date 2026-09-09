import { useEffect, useState } from "react";
import { Gamepad2, Globe, Settings, Trophy, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { socket } from "@/lib/socket";
import { loadOfflineStats } from "@/lib/offline-game";

export type AppView =
  | "home"
  | "offline-setup"
  | "offline-game"
  | "multiplayer"
  | "create-room"
  | "join-room"
  | "room"
  | "game"
  | "statistics"
  | "settings";

interface HomeViewProps {
  onNavigate: (view: AppView) => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const [online, setOnline] = useState(navigator.onLine && socket.connected);
  const stats = loadOfflineStats();

  useEffect(() => {
    const update = () => setOnline(navigator.onLine && socket.connected);
    socket.on("connect", update);
    socket.on("disconnect", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      socket.off("connect", update);
      socket.off("disconnect", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center p-4">
        <div className="mb-6 text-center anim-slide-down">
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-lg sm:text-6xl">
            WORDIGO
          </h1>
          <p className="mt-1 text-sm font-medium text-white/80">
            Guess the word. Beat the clock. Beat your friends.
          </p>
        </div>

        <Card className="w-full border-white/30 shadow-2xl anim-bounce-in">
          <CardContent className="space-y-2.5 p-4">
            <Button
              className="h-12 w-full text-base font-bold"
              onClick={() => onNavigate("offline-setup")}
            >
              <Gamepad2 className="h-5 w-5" />
              Play Offline
            </Button>

            <Button
              className="h-12 w-full bg-cyan-600 text-base font-bold text-white hover:bg-cyan-700"
              onClick={() => onNavigate("multiplayer")}
            >
              <Globe className="h-5 w-5" />
              Multiplayer
              {!online && <WifiOff className="ml-auto h-4 w-4 opacity-70" />}
            </Button>
            {!online && (
              <p className="text-center text-xs text-muted-foreground">
                Offline — multiplayer unavailable until you reconnect
              </p>
            )}

            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="h-11 flex-1 font-bold"
                onClick={() => onNavigate("statistics")}
              >
                <Trophy className="h-4 w-4" />
                Statistics
              </Button>
              <Button
                variant="outline"
                className="h-11 flex-1 font-bold"
                onClick={() => onNavigate("settings")}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </div>

            <div className="rounded-lg bg-secondary/70 p-3 text-center text-xs text-muted-foreground">
              <Wifi className="mr-1 inline h-3 w-3" />
              Best score: <b>{stats.bestScore}</b> · Streak: <b>{stats.longestStreak}</b> ·
              Games: <b>{stats.gamesPlayed}</b>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
