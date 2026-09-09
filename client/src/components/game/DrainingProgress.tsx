import { useEffect, useState } from "react";

interface DrainingProgressProps {
  endsAt: number | null;
  className?: string;
}

/**
 * Progress bar that drains 100% → 0% until the given deadline.
 * Used while a Word Master composes a challenge: when it hits 0% the
 * server auto-picks a system word.
 */
export function DrainingProgress({ endsAt, className }: DrainingProgressProps) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (!endsAt) {
      setPct(100);
      return;
    }
    // Duration is captured from the first tick after mount so the bar
    // always spans 100% → 0% of the actual composing window.
    let duration = 0;
    const tick = () => {
      const now = Date.now();
      if (duration === 0 && endsAt > now) duration = endsAt - now;
      const left = Math.max(0, endsAt - now);
      setPct(duration > 0 ? Math.round((left / duration) * 100) : 0);
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div
      className={
        className ?? "mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/20"
      }
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-white/60 transition-[width] duration-100 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
