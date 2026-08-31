# Trading Tracker — Project Context

## What this project is
A personal intraday-trading dashboard for a watchlist of 10 US mega-cap stocks
(NVDA, TSLA, AMZN, META, AVGO, AMD, MSFT, GOOGL, AAPL, JPM). It has two halves:

1. **Data pipeline** (Python + GitHub Actions) — runs on GitHub's servers on a
   schedule, fetches recent price data, tiers each stock by volatility, applies
   a simple rule-based strategy per tier, backtests it, and publishes the
   results as `results.json` committed back to this repo.
2. **Web dashboard** (React + Vite) — a standalone website that fetches
   `results.json` and displays it: watchlist cards, backtest table, a position-size
   calculator, and a personal trade journal (saved in the browser's localStorage).

Repo: https://github.com/sushant-patel/Trading-

## File map

- `intraday_screener.py` — the analysis script. Run locally with
  `python intraday_screener.py --period 1mo --json-out results.json`.
  Flags: `--period` (yfinance period string), `--tickers` (override watchlist),
  `--json-out` (write results for the dashboard).
- `.github/workflows/daily_screener.yml` — GitHub Actions workflow. Runs the
  script on a cron schedule (currently 12:30 UTC, Mon–Fri) and commits the
  resulting `results.json` back to the repo. This is what makes the pipeline
  run without the PC being on.
- `web/` — the Vite + React dashboard (standalone site, not a Claude artifact).
  - `web/src/App.jsx` — main component: tabs for Watchlist / Backtest /
    Calculator / Journal / Settings.
  - `web/src/main.jsx` — Vite entry point.
  - `web/index.html`, `web/package.json`, `web/vite.config.js` — standard Vite
    scaffold.
  - Persistence uses **browser localStorage** (not Claude's `window.storage` —
    that API only exists inside Claude.ai artifacts, not standalone sites).
    This means journal entries and the configured data-source URL are
    per-browser, not synced across devices, unless a real backend is added
    later (see Known limitations).

## Data contract: results.json

```json
{
  "generated_at": "ISO-8601 timestamp",
  "period": "string, e.g. '1mo'",
  "tickers": [
    {
      "ticker": "NVDA",
      "avg_range_pct": 4.9,
      "tier": "high | medium | low",
      "last_close": 217.55,
      "last_change_pct": -4.58,
      "trades": 6,
      "win_rate": 50.0,
      "total_return_pct": 3.1
    }
  ]
}
```
The dashboard fetches this from whatever URL is saved in its Settings tab —
normally `https://raw.githubusercontent.com/sushant-patel/Trading-/main/results.json`.

## Status / what's done

- [x] GitHub repo created, git initialized and pushed
- [x] `intraday_screener.py` with JSON export
- [x] `daily_screener.yml` moved to `.github/workflows/daily_screener.yml`
- [x] Filename mismatch fixed: script renamed to `intraday_screener.py` (underscore)
- [x] `web/` dashboard built (Vite + React): Watchlist, Backtest, Calculator, Journal,
      Settings tabs, localStorage persistence — verified locally with Playwright
      (empty-state handling, position-size math, journal add + reload persistence,
      and rendering with sample `results.json` data all confirmed working)
- [ ] Push these changes to `origin/main` (not yet pushed as of this session)
- [ ] Run the Action once manually (Actions tab → Run workflow) to confirm
      `results.json` gets generated and committed
- [ ] Deploy `web/` somewhere public (see Next steps)

## Next steps (suggested order)

1. Push the current changes (workflow relocation, script rename, new `web/` app)
   to `origin/main`.
2. In GitHub → Actions tab → "Daily Intraday Screener" → Run workflow, to trigger
   it manually and confirm `results.json` appears in the repo root.
3. `cd web && npm install && npm run dev` — check the dashboard locally, paste the
   raw `results.json` URL into Settings, confirm it fetches real data once step 2
   has produced a real file.
4. Deploy `web/` to Vercel (free): go to vercel.com → New Project → import
   the `sushant-patel/Trading-` repo → set root directory to `web` → deploy.
   Vercel auto-detects Vite. You'll get a public URL you can open on your phone.
5. Once deployed, every push to `main` (including the daily Action's commits)
   can optionally trigger a redeploy — Vercel does this automatically by default.

## Known limitations (be upfront about these if asked)

- Backtest in `intraday_screener.py` runs on **daily bars** as an approximation,
  not true intraday ticks — noted in the script's own docstring.
- localStorage in the web app is **per-browser**, not synced across devices.
  Making it sync (e.g. phone + PC seeing the same journal) requires a real
  backend/database (Supabase free tier is a reasonable next step) — not built yet.
- No live order execution anywhere in this project, by design — it's an
  analysis/tracking tool only.
