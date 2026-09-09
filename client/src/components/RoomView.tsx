import { Copy, Play, Share2, Users, Wifi, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerList } from "@/components/game/PlayerList";
import { socket } from "@/lib/socket";
import { PublicRoomState } from "@/types/game";
import { AppView } from "./HomeView";

interface RoomViewProps {
  state: PublicRoomState;
  myId: string;
  onNavigate: (view: AppView) => void;
}

const MODE_LABEL: Record<string, string> = {
  classic: "🌐 Classic Guessing",
  "player-words": "👤 Your Word, Our Guess",
  mixed: "🎲 Mixed Mode",
};

export function RoomView({ state, myId, onNavigate }: RoomViewProps) {
  const isHost = state.hostId === myId;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(state.roomId);
      toast.success("Room code copied!");
    } catch {
      toast.error("Could not copy. Code: " + state.roomId);
    }
  };

  const share = async () => {
    const text = `Join my Wordigo game! Room code: ${state.roomId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Wordigo", text });
        return;
      } catch {
        // user cancelled
      }
    }
    copyCode();
  };

  const start = () => socket.emit("start-game", { roomId: state.roomId });
  const leave = () => {
    socket.emit("leave-room", { roomId: state.roomId });
    onNavigate("home");
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center space-y-2">
            <CardTitle className="text-2xl font-black text-white">ROOM CODE</CardTitle>
            <button
              onClick={copyCode}
              className="rounded-xl bg-white/15 px-8 py-3 font-mono text-4xl font-black tracking-[0.25em] text-white transition-all hover:bg-white/25 active:scale-95"
              title="Click to copy"
            >
              {state.roomId}
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={copyCode}>
                <Copy className="mr-1 h-4 w-4" /> Copy
              </Button>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={share}>
                <Share2 className="mr-1 h-4 w-4" /> Share
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="rounded-xl bg-white/10 p-3 text-center text-sm text-white/90">
              {MODE_LABEL[state.settings.mode]} · {state.settings.rounds} rounds ·{" "}
              {state.settings.roundDurationSec}s per round
            </div>

            <div className="flex items-center justify-between text-sm font-bold text-white/90">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Players
              </span>
              <span className="font-mono">
                {state.players.length} / {state.settings.maxPlayers}
              </span>
            </div>
            <div className="rounded-xl bg-black/20 p-2.5">
              <PlayerList players={state.players} />
            </div>

            {isHost ? (
              <Button
                className="h-12 w-full text-base font-bold"
                disabled={state.players.length < 2}
                onClick={start}
              >
                <Play className="h-5 w-5" />
                {state.players.length < 2
                  ? "Waiting for players (min 2)..."
                  : "START GAME"}
              </Button>
            ) : (
              <div className="rounded-xl bg-white/10 p-3 text-center text-sm text-white/85">
                <Wifi className="mr-1 inline h-4 w-4 animate-pulse" />
                Waiting for the host to start...
              </div>
            )}

            <Button variant="outline" className="h-10 w-full" onClick={leave}>
              <ArrowLeft className="h-4 w-4" /> Leave Room
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
