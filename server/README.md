# Wordigo — server

Express 5 + Socket.IO authoritative game server. See the root README for full setup.

```bash
npm install
npm run dev      # nodemon + ts-node on http://localhost:8081
npm run build    # tsc → dist/
npm start        # node dist/server.js
npm test         # vitest unit + integration tests
```

No database needed — rooms are held in memory with TTL cleanup.
