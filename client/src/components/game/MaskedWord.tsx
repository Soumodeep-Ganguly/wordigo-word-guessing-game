interface MaskedWordProps {
  maskedWord: string; // e.g. "_ _ A _ _ _"
  revealed?: boolean; // full reveal (round end)
  shake?: boolean;
}

export function MaskedWord({ maskedWord, revealed = false, shake = false }: MaskedWordProps) {
  const letters = maskedWord.split(" ");
  return (
    <div className={`flex flex-wrap justify-center gap-1.5 sm:gap-2 ${shake ? "anim-shake" : ""}`}>
      {letters.map((ch, i) => (
        <span
          key={i}
          className={`word-tile ${
            ch === "_" ? "text-muted-foreground/40" : "text-primary anim-pop-in"
          } ${revealed ? "border-primary/60 bg-primary/10" : ""}`}
        >
          {ch === "_" ? "" : ch}
        </span>
      ))}
    </div>
  );
}
