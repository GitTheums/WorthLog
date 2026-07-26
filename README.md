<div align="center">

# Worthlog

**Log the value. See the journey.**

A simple self-hosted app for manually logging investment category totals and watching how your portfolio develops over time.

![Self-hosted](https://img.shields.io/badge/self--hosted-yes-2ea44f)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![GHCR](https://img.shields.io/badge/GHCR-ghcr.io%2Fgittheums%2Fworthlog-2496ED?logo=github)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-embedded-003B57?logo=sqlite&logoColor=white)

</div>

<br />

<!-- Maintainer: place the primary dashboard screenshot at docs/screenshots/worthlog-dashboard.png -->
<div align="center">
  <img
    src="docs/screenshots/worthlog-banner.png"
    alt="Worthlog dashboard showing portfolio value, allocation, and history"
    width="900"
  />
</div>

## What is Worthlog?

Worthlog is a self-hosted investment **value logger**. You choose the dates that matter, open a snapshot form, and enter the total value of each investment category. Worthlog stores those totals and turns them into a clear view of portfolio value, category allocation, and historical development.

Nothing is pulled from brokers or market data providers. Values are entered by you, when you decide a snapshot is worth recording. Categories are fully customizable—names, colors, and icons—so the app can match how you actually think about your portfolio.

The application runs locally, typically through Docker Compose, with all data kept in a SQLite database on your machine. There are no accounts and no external financial APIs.

> [!IMPORTANT]
> Worthlog is intended for a **trusted local network** or personal machine. An optional PIN can restrict access through the web UI and API, but it does **not** encrypt the SQLite database. Do not expose Worthlog directly to the public internet. For remote access, use **HTTPS**, a **VPN**, or an authenticated reverse proxy.

## Features

| Area | What you get |
| --- | --- |
| **Snapshots** | Manual dated portfolio snapshots; edit or delete any snapshot |
| **Categories** | Custom categories with colors and Lucide icons; archive (keep history) or permanently delete |
| **Dashboard** | Total value history, category allocation, and per-category cards |
| **Ranges** | Filter charts and history by 1M, 3M, 1Y, or All |
| **Appearance** | Light and dark themes |
| **Settings** | Display currency, default dashboard range, and optional PIN |
| **Backup** | JSON export and import from the UI |
| **Storage** | Local SQLite database; single Docker container with a healthcheck |
| **Access** | No user accounts; optional portfolio PIN lock |

Worthlog is deliberately **not** a live portfolio tracker, broker integration, transaction ledger, or financial advice platform.

## Screenshots

<div align="center">
  <img
    src="docs/screenshots/worthlog-dashboard.png"
    alt="Worthlog dashboard showing portfolio value, allocation, and history"
    width="900"
  />
</div>

<div align="center">
  <img
    src="docs/screenshots/worthlog-dashboard-white.png"
    alt="Worthlog dashboard showing portfolio value, allocation, and history"
    width="900"
  />
</div>

## Quick start

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

The recommended install uses the published image from GitHub Container Registry:

`ghcr.io/gittheums/worthlog`

```bash
mkdir -p worthlog/data
cd worthlog
```

Create `docker-compose.ghcr.yml` (or download it from this repository) with the contents of [`docker-compose.ghcr.yml`](docker-compose.ghcr.yml), then start:

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

| Item | Value |
| --- | --- |
| App URL | <http://localhost:8787> |
| Health URL | <http://localhost:8787/api/health> |
| Host port | `8787` → container port `3000` |
| Image | `ghcr.io/gittheums/worthlog:latest` |
| Data directory | `./data` → `/app/data` |

### Direct `docker run`

```bash
docker run -d \
  --name worthlog \
  -p 8787:3000 \
  -e TZ=Europe/Amsterdam \
  -e DATA_DIR=/app/data \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -v "$(pwd)/data:/app/data" \
  --restart unless-stopped \
  ghcr.io/gittheums/worthlog:latest
```

### Image tags

| Tag | Meaning |
| --- | --- |
| `latest` | Latest stable published release |
| `1.2.3` | Exact version pin |
| `1.2` | Latest patch in the `1.2` series (from version-tag publishes) |

Pin a release in Compose by changing the image line, for example:

```yaml
image: ghcr.io/gittheums/worthlog:1.0.0
```

Portfolio data stays in `./data` on the host. Pulling a new image and recreating the container does **not** remove `worthlog.db`. Back up `./data/worthlog.db` (or use Settings → Backup) before updating.

### Data directory permissions

The container runs as the non-root `node` user (**UID 1000**). On Linux, if Worthlog cannot write to `./data`:

```bash
sudo chown -R 1000:1000 data
```

### Useful commands

```bash
# Check status (wait until healthy)
docker compose -f docker-compose.ghcr.yml ps

# Follow logs
docker compose -f docker-compose.ghcr.yml logs -f worthlog

# Stop (data in ./data is kept)
docker compose -f docker-compose.ghcr.yml down
```

## Installation on a Linux server or Proxmox LXC

Worthlog runs well in a Debian or Ubuntu VM or LXC once Docker and Docker Compose are installed. This section assumes the container host already exists; it does not cover creating a Proxmox LXC from scratch.

```bash
sudo mkdir -p /opt/worthlog/data
cd /opt/worthlog
sudo chown -R 1000:1000 data

# Copy docker-compose.ghcr.yml from the repository into this directory, then:
sudo docker compose -f docker-compose.ghcr.yml up -d
```

Open **TCP 8787** only on your trusted local network (firewall / security group). Then visit:

```text
http://SERVER-IP:8787
```

## First use

1. A new installation seeds a single active category: **Stocks**.
2. Open **Settings → Categories** to add, rename, reorder, archive, or permanently delete categories.
3. Click **Add snapshot** and enter the total value of each active category for a date you choose.
4. Leave a category field empty if you hold nothing there—it is stored as zero.
5. Create further snapshots whenever you want; charts and history update from those manual entries only.

Archive hides a category from future snapshot forms but keeps its historical values. Delete removes the category and its history permanently (with confirmation).

## Persistent storage

| Location | Path |
| --- | --- |
| Host data directory | `./data` (next to `docker-compose.yml`) |
| Container data directory | `/app/data` |
| SQLite database file | `worthlog.db` → host path `./data/worthlog.db` |

Compose bind-mounts `./data` to `/app/data`. Rebuilding or replacing the container does **not** delete portfolio history as long as the host `data` directory remains.

> [!WARNING]
> Deleting or wiping the host `data` directory **does** delete your portfolio history. Do not run destructive cleanup commands against `./data` (for example `rm -rf data`) unless you intend to erase everything.

## Backup and restore

### JSON export / import (recommended for portability)

In the Worthlog UI: **Settings → Backup and restore**.

- **Export** downloads a versioned JSON file (settings, categories, snapshots, and values).
- **Import** replaces current data after the server writes an automatic timestamped SQLite backup in the data directory.

### Direct SQLite file backup

Stop the container first so WAL files are flushed cleanly, copy the database, then start again:

```bash
cd /opt/worthlog   # or your install path
docker compose -f docker-compose.ghcr.yml stop worthlog
cp data/worthlog.db "data/worthlog.db.backup-$(date +%Y%m%d-%H%M%S)"
docker compose -f docker-compose.ghcr.yml start worthlog
```

Keep the backup copy outside the machine if you need off-host recovery.

## Updating Worthlog

Create a database backup first (JSON export or the SQLite copy above), then pull the newer image:

```bash
cd /opt/worthlog   # or your install path
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

Updating the image does not delete `./data` or `worthlog.db`.

Useful follow-up commands:

```bash
docker compose -f docker-compose.ghcr.yml ps
docker compose -f docker-compose.ghcr.yml logs -f --tail=100 worthlog

# Remove unused images only — does not remove ./data
docker image prune -f
```

## Configuration

Application environment variables (see also [`.env.example`](.env.example)):

| Variable | Default | Required | Description |
| --- | --- | --- | --- |
| `PORT` | `3001` (dev) / `3000` (Docker) | No | HTTP listen port inside the process |
| `NODE_ENV` | `development` | No | `development`, `test`, or `production` |
| `DATA_DIR` | `./data` | No | Directory for persistent data; database is `${DATA_DIR}/worthlog.db` |
| `CLIENT_DIST_DIR` | unset | No | Path to the built React app. Docker sets `/app/client/dist` |

Docker Compose also sets `TZ=Europe/Amsterdam` for the container timezone. That value is not read by Worthlog’s own config schema; change it in `docker-compose.ghcr.yml` (or `docker-compose.yml`) if you need a different zone.

### Docker port mapping

| Host | Container | Purpose |
| --- | --- | --- |
| `8787` | `3000` | Browser access to the UI and `/api` |

Change the left-hand side in the Compose file if port 8787 is already in use on the host.

## Healthcheck and monitoring

Worthlog exposes:

```text
GET /api/health
```

Example:

```text
http://SERVER-IP:8787/api/health
```

A healthy response looks like:

```json
{ "status": "ok", "database": "ok", "version": "0.1.0" }
```

The Docker image and Compose file include a healthcheck against this endpoint. You can point an uptime monitor such as [Uptime Kuma](https://github.com/louislam/uptime-kuma) at the same URL. Worthlog does not ship a built-in integration with any monitoring product.

## Build from source (developers)

To build the image locally instead of pulling from GHCR:

```bash
git clone https://github.com/GitTheums/WorthLog.git
cd WorthLog
mkdir -p data
# Linux: sudo chown -R 1000:1000 data
docker compose up -d --build
```

This uses `docker-compose.yml` with `build: .` and the multi-stage `Dockerfile`. The first build may take a few minutes.

## Development

**Requirements:** [Node.js 24](https://nodejs.org/) or newer (see `.nvmrc` and `package.json` `engines`), with the npm version bundled with Node 24.

```bash
git clone https://github.com/GitTheums/WorthLog.git
cd WorthLog
cp .env.example .env
npm install
npm run dev
```

| Process | URL |
| --- | --- |
| Frontend (Vite) | <http://localhost:5173> |
| API (Express) | <http://localhost:3001> |

Vite proxies `/api` to the backend during development.

| Command | Description |
| --- | --- |
| `npm run dev` | Run client and server together |
| `npm run lint` | Lint both workspaces |
| `npm run typecheck` | Type-check both workspaces |
| `npm run test` | Run tests in both workspaces |
| `npm run build` | Production build for server and client |

Workspace-scoped examples:

```bash
npm run dev -w client
npm run dev -w server
npm run test -w server
```

## Project structure

```text
WorthLog/
├── client/                   # React + TypeScript + Vite frontend
├── server/                   # Express + TypeScript API + SQLite
├── data/                     # Persistent SQLite data (created at runtime; gitignored)
├── docs/
│   └── screenshots/          # README screenshots
├── .github/workflows/        # CI — GHCR publish workflow
├── Dockerfile                # Multi-stage production image
├── docker-compose.yml        # Local source-build deployment
├── docker-compose.ghcr.yml   # Production example using GHCR image
├── .env.example              # Documented environment variables
└── package.json              # npm workspaces root
```

## Publishing container images (maintainers)

Pushes of tags matching `v*.*.*` (for example `v1.0.0`) build `linux/amd64` and `linux/arm64` images and publish them to `ghcr.io/gittheums/worthlog` via [`.github/workflows/publish-container.yml`](.github/workflows/publish-container.yml).

```bash
git tag v1.0.0
git push origin v1.0.0
```

That publishes tags such as `1.0.0`, `1.0`, and `latest`. Manual runs from `main` can refresh `latest` (and a `sha-…` tag) without creating a release tag.

After the first package appears under the GitHub account/org, open **Packages → worthlog → Package settings** and set visibility to **Public** if you want anonymous pulls.

## Optional PIN Protection

Worthlog can require a numeric PIN (4–8 digits) before portfolio data is available through the web UI and API.

- **Optional and off by default.** Enable it in **Settings → Security**. Existing installations without a PIN keep working unchanged.
- **Manual lock.** When a PIN is enabled, use **Lock WorthLog** in the header or **Lock now** in Settings. Refreshing an unlocked browser tab keeps the session for up to 12 hours.
- **Not encryption.** The PIN restricts access through Worthlog’s HTTP API and UI. It does **not** encrypt `worthlog.db`. Anyone with filesystem or container volume access can still read the database.
- **Network security still matters.** Plain HTTP does not protect the PIN from interception on untrusted networks. Prefer HTTPS, a VPN, or an authenticated reverse proxy for remote access. Do not expose Worthlog directly to the public internet.
- **Backups.** Normal JSON portfolio exports exclude PIN hash and salt, and restoring a JSON backup does not replace or remove your current PIN. Direct SQLite file backups include the configured PIN hash.

This is a single-portfolio local convenience lock, not a multi-user account system or internet-grade authentication.

## Security

- Prefer a **trusted local network** or personal machine.
- Use the optional PIN to reduce casual access; it is **not** a substitute for HTTPS, a VPN, or host filesystem permissions.
- The database can contain **private financial information**.
- Do **not** expose the app directly to the public internet.
- For remote access, use **HTTPS**, a **VPN**, or an **authenticated reverse proxy**.

## Data and financial disclaimer

Worthlog only displays information you enter manually. It does not retrieve or verify market prices, connect to brokers, or provide financial advice. Charts and totals are derived solely from your snapshots.

## Troubleshooting

### Container will not start

```bash
docker compose -f docker-compose.ghcr.yml ps
docker compose -f docker-compose.ghcr.yml logs worthlog
```

Confirm Docker is running and the image is available (`docker compose -f docker-compose.ghcr.yml pull`). For source builds, use `docker compose up -d --build`.

### Permission denied on the data directory (Linux)

```bash
mkdir -p data
sudo chown -R 1000:1000 data
docker compose -f docker-compose.ghcr.yml up -d
```

### Port 8787 already in use

Change the host port in `docker-compose.ghcr.yml` (or `docker-compose.yml`), for example `"8788:3000"`, then bring the stack up again.

### Health endpoint unavailable

```bash
curl -sS http://localhost:8787/api/health
docker compose -f docker-compose.ghcr.yml ps
docker compose -f docker-compose.ghcr.yml logs --tail=100 worthlog
```

Wait for the health status to become `healthy` after the first start (`start_period` is 15 seconds).

### View logs

```bash
docker compose -f docker-compose.ghcr.yml logs -f worthlog
```

### Rebuild after an update (source build)

```bash
git pull
docker compose up -d --build
```

## Roadmap

Ideas under consideration (not commitments, not available today):

- CSV export
- Portfolio annotations / notes on the timeline
- Additional chart controls
- Optional local access protection

## Contributing

There is no separate contributing guide yet. Bug reports and thoughtful feature ideas are welcome via [GitHub Issues](https://github.com/GitTheums/WorthLog/issues). For larger changes, please open an issue first so the approach can be discussed before you invest time in a pull request.

## License

A license file has not been added to this repository yet. Licensing terms are not specified; do not assume the project is open source or freely redistributable until a `LICENSE` file is published.
