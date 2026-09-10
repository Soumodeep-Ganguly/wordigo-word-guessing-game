import { Info } from "lucide-react";

interface StartingLettersPickerProps {
  word: string; // sanitized A-Z only
  selected: number[]; // positions currently chosen for reveal
  onChange: (positions: number[]) => void;
}

/**
 * Max starting letters the Word Master may reveal — matches the server rule:
 * up to 3, so long as at least 2 letters always stay hidden.
 */
export function maxRevealablePositions(wordLength: number): number {
  return Math.max(0, Math.min(3, wordLength - 2));
}

/**
 * Letter-tile picker for the Word Master: tap letters to choose which ones
 * are visible to guessers when the round starts. Leave empty to let the
 * system pick based on difficulty.
 */
export function StartingLettersPicker({ word, selected, onChange }: StartingLettersPickerProps) {
  const max = maxRevealablePositions(word.length);
  const selectedSet = new Set(selected);

  const toggle = (pos: number) => {
    if (selectedSet.has(pos)) {
      onChange(selected.filter((p) => p !== pos));
    } else if (selected.length < max) {
      onChange([...selected, pos].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-1.5 rounded-xl border border-white/20 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/90">Starting letters</span>
        <span className="text-xs text-white/60">
          {selected.length}/{max} revealed
        </span>
      </div>
      <p className="flex items-start gap-1 text-xs text-white/60">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Tap letters guessers will see at the start. Leave empty for an automatic
        pick — at least 2 letters always stay hidden.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {word.split("").map((ch, i) => {
          const isOn = selectedSet.has(i);
          const disabled = !isOn && selected.length >= max;
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              disabled={disabled}
              className={`word-tile transition-all active:scale-95 ${
                isOn
                  ? "border-primary/70 bg-primary/20 text-primary"
                  : disabled
                    ? "border-white/10 text-white/25"
                    : "border-white/30 text-white/80 hover:border-white/60"
              }`}
              aria-pressed={isOn}
              aria-label={`Letter ${ch} at position ${i + 1}`}
            >
              {ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}
