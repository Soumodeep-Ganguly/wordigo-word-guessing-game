/**
 * Minimal profanity / inappropriate-content filter used to validate
 * player-created challenges (words and hints).
 */
const BANNED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "dick", "cock", "pussy",
  "cunt", "whore", "slut", "nigger", "nigga", "faggot", "retard", "rape",
  "nazi", "hitler", "penis", "vagina", "boob", "porn", "sex",
];

/** Normalize by collapsing leetspeak and repeated characters. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/1|!/g, "i")
    .replace(/3/g, "e")
    .replace(/4|@/g, "a")
    .replace(/5|\$/g, "s")
    .replace(/7/g, "t")
    .replace(/(.)\1{2,}/g, "$1") // collapse "fuuuuck" -> "fuck"
    .replace(/[^a-z]/g, "");
}

export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;
  return BANNED_WORDS.some((bad) => normalized.includes(bad));
}
