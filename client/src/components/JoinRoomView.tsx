import { useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { socket } from "@/lib/socket";
import { AppView } from "./HomeView";

interface JoinRoomViewProps {
  onNavigate: (view: AppView) => void;
  playerName: string;
  setPlayerName: (n: string) => void;
  roomCode: string;
  setRoomCode: (c: string) => void;
}

export function JoinRoomView({ onNavigate, playerName, setPlayerName, roomCode, setRoomCode }: JoinRoomViewProps) {
  const [joining, setJoining] = useState(false);

  const join = () => {
    if (!playerName.trim() || roomCode.trim().length !== 6) return;
    setJoining(true);
    socket.emit("join-room", {
      roomId: roomCode.trim().toUpperCase(),
      playerName: playerName.trim(),
    });
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-indigo-600 via-purple-600 to-fuchsia-600 dark:from-indigo-950 dark:via-purple-950 dark:to-fuchsia-950">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center p-4">
        <Card className="border-white/30 shadow-2xl">
          <CardHeader className="items-center">
            <CardTitle className="flex items-center gap-2 text-2xl font-black text-white">
              <LogIn className="h-6 w-6" /> Join Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/90">Your name</Label>
              <Input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Sam"
                maxLength={20}
                className="h-11 bg-white/10 border-white/30 text-white"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/90">Room code</Label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                className="h-14 bg-white/10 border-white/30 text-center font-mono text-2xl font-black tracking-[0.3em] text-white"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-11 flex-1" onClick={() => onNavigate("multiplayer")}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                className="h-11 flex-[2] font-bold"
                disabled={!playerName.trim() || roomCode.length !== 6 || joining}
                onClick={join}
              >
                JOIN ROOM
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
