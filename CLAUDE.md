# ARL-Trans — Claude Session Context

This file gives any new Claude session everything it needs to pick up and continue work without re-explaining the project.

---

## What This Is

ARL-Trans is a container/trucking logistics operations tool. It automates the intake, redaction, and dispatch of delivery orders (DOs) and keeps Google Sheets up to date.

The project is a **local Windows application** — it runs on one machine, not deployed to a server.

---

## Repo Structure

```
arl-trans/
├── dashboard/      Next.js 16 + TypeScript — the operations dashboard
├── redact/         Python FastAPI + PyMuPDF — PDF rendering and redaction
├── docs/           Workflow specs and meeting notes
├── CLAUDE.md       This file
└── README.md
```

---

## How to Start

```bash
# From dashboard/
npm run dev
```

This starts both the Next.js dashboard (port 3002) and the Python redact service (port 8000) via `concurrently`.

The first time, run the Google OAuth setup first:

```bash
cd dashboard
npx ts-node scripts/google-auth.ts
```

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Dashboard | Next.js 16, TypeScript, Tailwind 4 | App Router, local only |
| PDF processing | Python FastAPI + PyMuPDF | `redact/`, port 8000 |
| Email in/out | Gmail API (`googleapis`) | OAuth tokens in `dashboard/google-tokens.json` (gitignored) |
| Google Sheets | Google Sheets API (`googleapis`) | Same OAuth credentials |
| DO parsing | Anthropic Claude Vision | `ANTHROPIC_API_KEY` in env |
| Local DB | SQLite (`better-sqlite3`) | `dashboard/data/arl.db` (gitignored) |
| Dev runner | `concurrently` | One `npm run dev` starts everything |

**No n8n. No Cloudflare tunnel. No inbound webhooks from external services.** The dashboard is always the initiator.

---

## Workflows

### WF-DO — Delivery Order Redaction (Phase 1, active)

