import { Crown, WifiOff } from "lucide-react";
import { PublicPlayer } from "@/types/game";

interface PlayerListProps {
  players: PublicPlayer[];
  highlightId?: string; // e.g. current Word Master
  compact?: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function PlayerList({ players, highlightId, compact = false }: PlayerListProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full space-y-1.5">
      {sorted.map((p, idx) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all ${
            p.id === highlightId
              ? "bg-primary/15 ring-1 ring-primary/40"
              : "bg-secondary/60"
          } ${!p.connected ? "opacity-50" : ""}`}
        >
          {!compact && sorted[idx - 1]?.score === p.score ? null : null}
          <span className="w-5 text-center text-sm">
            {p.connected ? "" : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </span>
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="truncate font-semibold">
            {p.name}
            {p.isHost && <Crown className="ml-1 inline h-3.5 w-3.5 text-yellow-500" />}
            {p.id === highlightId && (
              <span className="ml-1.5 text-xs font-bold text-primary">✏️ Word Master</span>
            )}
          </span>
          <span className="ml-auto font-mono text-sm font-bold">{p.score}</span>
        </div>
      ))}
    </div>
  );
}

export function PodiumList({ players }: { players: PublicPlayer[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="w-full space-y-1.5">
      {sorted.map((p, idx) => (
        <div
          key={p.id}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            idx === 0 ? "bg-yellow-500/15 ring-1 ring-yellow-500/40" : "bg-secondary/60"
          }`}
        >
          <span className="w-6 text-center">{MEDALS[idx] ?? `${idx + 1}.`}</span>
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="truncate font-bold">{p.name}</span>
          <span className="ml-auto font-mono font-bold">{p.score} pts</span>
        </div>
      ))}
    </div>
  );
}
