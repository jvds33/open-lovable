# Plan: Open Lovable on Vercel using Claude Code Max Subscription (PR #148) + ComputeSDK (PR #182) + Security (PR #176)

Goal
- From my phone: paste a company website URL → generate a modern demo site → show the owner a live preview link.
- Deployment target: Vercel (webapp)
- AI: Claude Code Max subscription ONLY (no OpenRouter for now)
- Sandbox/preview: ComputeSDK (PR #182)
- Security fixes: PR #176

Context (merged PRs)
- #176 (security) merged
- #182 (ComputeSDK sandbox manager) merged
- #148 (Claude Code subscription-based route) merged + conflicts resolved
- #180 (OpenRouter) merged previously, but we will NOT use it (no keys, no provider selection, no fallback) for now.

---

## 0) Architecture

We run two services:

A) Webapp (Next.js) → Vercel
- UI: URL input, demo presets, generate, preview, share
- Calls:
  - Scraping via Firecrawl
  - AI via Claude Bridge (subscription)
  - Preview sandbox via ComputeSDK provider (Vercel)

B) Claude Bridge service (Python/FastAPI) → external always-on host (Render/Fly/Railway)
- This service uses Claude Code CLI in subscription mode (your Max plan).
- Webapp calls it over HTTPS (optionally streaming via SSE).
- Must be always-on for “coffee shop demos” (avoid cold start).

Why split:
- Vercel is excellent for Next.js, but a CLI-powered Python bridge is more reliable as a separate always-on service.

---

## 1) Requirements

Accounts/keys:
- FIRECRAWL_API_KEY (required)
- Vercel account
- Claude Code Max subscription (already have)

Local tooling:
- Node + package manager per repo
- Python (for local testing of the bridge)
- Git

---

## 2) Upstream remote (if needed)

If you haven’t added upstream yet:
- git remote add upstream https://github.com/firecrawl/open-lovable.git
- git fetch upstream

---

## 3) Environment variables (local)

Create `.env.local` from `.env.example`.

### Required: scraping
- FIRECRAWL_API_KEY=...

### Sandbox provider (Vercel via ComputeSDK)
- SANDBOX_PROVIDER=vercel
- VERCEL_TOKEN=...
- VERCEL_TEAM_ID=...        (only if using a team)
- VERCEL_PROJECT_ID=...     (only if required by provider)

### Claude subscription route (PR #148)
Set the bridge URL that the webapp will call:
- CLAUDE_BRIDGE_URL=https://<your-bridge-domain>

Note:
- If PR #148 uses a different env var name, use the one defined in `config/app.config.ts` (that file is the source of truth).

### Explicitly NOT using OpenRouter (for now)
- Do not set OPENROUTER_API_KEY
- Do not configure OpenRouter as a provider anywhere in UI defaults

---

## 4) Claude Bridge service (PR #148)

### Local test (on your laptop)
1) Go to `api/python/`
2) Install deps: `pip install -r requirements.txt`
3) **CRITICAL: Start the bridge via the script, NOT directly from a Claude Code terminal:**
   ```bash
   ./api/python/start-bridge.sh
   ```
   This script unsets the `CLAUDECODE` env var. If you start uvicorn directly from
   a Claude Code session, the Claude SDK will refuse to initialize ("nested session"
   error) because it inherits `CLAUDECODE=1`.
4) Verify health: `curl http://localhost:8000/health`
5) Verify status: `curl http://localhost:8000/api/claude-code/status`

Definition of done:
- You can hit the bridge locally and get a response without any Anthropic API key.
- Bridge must be started via `start-bridge.sh` (or in a shell without `CLAUDECODE` set).

### Production deploy (recommended)
Deploy the bridge to an always-on host (Render or Fly are easiest).
- Disable autosleep if possible
- Enable a healthcheck
- Keep it behind HTTPS
- Optionally add basic auth (or a shared secret header) so only your webapp can call it

Outputs:
- A stable public URL: https://bridge.<yourdomain>.com

---

## 5) Webapp local run + smoke tests

1) Install deps
- pnpm install   (or npm install)

2) Run dev server
- pnpm dev       (or npm run dev)

Smoke tests:
- App loads
- URL input works
- Scrape works (test with a simple, static site first)
- Generate uses Claude Bridge (verify via bridge logs)
- Preview works (ComputeSDK / Vercel provider)
- Preview refresh button (PR #182) works if preview gets stuck

---

## 6) Deploy webapp to Vercel

1) Push your branch to GitHub
2) Import in Vercel
3) Set env vars in Vercel Project Settings:
- FIRECRAWL_API_KEY
- SANDBOX_PROVIDER=vercel
- VERCEL_TOKEN (+ TEAM_ID/PROJECT_ID if needed)
- CLAUDE_BRIDGE_URL=https://...
- (Optional security) BRIDGE_SHARED_SECRET=... (if your bridge supports it)

4) Deploy
5) Production verification (mobile):
- Paste URL → scrape → generate → preview
- Share link works
- No cold-start delays from the bridge

---

## 7) Coffee Shop Demo Mode (the “sell it fast” UX)

Add (or verify existing) a preset button:
Preset: “Coffee shop demo”
Prompt template:
- Extract brand style (colors, fonts, tone)
- Build a modern 1-page demo site
- Sections:
  - Hero with clear CTA
  - Menu / products
  - Reviews / social proof
  - Location + opening hours
  - Contact + WhatsApp CTA
- Generate 2 variations (A/B)
- Use placeholder assets for logos/images unless owner provides permission/assets
- Rewrite copy (no 1:1 text cloning)

Add 2 UX helpers:
- “Copy share link”
- “Refresh preview” (PR #182)

---

## 8) Reliability guardrails (important for live demos)

Bridge protection (implemented in `api/python/main.py`):
- Rate limit: 10 requests per 60 seconds per IP (safe for demos, blocks abuse)
- Concurrency: 1 generation at a time (semaphore) — prevents overload
- Health endpoint: `GET /health` for uptime monitoring
- CORS: configurable via `CORS_ORIGINS` env var (comma-separated)
- **CRITICAL**: Always start bridge via `./api/python/start-bridge.sh` to avoid
  Claude SDK nested session errors (unsets `CLAUDECODE` env var).
- Add timeouts + retry (1 retry) with friendly UI message:
  - “Generation failed—retrying once…”
  - If still failing: “Try again in 10 seconds”

Scrape protection:
- Handle Firecrawl failures gracefully:
  - show a “Couldn’t scrape fully; generating from partial content” option

---

## 9) Definition of Done

- Vercel URL works on mobile
- Bridge is always-on and uses Claude Code Max subscription
- 1 URL paste → within minutes you have a live preview demo
- Share link is usable by the owner immediately
- Basic failure modes are handled (scrape/bridge/preview)