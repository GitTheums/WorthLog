# WorthLog

WorthLog is a small self-hosted web application for manually recording the total EUR value of investment categories on selected dates.

It does **not** track individual assets, transactions, or live market prices. There is no authentication — it is intended for a single local user.

## Requirements

- [Node.js 24 LTS](https://nodejs.org/) or newer
- npm 11+ (bundled with Node.js 24)

## Project structure

```
WorthLog/
├── client/          # React + TypeScript + Vite frontend
├── server/          # Express + TypeScript API
├── .env.example     # Documented environment variables
└── package.json     # npm workspaces root
```

## Setup

```bash
cp .env.example .env
npm install
```

## Development

Start the frontend (port `5173`) and backend (port `3001`) together:

```bash
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001  
- Vite proxies `/api` requests to the backend during development.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run client and server in development mode |
| `npm run build` | Production build for server and client |
| `npm run lint` | Lint both workspaces |
| `npm run typecheck` | Type-check both workspaces |
| `npm run test` | Run tests in both workspaces |

Workspace-scoped variants:

```bash
npm run dev -w client
npm run dev -w server
npm run test -w server
```

## Environment variables

See [`.env.example`](.env.example).

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Backend HTTP port |
| `NODE_ENV` | `development` | Runtime environment |
| `DATABASE_PATH` | `./data/worthlog.db` | SQLite database file path |

## Health check

`GET /api/health` returns application status, a database state placeholder, and the application version.

## License

Private / local use.
