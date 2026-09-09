import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GuessInputProps {
  onSubmit: (guess: string) => void;
  disabled?: boolean;
  placeholder?: string;
  cooldownMs?: number;
}

export function GuessInput({ onSubmit, disabled = false, placeholder = "Type your guess...", cooldownMs = 900 }: GuessInputProps) {
  const [value, setValue] = useState("");
  const [cooling, setCooling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  const submit = () => {
    const guess = value.trim();
    if (!guess || disabled || cooling) return;
    onSubmit(guess);
    setValue("");
    setCooling(true);
    setTimeout(() => setCooling(false), cooldownMs);
  };

  return (
    <div className="flex w-full gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder={placeholder}
        disabled={disabled || cooling}
        maxLength={30}
        autoComplete="off"
        autoCapitalize="characters"
        className="h-11 flex-1 bg-card text-base uppercase"
      />
      <Button onClick={submit} disabled={disabled || cooling || !value.trim()} className="h-11 px-5">
        <Send className="h-4 w-4" />
        GUESS
      </Button>
    </div>
  );
}
