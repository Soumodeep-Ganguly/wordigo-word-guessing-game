# Wordigo — Word Gaming Game

A polished word guessing game with **Offline Single-Player** and **Real-time Online Multiplayer** modes. Guess the hidden word from clues and partially revealed letters — solo with hints and streaks, or head-to-head in rooms of 2–8 players.

## Game Overview

A secret word is chosen (by the server or by a fellow player acting as **Word Master**). Everyone sees the category, hint(s) and a masked version of the word (`_ _ A _ _ _`). Type guesses before the timer runs out — faster correct guesses earn more points. When the round ends the word is revealed and scores update live.

### Game Modes

| Mode | Description |
|------|-------------|
| **Offline Single-Player** | Play instantly with no server or internet. 3 difficulties + practice, hints, streaks, local stats persistence. |
| **Online Multiplayer — Classic** | Everyone races to guess server-generated words. Host controls start. |
| **Online Multiplayer — Your Word, Our Guess** | Players take turns creating secret words + hints for everyone else. |
| **Online Multiplayer — Mixed** | Alternates system rounds and player-created challenges. |

### Multiplayer Features

- 2–8 players per room with **host-selected room capacity**
- 6-character room codes, live player list, host controls
- Real-time sync via Socket.IO with an **authoritative server** (clients never see the secret word before reveal and cannot compute scores)
- Lobby mode selection (Classic / Player Words / Mixed), host-configurable rounds, timer, hints and scoring
- Word Master turn management: submission deadline, auto-skip on timeout/disconnect, no repeat Word Masters before everyone has gone
- Server-side validation: guess rate-limiting, duplicate-submission guard, hint safety checks, profanity filter
- Live leaderboard, countdowns, round/game end events, rematch, reconnect support, abandoned-room cleanup

### Offline Features

- Difficulty-based word selection from a local 400+ word database (8 categories, each with a hint)
- Optional hints (−25 pts), score/combo system, win streaks, best score
- Statistics (games played/won, correct/wrong guesses, best score, longest streak) persisted in `localStorage`
- Practice / free-play mode with no scoring pressure
- Fully playable with the network disconnected — no login required

## Tech Stack

### Client

| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite | Build tool and dev server |
| Tailwind CSS 4 | Styling |
| Socket.io Client | Real-time communication |
| Shadcn/UI | UI components |
| Lucide React | Icons |
| Sonner | Toast notifications |

### Server

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express 5 | HTTP server |
| Socket.io | WebSocket server |
| TypeScript | Type safety |
| Vitest + Socket.io Client | Unit & integration tests |

No database is required — rooms live in an in-memory store with TTL-based cleanup, keeping deployment simple (see *Deployment* below).

## Project Structure

```
wordigo-word-gaming-game/
├── client/                  # React + Vite frontend
│   ├── public/
│   └── src/
│       ├── components/      # UI views and components
│       │   ├── ui/          # Shadcn primitives (button, card, input…)
│       │   └── game/        # Shared gameplay widgets (masked word, timer…)
│       ├── lib/             # socket, offline storage, sounds, theme, word DB
│       └── types/           # Shared client types
├── server/                  # Express + Socket.IO backend
│   └── src/
│       ├── config/          # Environment config
│       ├── data/            # Word database + profanity list
│       ├── game/            # Game engine (authoritative logic)
│       ├── rooms/           # Room manager + timers
│       ├── routes/          # Health/status endpoints
│       ├── sockets/         # Socket.IO event handlers
│       └── types/           # Shared server types
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+

### Installation

```bash
cd wordigo-word-gaming-game

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### Development

```bash
# Start server (from server directory)
npm run dev

# Start client (from client directory, in a separate terminal)
npm run dev
```

The client will be available at `http://localhost:5173` and the server at `http://localhost:8081`.

### Environment Variables

**Server (`server/.env`)**

```
PORT=8081
CORS_ORIGIN=http://localhost:5173
ROOM_CLEANUP_INTERVAL_MS=60000
ROOM_EMPTY_TTL_MS=600000
LOBBY_TTL_MS=1800000
```

All optional — sensible defaults are used when unset.

**Client (`client/.env.development`)**

```
VITE_SOCKET_URL=http://localhost:8081
```

### Testing

```bash
# From the server directory
npm test              # run unit + integration tests once
npm run test:watch    # watch mode
```

The suite covers scoring math, word-database integrity, room lifecycle, the offline engine, and a full multiplayer flow over real sockets (create → join → start → guess → round end → game end).

## Running Completely Offline

1. Build the client once: `cd client && npm run build && npm run preview` (or open any static host of `client/dist`).
2. Choose **Play Offline** on the main screen. No server, no login, no network calls are made.
3. All offline features (words, hints, stats, sounds) are bundled in the app. Turning off Wi-Fi mid-session will not interrupt an offline game — only online multiplayer will show as unavailable until connectivity returns.

## Deployment

### Multiplayer server

```bash
cd server
npm run build
PORT=8081 node dist/server.js
```

Deploy `server/dist` anywhere Node 18+ runs (Render, Railway, Fly.io, a VPS…). Behind a reverse proxy, allow WebSocket upgrades for `/socket.io`. Set `CORS_ORIGIN` to your client's origin in production.

### Static client

```bash
cd client
npm run build
```

Deploy `client/dist` to any static host (Vercel, Netlify, Firebase Hosting, GitHub Pages…) and set the `VITE_SOCKET_URL` build-time env var to your server's public URL, then rebuild.

## How to Play

### Offline

1. **Play Offline** → pick a difficulty (or Practice mode).
2. Guess letters of the hidden word by typing full-word guesses; the mask `_ _ A _ _ _` updates as correct letters land.
3. Stuck? Spend −25 points for a hint. Correct answers chain into combo bonuses.

### Online

1. **Multiplayer** → **Create Room** (choose mode, rounds, timer, **max players**) or **Join Room** with a 6-character code.
2. The host starts the game when everyone is in.
3. **Classic**: type guesses against the clock — quicker guesses score more.
4. **Your Word, Our Guess / Mixed**: on your Word Master turn, submit a secret word, category, difficulty and up to two hints before the deadline; everyone else races to solve it. Challenge quality is scored 0–100 for the Word Master.
5. After the final round, see the podium, special awards (Best Guess, Best Word Master, Fastest Guess) and hit **Play Again** for a rematch.

## License

ISC
