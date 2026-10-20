# ARL-Trans Operations Dashboard

Local operations dashboard for ARL-Trans container/trucking logistics.

## Quick Start

```bash
cd dashboard
cp .env.local.example .env.local   # fill in your keys
npx ts-node scripts/google-auth.ts  # one-time Google OAuth setup
npm install
npm run dev                          # starts dashboard (port 3002) + redact service (port 8000)
```

## Structure

- `dashboard/` — Next.js 16 operations UI
- `redact/` — Python PDF redaction service
- `docs/` — workflow specs

See [CLAUDE.md](./CLAUDE.md) for full project context.
