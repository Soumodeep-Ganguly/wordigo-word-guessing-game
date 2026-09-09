import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { playTick } from "@/lib/sounds";

interface CountdownTimerProps {
  endsAt: number | null;
  onExpired?: () => void;
}

export function CountdownTimer({ endsAt, onExpired }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(0);
      return;
    }
    const update = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0 && left <= 5) playTick();
      if (left === 0) onExpired?.();
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [endsAt, onExpired]);

  const urgent = remaining <= 10 && remaining > 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-sm font-bold sm:text-base ${
        urgent
          ? "bg-destructive/15 text-destructive anim-glow"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      <Timer className={`h-4 w-4 ${urgent ? "animate-pulse" : ""}`} />
      {remaining}s
    </div>
  );
}
