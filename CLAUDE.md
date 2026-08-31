# Trading Tracker — Project Context

## What this project is
A personal intraday-trading dashboard for a watchlist of 18 US-listed stocks
(NVDA, TSLA, AMZN, META, AVGO, AMD, MSFT, GOOGL, AAPL, JPM, NFLX, INTC, ORCL,
CRM, DIS, BAC, PLTR, INFY). It has three parts:

1. **Data pipeline** (Python + GitHub Actions) — runs on GitHub's servers on a
   schedule, fetches recent price data (daily bars, 6mo window), tiers each
   stock by volatility, applies a simple rule-based strategy per tier,
   backtests it, and publishes the results — including each ticker's full
   daily OHLC history — as `results.json` committed back to this repo.
2. **Web dashboard** (React + Vite) — a standalone website with tabs for the
   watchlist, price trend charts, the backtest table, a strategy Lab
   (client-side parameter tuning), a simulated ₹80,000 paper-trading
   portfolio, a position-size calculator, a real trade journal, a Learn/docs
   page, and settings (localStorage-backed throughout).
3. **Live quotes proxy** (Vercel serverless function, `web/api/quote.js`) —
   server-side fetch of near-real-time prices, since the upstream API blocks
   direct browser calls (no CORS headers). Only runs where Vercel executes
   it; the dashboard falls back to the daily `results.json` price everywhere
   else without erroring.

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
  - `web/src/App.jsx` — main component: tabs for Watchlist / Trends / Watch /
    Backtest / Lab / Portfolio / Calculator / Journal / Learn / Settings. Owns
    the live-quote polling loop (30s interval, `web/src/lib/liveQuotes.js`),
    the `selectedTicker` state that lets a Watchlist card (or a Watch/Grid
    row) jump straight to that ticker in Trends, and a `window` event listener
    (`tt:learn-nav`) that switches to Learn and scrolls/highlights a specific
    concept when an InfoTip's "Learn more" link is clicked.
  - `web/src/components/InfoTip.jsx` — reusable click-to-open (ⓘ) tooltip used
    throughout the app, with an optional `learnId` prop that adds a "Learn
    more →" link jumping into the matching Learn-tab glossary card (dispatched
    as a `tt:learn-nav` window event rather than threaded as a prop through
    every parent — InfoTip sits many layers deep in Watchlist/Backtest/Lab/
    Portfolio/Watch, none of which otherwise need to know navigation exists).
    Viewport-aware: flips to right-aligned when it would otherwise render off
    the right edge of the screen. Its popover resets `text-transform`/
    `letter-spacing` explicitly (nested inside elements like `.tier-badge`
    that set uppercase, which was silently inherited into the tooltip text).
    Its buttons call `stopPropagation()` — once Watchlist cards became
    clickable, clicking the (ⓘ) inside one also fired the card's own
    navigate-away handler, so the popover could never actually be seen open.
  - `web/src/components/Charts.jsx` — hand-rolled SVG charts (no charting
    library): `Sparkline` (compact, used on Watchlist cards and the Trends
    Grid view), `TrendChart` (axis labels + hover crosshair/tooltip; collapses
    to a single y-axis tick for a perfectly flat series — e.g. an equity curve
    before any P/L — instead of the `range || 1` fallback producing three
    near-duplicate labels), and `CompareChart` (multi-series % change overlay,
    direct end-labels + legend so identity never depends on color alone).
    Categorical colors come from the dataviz skill's validated dark-mode ramp,
    capped at `MAX_COMPARE = 6` tickers.
  - `web/src/components/Trends.jsx` — Single / Grid / Compare views. Grid is
    all tickers as mini sparkline cards; Compare overlays up to 6, normalized
    to % change from the timeframe start. Colors are assigned by each
    ticker's position *within the current selection*, not its fixed index in
    the full watchlist — indexing by the full list caused an actual bug
    (`idx % 6` collided every 6 tickers, so NVDA [index 0] and ORCL [index
    12] rendered as identical blue when selected together).
  - `web/src/components/Watch.jsx` — "Tomorrow's Watch": every ticker's exact
    trigger level for the next session and how far away it is, sorted
    closest-first. Explicitly not a price prediction — see `lib/signals.js`.
  - `web/src/components/Portfolio.jsx` — the simulated ₹80,000 paper-trading
    tab. Opening a position converts an INR amount to USD at the current live
    FX rate, buys fractional shares at the current price (live quote if
    available, else the daily `last_close`), stores an optional reason/
    prediction, and auto-computes a hypothetical stop/target from that
    ticker's tier rule (`lib/signals.js`) — open positions show a status flag
    when price is near/past either. Closing realizes P/L back into total
    capital; a "Capital Over Time" chart is derived entirely from closed
    positions (starting capital + cumulative realized P/L per close), no
    separate history log needed. Entirely localStorage-backed
    (`tt_paper_portfolio`), no backend, no real orders anywhere.
  - `web/src/components/Learn.jsx` — the in-app documentation tab: getting
    -started steps, a concepts glossary (each card has a stable `id` for
    `InfoTip`'s "Learn more" links, and a couple carry verified external
    reference links — Wikipedia/SEC/etc., only URLs actually confirmed by a
    web search, never typed from memory), a per-tab guide, and a limitations
    list, with an anchor-nav that scrolls to each section. Accepts a
    `focusId` prop that scrolls to and briefly highlights one concept card.
  - `web/src/lib/backtest.js` — client-side port of `backtest_daily_breakout()`
    from `intraday_screener.py`, used by the Lab tab so strategy params can be
    tuned live against real history with no server round-trip. Verified to
    match the Python output to 4 decimal places across all tickers. Note:
    in the original script's own logic, `stop_frac` only affects the `high`
    tier (medium/low hardcode their stop to the day's low) — the Lab disables
    that slider for medium/low so this isn't mistaken for a bug.
  - `web/src/lib/signals.js` — `computeTriggerLevel()` (powers the Watch tab)
    and `computeHypotheticalStopTarget()` (powers Portfolio's auto stop/target).
    Neither predicts direction; both compute exact levels from data already
    known today, mirroring backtest.js's own per-tier entry math. The Medium
    tier's trigger level is a stated approximation (today's SMA20, since the
    real next-session SMA20 depends on that session's own unknown close).
  - `web/src/lib/currency.js` — live USD→INR rate fetch (`open.er-api.com`,
    6h localStorage cache, falls back to last cached rate if the network call
    fails). Note: `api.frankfurter.app` was tried first and rejected — it
    doesn't send CORS headers, so it silently fails from a browser context.
  - `web/src/lib/liveQuotes.js` — client-side fetch of `/api/quote`. Returns
    `null` on any failure (including 404, e.g. plain `vite dev` with no API
    routes) so the caller can fall back silently instead of erroring.
  - `web/api/quote.js` — Vercel serverless function. Proxies
    `query2.finance.yahoo.com`'s chart endpoint server-side (confirmed via
    curl that it sends no CORS header, so the browser can't call it
    directly), validates requested symbols against the watchlist (rejects
    anything else — tested with injection-style input), and returns
    `{ quotes, fetchedAt }`. Only executes on Vercel; there's no equivalent
    for local `vite dev`.
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
      "total_return_pct": 3.1,
      "history": [
        { "date": "2026-03-02", "open": 118.4, "high": 121.2, "low": 117.1, "close": 120.3 }
      ]
    }
  ]
}
```
`history` is the full daily-bar series already fetched for the backtest (one
entry per trading day in the window) — added so the dashboard's Trends chart
and Lab tab can work entirely off this one file instead of calling a price API
from the browser. At `--period 6mo` with 18 tickers this makes `results.json`
~380KB, still a single fast fetch.

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
- [x] Fixed: InfoTip popover text was rendering in inherited ALL CAPS from
      ancestor elements (`.tier-badge`, table `th`) — reset explicitly now
- [x] Deployed to Vercel — live public URL (see top of this file / ask the
      user, it's per-deployment and not hardcoded here)
- [x] `history` (full daily OHLC series) added to `results.json` per ticker —
      reuses data already fetched for the backtest, no new API calls
- [x] Trends tab — per-ticker price chart with hover crosshair/tooltip
- [x] Watchlist cards — compact sparkline per ticker (green/red by period direction)
- [x] Lab tab — client-side backtest tuning (stop distance / target multiple
      sliders) against real history, recomputes live; verified to match the
      Python backtest to 4 decimal places
- [x] Featured Setup panel (on the Backtest tab) — automatically picks the
      highest-return ticker among those with ≥5 trades (avoids small-sample
      luck), re-ranks itself as `results.json` updates; explicitly labeled
      "not a recommendation"
- [x] Watchlist expanded 10 → 18 tickers (added NFLX, INTC, ORCL, CRM, DIS,
      BAC, PLTR, INFY) for more spread across tiers/sectors
- [x] Watchlist cards are clickable — jumps to Trends with that ticker selected
- [x] Trends tab: 1M / 3M / All timeframe filter (client-side slice of the
      already-loaded history, no re-fetch)
- [x] Live prices: `web/api/quote.js` Vercel serverless proxy + 30s client
      polling, overlaid on Watchlist and Portfolio with a green live-dot;
      falls back silently to daily `results.json` prices when unavailable
      (always the case on local `vite dev`, which has no `/api` routes)
- [x] Portfolio tab: simulated ₹80,000 paper-trading account — open/close
      positions, unrealized/realized P/L, persisted in localStorage
- [x] Learn tab: getting-started steps, concepts glossary, per-tab guide,
      and a limitations list
- [x] Alignment fix: Trends' timeframe buttons vs. ticker `<select>` had a
      persistent 3-4px height mismatch even with identical padding — browsers
      render `<select>`/`<button>` intrinsic sizing differently; fixed with
      an explicit `height` on both instead of relying on padding parity
- [x] Trends: Grid view (all 18 as mini sparkline cards) and Compare view
      (overlay up to 6, normalized to % change, dataviz-palette colors)
- [x] Watch tab ("Tomorrow's Watch"): exact trigger level per ticker for the
      next session, sorted by distance — mechanical, not a prediction
- [x] Portfolio: reason/prediction field per position, auto-computed
      stop/target with a near/at status flag, and a Capital Over Time chart
      derived from closed positions
- [x] Learn: InfoTip "Learn more →" links jump to the matching glossary card
      (cross-tab nav via a `tt:learn-nav` window event) and highlight it
      briefly; a few concepts carry verified external reference links
- [x] Fixed real bug: Compare-view color assignment indexed by each ticker's
      fixed position in the full 18-ticker list (`idx % 6`), which collided
      every 6 tickers — NVDA and ORCL rendered as identical blue when both
      selected. Now colors by position within the current selection instead
- [x] Fixed real bug: InfoTip's (ⓘ) button didn't stop event propagation, so
      clicking it inside a (now-clickable) Watchlist card also fired the
      card's own navigate-away handler — the popover could never be seen
- [x] Fixed real bug: `TrendChart`'s x-axis tick calculation could produce
      duplicate indices with very few data points (e.g. a 2-point equity
      curve), causing a React duplicate-key warning; also collapsed the
      y-axis to one tick for a perfectly flat series (was showing near-
      duplicate labels off the `range || 1` fallback)

## Next steps (suggested order)

1. Python is now installed locally (`winget install Python.Python.3.12`, at
   `C:\Users\shush\AppData\Local\Programs\Python\Python312\python.exe` — not
   yet on PATH under the `python` alias, Windows' Store alias shadows it) with
   `yfinance`/`pandas`/`numpy` installed, so the screener can be run directly
   instead of only via the Action.
2. Consider whether `TIER_RULES` (stop_frac/target_mult per tier in
   `intraday_screener.py`) need retuning given the Backtest finding below —
   the Lab tab is now the tool for experimenting with that live.

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
