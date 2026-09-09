interface ScoreBadgeProps {
  show: boolean;
  points: number;
}

/** Floating "+150" style indicator; render inside a relative container. */
export function ScoreBadge({ show, points }: ScoreBadgeProps) {
  if (!show) return null;
  const positive = points >= 0;
  return (
    <span
      className={`anim-float-up pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-lg font-extrabold shadow-lg ${
        positive ? "bg-green-500 text-white" : "bg-destructive text-white"
      }`}
    >
      {positive ? `+${points}` : points}
    </span>
  );
}
