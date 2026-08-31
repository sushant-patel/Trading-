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

Repo: https://github.com/sushant-patel/Trading- (public)

## File map

- `intraday_screener.py` — the analysis script. Run locally with
  `python intraday_screener.py --period 6mo --json-out results.json`.
  Flags: `--period` (yfinance period string — 1mo gives too few backtested
  trades to be meaningful, see Backtest finding below), `--tickers` (override
  watchlist), `--json-out` (write results for the dashboard).
- `.github/workflows/daily_screener.yml` — GitHub Actions workflow. Runs the
  script on a cron schedule (currently 12:30 UTC, Mon–Fri, `--period 6mo`) and
  commits the resulting `results.json` back to the repo. This is what makes
  the pipeline run without the PC being on. Confirmed working — see Status below.
- `results.json` — committed to repo root by the Action. Fetched live by the
  dashboard at `https://raw.githubusercontent.com/sushant-patel/Trading-/main/results.json`
  (only works because the repo is public — a private repo's raw files aren't
  browser-fetchable without a token).
- `web/` — the Vite + React dashboard (standalone site, not a Claude artifact).
  - `web/src/App.jsx` — main component: tabs for Watchlist / Backtest /
    Calculator / Journal / Settings.
  - `web/src/components/InfoTip.jsx` — reusable click-to-open (ⓘ) tooltip used
    throughout the app to explain metrics/fields to someone new to trading.
    Viewport-aware: flips to right-aligned when it would otherwise render off
    the right edge of the screen (was a real bug on the 4th grid column).
  - `web/src/lib/currency.js` — live USD→INR rate fetch (`open.er-api.com`,
    6h localStorage cache, falls back to last cached rate if the network call
    fails). Note: `api.frankfurter.app` was tried first and rejected — it
    doesn't send CORS headers, so it silently fails from a browser context.
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
      Settings tabs, localStorage persistence
- [x] Action confirmed working — has run and committed a real `results.json`
- [x] Repo made public — `raw.githubusercontent.com/.../results.json` is live (200)
- [x] Dashboard verified end-to-end against the real public `results.json` URL
      (10/10 tickers render, no console errors)
- [x] Currency conversion (USD→INR, live rate), India tax-notes panel, and
      InfoTip (ⓘ) explanations added throughout, per user request
- [x] Fixed: zero-trade tickers no longer show a misleading colored "+0.00%"
      (now render "—", sorted to the bottom of the Backtest table)
- [x] Fixed: InfoTip popovers were clipping off-screen on the right-hand grid
      column — now viewport-aware
- [ ] Deploy `web/` to Vercel for a permanent public URL (see below)

## Next steps (suggested order)

1. Deploy `web/` to Vercel (free): go to vercel.com → New Project → import
   the `sushant-patel/Trading-` repo → set root directory to `web` → deploy.
   Vercel auto-detects Vite. You'll get a public URL you can open on your phone.
2. Once deployed, every push to `main` (including the daily Action's commits)
   can optionally trigger a redeploy — Vercel does this automatically by default.
3. Python is now installed locally (`winget install Python.Python.3.12`, at
   `C:\Users\shush\AppData\Local\Programs\Python\Python312\python.exe` — not
   yet on PATH under the `python` alias, Windows' Store alias shadows it) with
   `yfinance`/`pandas`/`numpy` installed, so the screener can be run directly
   instead of only via the Action.

## Backtest finding (6mo run, 2026-08-31)

Re-running with `--period 6mo` (now the Action's default, was `1mo`) gives a
real sample size (5-48 trades/ticker vs. 0-5 at 1mo) and it's not flattering:
**7 of 10 tickers were net negative** — only NVDA (+18.5%), AMD (+12.0%), and
META (+2.2%) showed positive edge; TSLA was the worst at -8.3% despite the
most trades (38). Small-sample 1mo win rates (several tickers showing 100%
on 1-2 trades) were not representative. Worth revisiting `TIER_RULES` in
`intraday_screener.py` (stop_frac/target_mult per tier) rather than trusting
the strategy as tuned — this is real signal that the current rules don't have
a robust edge across the watchlist, not just noise.

## Known limitations (be upfront about these if asked)

- Backtest in `intraday_screener.py` runs on **daily bars** as an approximation,
  not true intraday ticks — noted in the script's own docstring.
- Fixed 2026-08-31: `fetch_history()` could return a trailing row with NaN
  OHLC (yfinance's not-yet-populated current-session bar), which propagated
  into `last_close`/backtest results and produced invalid `NaN` tokens in
  `results.json` (would have crashed `JSON.parse` in the dashboard). Now
  dropped via `dropna()`, and `json.dump(..., allow_nan=False)` is a safety
  net so any future recurrence fails the Action loudly instead of silently
  shipping broken JSON.
- localStorage in the web app is **per-browser**, not synced across devices.
  Making it sync (e.g. phone + PC seeing the same journal) requires a real
  backend/database (Supabase free tier is a reasonable next step) — not built yet.
- No live order execution anywhere in this project, by design — it's an
  analysis/tracking tool only.
