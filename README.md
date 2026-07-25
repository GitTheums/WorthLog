# WorthLog

WorthLog is a small self-hosted web application for manually recording the total EUR value of investment categories on selected dates.

It does **not** track individual assets, transactions, or live market prices. There is no authentication — it is intended for a single local user.

## Requirements

- [Node.js 24 LTS](https://nodejs.org/) or newer
- npm 11+ (bundled with Node.js 24)
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose (for container deployment)

## Project structure

```
WorthLog/
├── client/              # React + TypeScript + Vite frontend
├── server/              # Express + TypeScript API
├── Dockerfile           # Multi-stage production image
├── docker-compose.yml   # Single-container deployment
├── .env.example         # Documented environment variables
└── package.json         # npm workspaces root
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
| `PORT` | `3001` | HTTP port (Docker uses `3000`) |
| `NODE_ENV` | `development` | Runtime environment |
| `DATA_DIR` | `./data` | Persistent data directory; database file is `${DATA_DIR}/worthlog.db` |
| `CLIENT_DIST_DIR` | _(unset)_ | Optional path to the built frontend. In production Docker this is `/app/client/dist`. |

## Docker deployment

WorthLog runs as a **single container**: Express serves the API under `/api` and the built React app (with SPA fallback that never intercepts `/api`).

### Data directory permissions

The process runs as the non-root `node` user (**UID 1000**). The host bind mount must be writable by that user:

```bash
mkdir -p data
sudo chown -R 1000:1000 data
```

On Docker Desktop for Windows/macOS, creating `./data` is usually enough; on Linux, the `chown` step is required if the directory was created as root.

### Start

```bash
docker compose up -d --build
```

- App: http://localhost:8787  
- Health: http://localhost:8787/api/health  
- Data: `./data` → `/app/data` (SQLite only; no separate database service)

Compose sets `TZ=Europe/Amsterdam`, `NODE_ENV=production`, `PORT=3000`, and `DATA_DIR=/app/data`, with `restart: unless-stopped` and a healthcheck against `/api/health`.

### Useful commands

```bash
docker compose ps
docker compose logs -f worthlog
docker compose restart worthlog
docker compose down
```

### Verification checklist (e.g. Proxmox / Linux host)

```bash
mkdir -p data && sudo chown -R 1000:1000 data
docker compose up -d --build

# Wait until healthy (status should become "healthy")
until docker inspect --format='{{.State.Health.Status}}' worthlog | grep -q healthy; do
  sleep 2
done

curl -sS http://localhost:8787/api/health
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8787/   # expect 200
curl -sS http://localhost:8787/ | head -n 5                         # expect HTML

# Temporary snapshot via API (all active categories set to 0 cents)
VALUES=$(curl -sS http://localhost:8787/api/categories \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const cats=JSON.parse(s).data;process.stdout.write(JSON.stringify(cats.map(c=>({categoryId:c.id,amountCents:0}))))})")
curl -sS -X PUT "http://localhost:8787/api/snapshots/2099-01-01" \
  -H 'Content-Type: application/json' \
  -d "{\"note\":\"docker-persist-test\",\"values\":$VALUES}"

docker compose restart worthlog
until docker inspect --format='{{.State.Health.Status}}' worthlog | grep -q healthy; do
  sleep 2
done

curl -sS "http://localhost:8787/api/snapshots/2099-01-01"   # must still return the snapshot
curl -sS -X DELETE "http://localhost:8787/api/snapshots/2099-01-01"
```

## Health check

`GET /api/health` runs a small database query and returns application `status`, `database` state, and `version`.

## License

Private / local use.
