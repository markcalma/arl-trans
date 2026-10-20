# WF-DO Checkpoint — 2026-10-08a (Post Greg Meeting)

**Status:** WF-DO functionally complete. Greg meeting done. Session shifting to WF3.

---

## What Happened Since 2026-10-06f

### Greg Meeting
- Presented WF-DO flow to Greg
- Design confirmed: Lorene sees raw PDF, draws redaction boxes, copies email, downloads PDF, sends manually from Gmail

### Cloudflare Tunnel URL Updated
n8n "POST to Dashboard Webhook" node had a stale tunnel URL. New tunnel started:
- **Dashboard tunnel (port 3002):** `https://streets-characters-transmission-album.trycloudflare.com`
- **Webhook URL in n8n:** `https://streets-characters-transmission-album.trycloudflare.com/api/wfdo-webhook`

Note: Cloudflare tunnel URLs change on every restart. Must update n8n node each time.

### PDF Still Overwritten
`data/pdfs/BMOU5679827.pdf` is still the redacted version from testing. To restore:
- Forward original BMOU5679827 DO email in Gmail → n8n re-processes → fresh PDF lands in dashboard

---

## WF-DO Final State (complete)

| Feature | Status |
|---------|--------|
| n8n flow (Gmail → Claude Vision → Dashboard) | ✅ Working |
| Canvas redaction editor | ✅ Working |
| Vector PDF output (text-selectable) | ✅ Working |
| Email draft auto-fill | ✅ Working |
| Copy Subject / Copy Body buttons | ✅ Working |
| Download Redacted PDF button | ✅ Working |
| Sign-off = ARL-Trans (not NVO) | ✅ Fixed |
| Add Text to PDF | 🔜 Deferred |

---

## Services Required to Run WF-DO

```
Terminal 1: cd C:\Users\28mar\OneDrive\Dev\arl-redact-service
            venv\Scripts\uvicorn main:app --port 8000

Terminal 2: cd C:\Users\28mar\OneDrive\Dev\arl-trans-dashboard
            npm run dev

Terminal 3 (only for n8n): "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:3002
  → Copy new URL → update n8n "POST to Dashboard Webhook" node URL
```

---

## Next Focus: WF3

User opened `WF3-Build-Progress.md`. Last WF3 status (2026-10-01):
- 20/21 nodes working
- Pending: wf3-09 (uploadBillingDoc FALSE branch, needs apifyToken), full unpinned E2E test, production swap
- File: `projects/n8n-workflows/WF3-Invoice-Portal.json`
- Dashboard: `/wf3` tab on `feat/wf2-order-intake` branch

---

## Resume Prompt

Read `WF-DO-Checkpoint-2026-10-08a.md`. WF-DO is complete. Next: resume WF3 — read `WF3-Build-Progress.md` for full node status, then pick up at wf3-09 (uploadBillingDoc FALSE branch).
