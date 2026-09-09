import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { socket } from "@/lib/socket";
import { GameMode, RoomSettings } from "@/types/game";
import { AppView } from "./HomeView";

interface CreateRoomViewProps {
  onNavigate: (view: AppView) => void;
  playerName: string;
  setPlayerName: (n: string) => void;
}

export function CreateRoomView({ onNavigate, playerName, setPlayerName }: CreateRoomViewProps) {
  const [mode, setMode] = useState<GameMode>("classic");
  const [rounds, setRounds] = useState("5");
  const [duration, setDuration] = useState("60");
  const [maxPlayers, setMaxPlayers] = useState("4");
  const [submitting, setSubmitting] = useState(false);

  const create = () => {
    const name = playerName.trim();
    if (!name) return;
    setSubmitting(true);
    const settings: Partial<RoomSettings> = {
      mode,
      rounds: Math.max(1, Math.min(15, parseInt(rounds) || 5)),
      roundDurationSec: Math.max(20, Math.min(180, parseInt(duration) || 60)),
      maxPlayers: Math.max(2, Math.min(8, parseInt(maxPlayers) || 4)),
    };
    socket.emit("create-room", { playerName: name, settings });
  };

  // One-shot listeners wired in App via socket events; here we just emit.

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 text-2xl font-black text-white">
              <Plus className="h-6 w-6" /> Create Room
            </CardTitle>
            <p className="text-xs text-white/70">Wordigo · configure your room</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/90">Your name</Label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={20}
                className="h-11 bg-white/10 border-white/30 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/90">Game mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as GameMode)}>
                <SelectTrigger className="h-11 w-full bg-white/10 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">🌐 Classic Guessing</SelectItem>
                  <SelectItem value="player-words">👤 Your Word, Our Guess</SelectItem>
                  <SelectItem value="mixed">🎲 Mixed Mode</SelectItem>
                </SelectContent>
              </Select>
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

            <div className="space-y-1.5">
              <Label className="text-white/90">Max players</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(String(n))}
                    className={`h-10 rounded-lg border-2 text-sm font-bold transition-all active:scale-95 ${
                      maxPlayers === String(n)
                        ? "border-white bg-white/25 text-white"
                        : "border-white/25 text-white/75 hover:border-white/50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onNavigate("multiplayer")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                className="h-11 flex-[2] font-bold"
                disabled={!playerName.trim() || submitting}
                onClick={create}
              >
                CREATE ROOM
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
