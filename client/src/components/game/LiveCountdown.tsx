import { useEffect, useState } from "react";

interface LiveCountdownProps {
  endsAt: number | null;
}

/**
 * Live 3... 2... 1... countdown derived from the server's phase deadline.
 * Re-renders every 100ms and re-triggers the pop-in animation on each tick.
 */
export function LiveCountdown({ endsAt }: LiveCountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!endsAt) {
      setRemaining(null);
      return;
    }
    const update = () => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [endsAt]);

  return (
    <div
      key={remaining}
      className="text-4xl font-black anim-pop-in"
      aria-live="polite"
    >
      {remaining === null ? "3..." : remaining > 0 ? `${remaining}...` : "GO!"}
    </div>
  );
}