**Flow:**
1. Gmail poller (runs in background, every 60s) detects new DO email
2. Downloads PDF or Excel attachment
3. Claude Vision parses fields (container #, consignee, cargo, etc.)
4. Stored in SQLite, appears in dashboard
5. Lorene opens DO in dashboard, draws redaction boxes on canvas
6. Python service applies vector redactions
7. Lorene approves → Gmail API sends redacted PDF to carrier → Google Sheets updated

**Key files:**
- `dashboard/lib/poller.ts` — Gmail polling orchestrator
- `dashboard/lib/gmail.ts` — Gmail API: read inbox, send email
- `dashboard/lib/sheets.ts` — Google Sheets: append to Load Board + Master Container List
- `dashboard/lib/claude.ts` — Claude Vision: parse DO fields from PDF/Excel
- `dashboard/lib/db.ts` — SQLite: WF-DO CRUD
- `dashboard/components/WFDORedactEditor.tsx` — canvas-based redaction UI
- `dashboard/app/api/wfdo-approve/[id]/route.ts` — approval: sends email + updates Sheets

### WF1 — Water Report (Phase 2, done)

Amercare sends an email with an `.xlsm` Excel attachment (subject: "ACR Truck Dispatch Report"). Gary reviews it in the dashboard and approves → rows written to both Load Board and Master Container List.

**Flow:**
1. Gmail poller (every 60s) detects water report emails via Claude Haiku classifier
2. Excel attachment parsed by `lib/wf1-parser.ts` (range A5:AE1000; key cols: G=container#, A=destination, B=ETA, D=free days, X=SSL, AB=terminal, J=size, K=BL, L=PO)
3. Stored in SQLite (`water_report_batches` table), appears in dashboard at `/`
4. Gary reviews batch → "Approve → Sheets" button → writes each container to Load Board (tab by destination) + Master Container List
5. No email sending in Phase 2 — Sheets only

**Key files:**
- `dashboard/lib/wf1-parser.ts` — Excel + plain text email parsing
- `dashboard/lib/claude.ts` — `classifyEmailAsWaterReport()` (Claude Haiku)
- `dashboard/lib/gmail.ts` — `pollWaterReportEmails()`
- `dashboard/lib/poller.ts` — `runWF1Poll()` starts alongside WF-DO poller
- `dashboard/lib/db.ts` — `water_report_batches` table, CRUD
- `dashboard/lib/sheets.ts` — `appendWF1ContainerToLoadBoard()` + `appendWF1ContainerToMasterList()`
- `dashboard/components/WF1BatchList.tsx` — Gary's review UI (filter, expand, approve, reject)
- `dashboard/app/api/wf1-approve/[id]/route.ts` — writes all containers to both Sheets
- `dashboard/app/api/wf1-reject/[id]/route.ts` — marks batch rejected
- `dashboard/app/api/wf1-batches/route.ts` — list all batches
- `dashboard/app/page.tsx` — WF1 dashboard page (server component)

### WF2 / WF3 — Dispatch + Invoice (Phase 3, not started)

Depends on PortPro API integration. Design in `docs/workflow-guide.html`.

---

## Google Sheets

There is an existing Google Sheet used in production. Two relevant tabs:
- **Load Board** — one row per container/DO dispatched
- **Master Container List** — master record of all containers

Column mapping is in `dashboard/lib/sheets.ts`. Inspect the sheet before modifying this file.

---

## Environment Variables

See `dashboard/.env.local`. Required keys:

```
DASHBOARD_PASSWORD=          # Login password for the dashboard
WEBHOOK_SECRET=              # Shared secret for API routes (keep for now)
ANTHROPIC_API_KEY=           # Claude API key
GOOGLE_CLIENT_ID=            # Google Cloud OAuth client ID
GOOGLE_CLIENT_SECRET=        # Google Cloud OAuth client secret
GOOGLE_SHEET_ID=             # The ID from the existing Google Sheet URL
DO_SENDER_EMAILS=            # Comma-separated sender emails for DO filter (e.g. lorene@amercare.com,ops@taggart.com)
REDACT_SERVICE_URL=http://localhost:8000
```

OAuth tokens are stored in `dashboard/google-tokens.json` (gitignored, generated by `scripts/google-auth.ts`).

---

## Current Status

| Area | Status |
|---|---|
| Monorepo structure | Done |
| WF-DO UI components | Done |
| SQLite layer (lib/db.ts) | Done |
| Gmail polling | Done |
| Google Sheets integration | Done — column order needs verification against real sheet |
| Claude Vision parser | Done |
| WF-DO approval flow (send + Sheets) | Done |
| WF-DO approve/re-redact UI buttons | Done |
| TypeScript — 0 errors | Done |
| ESLint — 0 errors, 0 warnings | Done |
| Next.js build — clean | Done |
| Python packages (fastapi, uvicorn, pymupdf) | Done — installed globally |
| Google Cloud OAuth setup | Done — google-tokens.json generated |
| Google Sheet column order verification | Done — sheets.ts fully rewritten against real sheets |
| AI email classification (classifyEmailAsDO) | Done — Claude Haiku classifies before PDF parsing |
| Railway deployment | Pending |
| WF1 — Water Report | Live tested (session 5) — 356 containers parsed, batch appeared in dashboard ✅ |
| WF2 / WF3 | Removed from nav — not started, waiting on PortPro |

---

## Key Decisions

- **No n8n** — all automation is direct API calls from the dashboard. Simpler, no tunnel needed.
- **SQLite** — local persistence, single file, no server. Replaces flat JSON files.
- **Gmail polling** — dashboard pulls from Gmail every 60s via `instrumentation.ts`. No inbound webhooks.
- **Monorepo** — dashboard + redact service in one repo for easier session handoff and single start command.
- **Python for PDF** — PyMuPDF is the best PDF library; kept as a sidecar service on port 8000.
- **AI email classification** — Claude Haiku classifies every unread email with attachment before downloading PDF. No sender whitelist needed. `DO_SENDER_EMAILS` env var is unused.
- **WF1 filename-first classification** — `pollWaterReportEmails()` checks attachment filenames against `/ACR.*Truck.*Dispatch/i` and `/AMERCARE/i` before calling Claude. Known filenames skip the AI call entirely.
- **WF1 dual Excel format** — `parseWaterReportExcel()` auto-detects two formats: (A) AMERCARE per-location xlsx (header row 1, container col D) and (B) ACR Truck Dispatch Report xlsm from `podium@oocllogistics.com` (header row 5, container col G). Detection checks `row[0][3]` vs `row[4][6]` for "Container".
- **WF1 upsert (in progress)** — `appendWF1ContainerToLoadBoard/MasterList` being replaced with `upsertWF1ContainersToLoadBoard/MasterList` — reads container# column once per tab, updates existing rows, appends new ones. Not yet wired to approve route.
- **Two separate Google Sheet IDs** — `GOOGLE_SHEET_ID_MASTER` (Master Container List) and `GOOGLE_SHEET_ID_LOADBOARD` (Load Board). Load Board tab is routed by delivery location (NY/NJ, Exton/PA, Vacaville, Ontario Amer, etc.).
- **WF2/WF3 removed from nav** — PortPro not ready. Routes/pages still exist but not linked.
- **WF1 Sheets batch writes** — `upsertWF1ContainersToLoadBoard/MasterList` uses `batchUpdate` (all updates) + single `append` (all new rows) per tab. Reduces 356 individual API calls to ~3 per tab. ~5 seconds vs ~4 minutes.
- **WF1 Re-sync button** — approved batches have a "Re-sync to Sheets" button that re-runs the upsert without requiring pending_review status. Used for recovery from partial writes. Route: `app/api/wf1-resync/[id]/route.ts`.
- **WF1 approve result banner** — after approve/resync, shows per-tab breakdown: tab name, added count, updated count. Stored in `lastResult` client state, persists across router.refresh().

---

## Session Handoff

At the end of each session, update this section:

**Last worked on:** 2026-10-23 (session 11)

**What was done (session 1):** Full Phase 1 rebuild — monorepo created at `C:\Users\28mar\OneDrive\Dev\greg-clarke-arlv2`, GitHub repo at `github.com/markcalma/arl-trans`. All new libs created (db.ts, gmail.ts, sheets.ts, claude.ts, poller.ts). wfdo-approve now sends via Gmail API + writes to Sheets. SQLite replaces flat JSON files. Poller starts on server boot via instrumentation.ts.

**What was done (session 2):**
- Fixed 4 TypeScript errors: stale `pending_review` status in WFDOPendingQueue, Gmail SDK null type mismatch in gmail.ts, removed invalid `instrumentationHook` from next.config.ts, installed missing `dotenv` package for google-auth.ts
- Fixed `wfdo-re-redact` route — was still calling dead n8n webhook; now resets DO status to `pending_redaction` in SQLite
- Added **Approve & Send** button, **Re-redact** button, and **Carrier Email** field to `WFDOPendingQueue` (these were missing — workflow couldn't complete without them)
- ESLint: fixed `require()` in test file, unused params, ternary-as-statement, img element warning
- Installed Python packages: `fastapi`, `uvicorn`, `python-multipart` (were missing)
- TypeScript: 0 errors | ESLint: 0 errors 0 warnings | Next.js build: clean | Python syntax: clean

**What was done (session 3):**
- AI email classification: added `classifyEmailAsDO()` to `lib/claude.ts` using Claude Haiku — replaces sender whitelist
- `lib/gmail.ts`: removed `DO_SENDER_EMAILS` filter, added `extractBodyText()`, calls classifier before downloading attachments. Non-DO emails skipped (not marked read), tracked in memory via `skippedGmailIds`
- `lib/sheets.ts`: completely rewritten — two separate sheet IDs, location-based Load Board tab routing (7 tabs), `LT M-DD-YY` format for column K, correct column mappings for both sheets
- `.env.local`: filled in all credentials. `GOOGLE_SHEET_ID` replaced with `GOOGLE_SHEET_ID_MASTER` + `GOOGLE_SHEET_ID_LOADBOARD`
- `lib/gmail.ts`: added `https://www.googleapis.com/auth/spreadsheets` scope (was missing)
- `package.json`: installed `tsx`, replaced `ts-node` auth script with `tsx` (ts-node incompatible with Next.js tsconfig)
- Google Cloud OAuth: created project `arl-trans`, enabled Gmail + Sheets APIs, created Desktop OAuth client, ran auth script — `google-tokens.json` generated
- `NavBar.tsx`: removed WF2 and WF3 links — only WF1 and WF-DO shown
- App running: `npm run dev` → dashboard port 3002, Python service port 8000

**What was done (session 4):**
- Scanned old n8n project at `C:\Users\28mar\OneDrive\Dev\greg-clarke` to understand WF1 structure
- Installed `xlsx` (SheetJS) package for Excel parsing
- `lib/types.ts`: added `WF1Container` and `WF1Batch` types
- `lib/db.ts`: added `water_report_batches` table + full CRUD (`insertWF1Batch`, `updateWF1BatchStatus`, `getWF1Batch`, `getPendingWF1Batches`, `getAllWF1Batches`, `wf1GmailIdExists`)
- `lib/wf1-parser.ts`: NEW — `parseWaterReportExcel()` (SheetJS, range A5:AE1000) + `parseWaterReportText()` (plain text/HTML work order format)
- `lib/claude.ts`: added `classifyEmailAsWaterReport()` using Claude Haiku
- `lib/gmail.ts`: added `pollWaterReportEmails()` — separate from WF-DO poll, marks read after storage
- `lib/poller.ts`: added `runWF1Poll()` — starts alongside WF-DO poller via same `startPoller()` call
- `lib/sheets.ts`: added CARSON, STOCKTON, OAKLAND tabs to `resolveLoadBoardTab()`; added `appendWF1ContainerToLoadBoard()` and `appendWF1ContainerToMasterList()`
- `app/api/wf1-batches/route.ts`: NEW — lists all batches
- `app/api/wf1-approve/[id]/route.ts`: NEW — writes containers to both sheets, marks approved
- `app/api/wf1-reject/[id]/route.ts`: NEW — marks rejected
- `app/page.tsx`: replaced old n8n-era WF1 page with new server component + `WF1BatchList` client component
- `components/WF1BatchList.tsx`: NEW — filter tabs, expand containers table, Approve → Sheets, Reject
- TypeScript: 0 errors | ESLint: 0 errors 0 warnings | Next.js build: clean

**Phase structure:**
- Phase 1 — WF-DO Pipeline ✅ DONE
- Phase 2 — WF1 Water Report ✅ DONE
- Phase 3 — Railway Deployment 🔜 NEXT
- Phase 4 — WF2/WF3 PortPro Integration (waiting on API access)

**What was done (session 5):**
- Inspected real Amercare sample emails in `amercare-sample-emails/` — discovered TWO Excel formats
- `lib/wf1-parser.ts`: Rewrote `parseWaterReportExcel()` to auto-detect and handle both formats:
  - Format A: AMERCARE per-location xlsx (EXTON/CARSEN/STOCKTON) — header row 1, container at col D (index 3), free days col C, PO col E, BL col F, terminal col H
  - Format B: ACR Truck Dispatch Report xlsm from `podium@oocllogistics.com` — header row 5, container col G (index 6), free days col D, BL col K, PO col L, SSL col X, terminal col AB
  - Detection: `row[0][3] === 'Container'` → Format A; `row[4][6] === 'Container'` → Format B
- `lib/claude.ts`: Added workspace ID header support (`ANTHROPIC_WORKSPACE_ID` env var) for personal API keys
- `lib/gmail.ts`: Added `extractFilenamesFromPayload()` + filename-first classification in `pollWaterReportEmails()` — skips Claude call when filename matches `/ACR.*Truck.*Dispatch/i` or `/AMERCARE/i`
- **Live test passed**: Sent ACR xlsm to Gmail → 356 containers parsed → batch appeared in dashboard ✅
- `lib/sheets.ts`: Added `upsertWF1ContainersToLoadBoard()` and `upsertWF1ContainersToMasterList()` — reads container# column once per tab, updates existing rows, appends new ones.

**What was done (session 6):**
- `app/api/wf1-approve/[id]/route.ts`: Updated to call `upsertWF1ContainersToLoadBoard/MasterList` in parallel (Promise.allSettled). Response now returns `{ loadBoard: { written, updated, tabs }, masterList: { written, updated, tabs } }`
- `lib/sheets.ts`: Rewrote upsert functions to use batch API calls — all updates in one `batchUpdate`, all appends in one `append` per tab. Reduces 356 individual API calls to ~3 per tab. Added `UpsertResult` type with per-tab breakdown (`tabs: Record<string, { written, updated }>`).
- `app/api/wf1-resync/[id]/route.ts`: NEW — re-runs upsert on any batch regardless of status. Used for recovery from partial writes.
- `components/WF1BatchList.tsx`: Added `lastResult` state showing per-tab breakdown after approve/resync (green banner with Load Board tabs + Master List). Fixed `data.containersWritten` bug (was undefined). Added **Re-sync to Sheets** button on approved batches.
- **Live test passed**: Approve → 356 containers written to STOCKTON (187), Exton/PA (162), CARSON (7) + Master List (356). ✅
- **Re-sync tested multiple times**: each run caught missed rows from partial earlier writes. Final state: 0 added / 356 updated across all tabs — fully idempotent. ✅
- TypeScript: 0 errors

**What was done (session 8 — Railway deployment, in progress):**
- `dashboard/railway.toml`: Switched builder to DOCKERFILE
- `dashboard/Dockerfile`: Created — node:20-slim, apt build tools, npm ci, rebuild better-sqlite3 from source, npm run build, uses `${PORT:-3000}` for Railway PORT injection
- `dashboard/.dockerignore`: Added — excludes node_modules, .next, data, .env.local (was causing Windows binaries to overwrite Linux build → segfault)
- `dashboard/nixpacks.toml`: Added nodejs_20 + build tools (kept for reference but not used now)
- `dashboard/app/api/health/route.ts`: Health check endpoint
- `gmail.ts`: TOKENS_PATH moved to data/google-tokens.json; GOOGLE_TOKENS_JSON env var seed
- Committed and pushed sessions 2-7 to GitHub (were all local)
- Railway: arl-trans service deployed, volume arl-trans-volume mounted at /app/data, env vars set, domain arl-trans-production.up.railway.app → port 8080
- Root cause found: `/api/health` was in the auth middleware (`proxy.ts`) and redirected to `/login` — Railway health check got a redirect, never marked service healthy, proxy returned 502
- Fix: added `/api/health` to PUBLIC routes in `proxy.ts` — pushed as commit `0fbdce1`
- google-tokens.json refreshed locally (access_token updated) — means local OAuth is working fine
- Awaiting Railway build of `0fbdce1` to confirm fix. If still failing after this build, next step: check Railway deploy logs for health check response or try the Console tab: `node -e "require('http').get('http://localhost:8080/api/health', r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>console.log(d)) })"` — should return `{"ok":true}` not `/login`

**What was done (session 7):**
- `dashboard/railway.toml`: NEW — nixpacks build, `npm run start`, health check at `/api/health`, restart on failure
- `redact/railway.toml`: NEW — nixpacks build, `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check at `/health`
- `dashboard/app/api/health/route.ts`: NEW — returns `{ok: true}` for Railway health checks
- `dashboard/lib/gmail.ts`: Changed `TOKENS_PATH` from `google-tokens.json` → `data/google-tokens.json` (same persistent volume as SQLite). Added `GOOGLE_TOKENS_JSON` env var seed — on startup if file missing, writes from env var (Railway first-run flow).
- `dashboard/.env.local.example`: Added `GOOGLE_TOKENS_JSON=` (Railway-only)
- Moved local `google-tokens.json` → `dashboard/data/google-tokens.json` (already gitignored under `dashboard/data/`)
- TypeScript: 0 errors | Next.js build: clean

**What was done (session 8):**
- Fixed 3 bugs discovered during end-to-end testing:
  - `lib/poller.ts`: Both `runDoPoll()` and `runWF1Poll()` were checking old `google-tokens.json` path (cwd root) instead of new `data/google-tokens.json` — poller silently bailed every 60s without checking Gmail
  - `lib/sheets.ts`: `TOKENS_PATH` was pointing to old `google-tokens.json` (cwd root) instead of `data/google-tokens.json`
  - `lib/gmail.ts`: `exchangeCode()` didn't `mkdirSync('data/', {recursive:true})` before writing token file — would fail if `data/` didn't exist
- **WF-DO end-to-end test passed** (container BMOU5679827):
  - `GET /api/wfdo-render-page` → PDF rendered as 1224×1584 PNG via Python/PyMuPDF ✅
  - `POST /api/wfdo-manual-redact` → boxes applied, PDF overwritten in place ✅
  - `POST /api/wfdo-approve` → Gmail send (to test address) + Load Board append + Master List append, status → 'sent' ✅
  - `POST /api/wfdo-re-redact` → correctly rejects 'sent' orders (409); resets 'pending_redaction' orders ✅
- TypeScript: 0 errors (confirmed before and after fixes)

**What was done (session 9):**
- **WF-DO dashboard full rebuild** (`components/WFDOList.tsx`):
  - Collapsed rows with sub-status badge ("Awaiting redaction" / "Ready to send" / "Sent")
  - Click to expand → 3-stage progression: 1·Redact → 2·Review → 3·Send
  - Stage 1: `WFDORedactEditor` canvas only
  - Stage 2: PDF preview + editable fields + "Next: Prepare to Send →" button
  - Stage 3: email draft, Copy Subject/Body, Download PDF, Re-redact, "Mark as Sent" button
  - "Mark as Sent" replaces "Approve & Send" — no Gmail send, Sheets write only
- **Deleted** `WFDOPendingQueue.tsx` and `WFDOSentTable.tsx`
- **Updated** `app/api/wfdo-approve/[id]/route.ts` — removed Gmail send, kept Sheets writes
- **Reset to original PDF** — poller now saves `{id}.original.pdf` alongside `{id}.pdf`. "Reset to original PDF" link in editor copies it back. New route: `app/api/wfdo-reset-pdf/[id]/route.ts`
- **ARL-Trans logo stamp** — `components/WFDOLogoStamper.tsx`: click to place fixed square logo on PDF canvas. New Python endpoint `redact/main.py /stamp-logo`. New route: `app/api/wfdo-stamp-logo/[id]/route.ts`. Logo at `dashboard/public/arltrans-no-bg.png`
- **WFDORedactEditor** — added `onApplied`/`onReset` callbacks, reset button, "Place ARL-Trans logo →" toggle
- **Sheets upsert for WF-DO** — `appendToLoadBoard` and `appendToMasterList` now upsert:
  - If container # already exists in sheet → partial update of WF-DO-owned columns only (leaves WF1 columns SSL/size/vessel/free days untouched)
  - If new → append full row with WF1 columns left blank
  - Fixed bug: was incorrectly writing `nvoName` to SSL column (Load Board col B) and Carrier column (Master List col J)
- **`dashboard/scripts/seed-do.ts`** — new script for inserting test DOs into SQLite (`npx tsx scripts/seed-do.ts`)
- **E2E test passed**: BMOU5679827 — canvas redaction → Apply → logo stamp → Review fields → Mark as Sent → moved to Sent tab ✅
- TypeScript: 0 errors

**Key decisions (session 9):**
- **Manual send** — Lorene sends DO email herself from her own Gmail; dashboard only tracks "Mark as Sent" + writes to Sheets
- **Upsert not append** — WF-DO and WF1 each own specific columns in the same row per container. Partial update prevents overwriting each other's data.
- **Logo stamp is click-to-place** — fixed square (200×200 image pixels = 100×100 PDF points). Click anywhere on PDF canvas to position.

**What was done (session 10):**
- **Railway deployment abandoned** — better-sqlite3 segfault on first boot (WAL pragma on fresh DB), recurring crash loop, Railway outage blocked final fix. Switched to Hostinger VPS instead.
- **`proxy.ts` mystery solved** — Next.js 16 recognises `proxy.ts` as middleware (shows as "Proxy (Middleware)" in build output). Auth is working correctly.
- **Code fixes pushed (commit b630210):**
  - `lib/db.ts`: wrapped `pragma('journal_mode = WAL')` in try/catch — WAL init segfaults on fresh SQLite DBs in some Linux containers
  - `instrumentation.ts`: moved `GOOGLE_TOKENS_JSON` seeding to server boot (before poller starts), fixing chicken-and-egg where poller bailed because tokens file didn't exist yet
- **Hostinger VPS deployment — LIVE at `http://72.62.199.171:3002`:**
  - Ubuntu 24.04, Node 22.23.3, Python 3.12.3
  - Upgraded Node 20 → 22 (better-sqlite3 v13 + googleapis require Node ≥ 22)
  - Python venv at `/opt/redact-venv` with fastapi, uvicorn, pymupdf, python-multipart
  - Repo cloned to `/opt/arl-trans/`
  - `.env.local` and `google-tokens.json` deployed to server
  - Both services managed by PM2, configured to auto-start on reboot
  - No Nginx yet — accessible directly via IP:port

**Key decisions (session 10):**
- **Hostinger over Railway** — VPS is better fit: no native module compilation issues, two services on localhost, SQLite as a plain file, full SSH access, no extra cost (VPS already paid for n8n)
- **No Nginx yet** — team testing on IP:port first; add subdomain + HTTPS once confirmed working
- **Railway kept as fallback** — commit b630210 (WAL fix + tokens seeding) is pushed and will deploy when Railway builds resume

**What was done (session 11):**
- **Gmail multi-account plan saved to memory** — `ops@arl-trans.com` shared inbox approach, forwarding from team members, re-run OAuth when ready
- **Analysed all sample emails** from `greg-clarke/projects/greg materials/files 9-2-2026` and `eml files 10-5-2026` — found 3 gaps in the automation
- **Gap 1 fixed** (`lib/poller.ts`): multi-xlsx WF1 emails (e.g. "HERE YOU GO" with 3 xlsx files) now create one batch per xlsx instead of only the first
- **Gap 2 fixed** (`lib/claude.ts`, `lib/poller.ts`): multi-container merged PDFs now create one DO record per container — new `parseAllDOsFromPdf()` returns array, poller loops through results
- **Gap 3 fixed** (`lib/excel-do-parser.ts` NEW, `lib/poller.ts`, `components/WFDOList.tsx`): USF Excel DOs (xlsx-only, no PDF) now parsed and stored. UI opens directly at Review stage, no redact canvas, no Download PDF button
- **Packing list classifier fix** (`lib/claude.ts`): tightened `classifyEmailAsDO` prompt — packing lists, invoices, receipts now correctly rejected
- **PAC file filter** (`lib/poller.ts`): PDF attachments with " PAC" in filename skipped — prevents packing list PDFs from being ingested as DOs. xlsx takes priority when email has both xlsx + PAC pdf (USF format)
- **Live tests completed (session 11):**
  - Test 1: `ONEU5574796 325663.pdf` → ingested ✅, full redact/stamp/approve flow ✅
  - Test 2: `DO BSIU3095542.pdf` → ingested ✅
  - Test 3: `9343522I PAC.pdf` (packing list) → correctly rejected after fix ✅
  - Test 4: `Fwd_ HLXU1327279 _ ST2030960.eml` → ingested, PDF canvas rendered ✅
  - Tests 5-10 in progress at checkpoint
- **WF1 classifier false positive bug found and fixed** (`lib/claude.ts`, `lib/gmail.ts`): WF1 poller was misclassifying DO emails (AMERCAREROYAL subjects) as water reports, marking them as read, causing WF-DO poller to miss them. Fix: tightened WF1 classifier prompt to explicitly reject DOs; only mark email as read when Excel content found (false positives added to skipped set instead)
- Tests completed: Test 1 ✅ Test 2 ✅ Test 3 ✅ Test 4 ✅ Test 5 ✅
- Tests pending: Test 6 (multi-container merged PDF — 5 containers), Test 7 (USF Excel DO), Tests 8-10 (WF1)

**What was done (session 12):**
- **Completed all 10 live tests** (Tests 6-10 finished):
  - Test 6: Merged PDF → 5 DO records (EMCU8808369, GAOU7282735, TXGU5776680, EGSU9846470, CAAU5879967) ✅
  - Test 7: USF Excel DO (WHSU5554784) → opens at Review stage, no redact canvas ✅
  - Test 8: ACR xlsm → 356 containers to Sheets ✅
  - Test 9: HERE YOU GO (3 xlsx) → 2 batches (EXTON 68, CARSEN 6; STOCKTON empty) ✅
  - Test 10: Second ACR report → 360 containers to Sheets ✅
- **Bug fix**: multi-DO merged PDFs — each DO now gets its own PDF copy so redactions are independent. Previously all DOs shared one file (sharedId), now each gets `randomUUID()` + own copy.
- **Bug fix**: `wfdo-render-page`, `wfdo-manual-redact`, `wfdo-pdf` routes — now look up `pdfPath` from DB (`getDOOrder(safeId)`) instead of constructing `data/pdfs/{id}.pdf`. Fixes 404 for DOs 2-5 in merged PDFs.
- **Gmail filter**: added `newer_than:7d` to both poller queries (`is:unread has:attachment newer_than:7d` and `is:unread newer_than:7d`). Prevents old unread emails filling the 50-slot limit and blocking new emails.
- **Gmail maxResults**: increased from 20 → 50 in both pollers.
- **Gmail debug logs**: added poll count log + silent-skip ID log for diagnostics.
- **Root cause found (xlsm testing)**: Gmail strips `.xlsm` macro-enabled files when sent Gmail-to-Gmail. In production, xlsm from `podium@oocllogistics.com` arrives from external server — not stripped. Testing workaround: save xlsm → xlsx (File → Save As in Excel), attach xlsx to new email.
- **Deployed to VPS**: `git push` + manual deploy on `72.62.199.171` (`git pull && npm install && npm run build && pm2 restart all`). All 3 PM2 processes online.
- **Note**: `/opt/deploy-arl.sh` does not exist on VPS — deploy manually with the 4 commands above.

- **Test files consolidated**: all 10 test email files copied and labeled to `C:\Users\28mar\OneDrive\Dev\greg-clarke\projects\greg materials\email for sample testing\` (Test5/NYKU5121534 source file not identified)

**Next session:**
- Create video presentation + screen recording for team demo (Win+Alt+R to record)
- Create Canva process diagram (email → ARL-Trans → redact/review → carrier/Sheets)
- Add Nginx + SSL for a clean domain once team confirms VPS is working
- WF2/WF3 when PortPro API access arrives
