// Quick manual smoke test: node tests/smoke.mjs [port]
import { io } from "socket.io-client";

const port = process.argv[2] || "8081";
const url = `http://localhost:${port}`;

const c1 = io(url, { transports: ["websocket"] });
const c2 = io(url, { transports: ["websocket"] });

const once = (sock, ev) =>
  new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error("timeout: " + ev)), 8000);
    sock.once(ev, (p) => { clearTimeout(t); res(p); });
  });

try {
  // Classic mode: round 1 is a system word → guessing starts after the countdown.
  c1.emit("create-room", { playerName: "Hosty", settings: { rounds: 2, mode: "classic", maxPlayers: 4 } });
  const { state } = await once(c1, "room-created");
  console.log("✓ room created:", state.roomId, "mode:", state.settings.mode);

  c2.emit("join-room", { roomId: state.roomId, playerName: "Guest" });
  await once(c2, "room-joined");
  console.log("✓ guest joined, players:", state.players.length + 1);

  c1.emit("start-game", { roomId: state.roomId });
  await once(c2, "game-started");
  console.log("✓ game started");

  const g = await once(c1, "guessing-started");
  const challenge = g.state.round.challenge;
  console.log("✓ round 1 guessing started — category:", challenge.category, "masked:", challenge.maskedWord);
  if (!challenge.maskedWord.includes("_")) throw new Error("mask missing");

  // Player-words mode: round 1 waits for the Word Master to create a challenge.
  c1.emit("create-room", { playerName: "WM", settings: { rounds: 1, mode: "player-words" } });
  const p = await once(c1, "room-created");
  c2.emit("join-room", { roomId: p.state.roomId, playerName: "G2" });
  await once(c2, "room-joined");
  const turnP = once(c1, "your-turn-to-create");
  c1.emit("start-game", { roomId: p.state.roomId });
  await once(c2, "game-started");
  await turnP;
  console.log("✓ player-words: word master prompted to create a challenge");

  c1.disconnect();
  c2.disconnect();
  console.log("SMOKE OK");
  process.exit(0);
} catch (e) {
  console.error("SMOKE FAILED:", e.message);
  process.exit(1);
}
