# Wordigo — client

React 19 + Vite + Tailwind 4 frontend. See the root README for full setup.

```bash
npm install
npm run dev      # dev server on http://localhost:5173
npm run build    # production build (tsc + vite)
npm run preview  # serve the production build
```

Offline mode requires no server. Multiplayer expects the game server running
at the URL configured in `VITE_SOCKET_URL`.

## Deployment Instruction

`firebase deploy --only hosting:wordigo`
