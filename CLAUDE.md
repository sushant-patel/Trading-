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
   watchlist, price trend charts (Single/Grid/Compare), Tomorrow's Watch
   (trigger levels), the backtest table, a strategy Lab (client-side
   parameter tuning), a simulated ₹80,000 paper-trading portfolio, a
   Daily Notes log, a position-size calculator, a real trade journal, a
   Learn/docs page (including an Intraday Trading Basics section), and
   settings (localStorage-backed throughout).
3. **Live quotes proxy** (Vercel serverless function, `web/api/quote.js`) —
   server-side fetch of near-real-time prices, since the upstream API blocks
   direct browser calls (no CORS headers). Only runs where Vercel executes
   it; the dashboard falls back to the daily `results.json` price everywhere
   else without erroring.

Repo: https://github.com/sushant-patel/Trading- (public)

## Important context: intraday trading mechanics (India vs. US stocks)

Researched 2026-08-31, worth re-verifying before relying on it long after —
tax/regulatory details change with Budgets and rule updates:

- **The whole watchlist is US-listed stocks.** For an Indian resident, that
  means trading them happens under the RBI's Liberalised Remittance Scheme
  (LRS) via a platform like INDmoney, Vested, Groww US stocks, or IBKR — not
  a plain Indian demat/trading account.
- **No margin/leverage on US stocks from India.** RBI rules explicitly
  prohibit using LRS-remitted funds for margin or margin calls on overseas
  exchanges. Every US-stock trade from India is a plain cash trade — the 5x
  leverage available on Indian NSE/BSE intraday (MIS) orders does not apply
  here, at all.
- **Same-day round trips are broker-dependent, not universal.** Some
  platforms (INDmoney, per their own docs) allow buying and selling the same
  US stock same-session with proceeds available immediately; others lock
  sale proceeds until T+2/T+3 settlement and don't practically support it.
  This should never be assumed — the user needs to confirm with their actual
  broker.
- **Indian NSE/BSE intraday (MIS)**, for contrast: 9:15 AM–3:30 PM IST,
  SEBI mandates a 20% minimum margin (up to 5x leverage), brokers auto-square-
  off open MIS positions from ~3:15 PM.
- **US PDT rule**: the $25,000 Pattern Day Trader rule / 3-trades-per-5-days
  restriction was eliminated by the SEC effective June 4, 2026, replaced by
  FINRA Rule 4210's proportional-equity framework. Moot for LRS-based Indian
  investors anyway, since they're on cash accounts, not US margin accounts.
- **Risk reality**: SEBI reported ~87.7% of individual equity-derivatives
  (F&O) traders lost money in FY2026 (₹91,685 crore total) — cited in the
  Learn tab's Intraday Basics section as a sobering, if not directly
  equivalent, data point (that stat is about F&O, not cash intraday equity).

This is written into `web/src/components/IntradayBasics.jsx` (the Learn tab's
"Intraday Trading Basics" section) — update both places if anything here
needs revising.

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
    separate history log needed. No backend, no real orders anywhere. Now a
    generic component parameterized by a `strategy` prop (id/label/
    description/storageKey/getAllowedTickers) rather than a single portfolio
    — see `Portfolios.jsx` below.
  - `web/src/components/Portfolios.jsx` + `web/src/lib/portfolioStrategies.js`
    — three independent simulated ₹80,000 portfolios running side by side
    (each gets its own full ₹80,000, not a split), so different approaches
    can be compared over a 1-2 week evaluation window before real money:
    **Featured Setup Only** (ticker dropdown locked to whatever currently
    ranks #1 in Featured Setup), **Diversified** (any ticker, no hard
    constraint — the discipline is spreading across tiers), **High-
    Conviction Triggers** (ticker dropdown locked to whichever tickers are
    within 1.5% of their Watch-tab trigger level). Each strategy gets its
    own localStorage key (`tt_paper_portfolio_<id>`) so they never collide.
    A "Compare All" view (`lib/portfolioSummary.js`) shows all three side by
    side without mounting three full `Portfolio` instances.
  - `web/src/lib/featured.js` — `computeFeaturedSetup()`, the single source
    of truth for "Featured Setup" ranking (≥5 trades, highest
    `total_return_pct`), shared by the Backtest tab's callout and the
    Portfolios tab's "Featured Setup Only" strategy so they can't drift out
    of sync with each other.
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
  - `web/src/components/IntradayBasics.jsx` — the Learn tab's "Intraday
    Trading Basics" section, restructured as a 7-part interactive accordion
    (What Is Intraday / Account Types / Reading a Chart / Risk Management /
    A Strategy to Study / Money Reality / Your 4-Week Path) with a
    "mark as reviewed" checkbox per section, persisted to localStorage
    (`tt_learn_basics_reviewed`) and shown as a progress bar. Includes several
    hand-rolled SVG illustrations (NSE timeline, candlesticks, support/
    resistance), an interactive position-size mini-calculator (live, no
    persistence, just for building intuition), and a checkable "10 golden
    rules" list (`tt_learn_rules_checked`). Most important content: the
    India-vs-US-stocks trading-mechanics callout (see the dedicated section
    above), the corrected FINRA PDT-replacement details (June 2026 effective,
    transition through Oct 2027, $2,000 margin minimum), and the NRA tax
    clarification (Indian residents generally don't owe US capital-gains tax
    on stock trades, per IRS rules — only dividend withholding applies).
    Verified external reference links only (FINRA, IRS, RBI, and others).
  - `web/src/components/DailyNotes.jsx` — reads `daily_notes.json` (same
    pattern as `results.json`) and renders it as a dated log. Currently has
    exactly one manually-seeded entry — the tab says so plainly. Turning this
    into an actual daily-updating log needs a scheduled routine (e.g. via the
    `schedule` skill) that hasn't been set up — that's a real recurring
    automated commitment and should get explicit user confirmation before
    being wired up, the same way the GitHub Action was.
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

`daily_notes.json` (repo root, same public-fetch pattern) is a separate,
*accumulating* log — `{"entries": [{date, generated_at, author, summary,
featured, runner_up, watch_highlights, notes}, ...]}` — read by the Notes tab.
Unlike `results.json`, this one should be appended to, not overwritten.

`portfolios.json` (repo root, same pattern) is the **authoritative state**
for 4 named paper-trading strategies (`featured`/`diversified`/
`highconviction`/`discovered`) — `{updated_at, starting_capital_inr, note,
strategies: {<id>: {label, description, positions: [{id, ticker, tier,
status, openDate, entryPriceUsd, fxRateAtOpen, allocatedInr, shares, reason,
stopPriceUsd, targetPriceUsd, closeDate?, exitPriceUsd?, fxRateAtClose?,
realizedPnlInr?}, ...]}}}`. This is a real architecture decision, not an
incidental one: Portfolio positions used to live in browser localStorage
(one browser, one user) — but the user explicitly wants Claude to manage
these portfolios via scheduled routines, and a scheduled cloud agent can't
write to a specific person's browser storage. So state moved server-side,
published here, read by `ManagedPortfolios.jsx` (which replaced the old
localStorage-based `Portfolios.jsx`/`Portfolio.jsx` for the Portfolio tab —
those files are still in the tree, unused, in case a future *manual*
user-driven portfolio feature is wanted again). Whatever process manages
this file should always read-modify-write (fetch current state, only add/
close positions, never blindly overwrite) since it's meant to accumulate
over the whole study. `discovered` is special: it's meant to always track
whatever `strategy_search.json`'s `best_ever` currently is — closing and
reopening when the search finds something new — see below.

`strategy_search.json` (repo root, same pattern) is the automated random
parameter-search result — `{updated_at, period, min_trades_floor,
trials_last_run, trials_total_ever, leaderboard: [{ticker, tierRule,
stopFrac, targetMult, trades, winRate, totalReturn}, ...], best_ever: {...,
foundOn}, run_history: [{date, bestReturn, trialsRun}, ...]}`. Produced by
`web/src/lib/strategySearch.js`'s `runRandomSearch()` (ticker × entry rule ×
stop distance × target multiple, run through the same `backtest.js` engine
the Lab tab uses), read by the new Discover tab. **This is genuinely prone
to overfitting/data-dredging** (many random trials against one fixed
history will surface spuriously good results by chance) — the Discover tab
says so prominently and the leaderboard's own top results (several near-
identical ORCL/medium variants clustering with only ~12 trades each) are a
real, visible example of exactly that, not a hypothetical caveat. Don't
strip that warning out even if it seems redundant later.

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
- [x] Learn: "Intraday Trading Basics" section — illustrated NSE timeline,
      intraday-vs-delivery comparison, and the India/US-stocks trading-
      mechanics callout (see the dedicated CLAUDE.md section above); researched
      via web search (Indian + international sources), not written from memory
- [x] Notes tab + `daily_notes.json`: reads an accumulating log, currently
      one manually-seeded real entry (2026-08-31) — see Next steps for what's
      needed to make this actually update daily
- [x] Multi-portfolio: 3 independent ₹80,000 portfolios (Featured Setup Only,
      Diversified, High-Conviction Triggers) for a 1-2 week comparison study
      before real money — user chose this structure explicitly over a split-
      budget or single-portfolio alternative
- [x] Daily automation: set up as a Claude Code scheduled routine (cloud, not
      a GitHub Action — needed judgment/summarization, not pure computation).
      Routine "Trading Tracker - Daily Notes", id `trig_01CjgvRHfmg2g3qTSddGie1q`,
      cron `0 13 * * 1-5` (13:00 UTC / 6:30 PM IST weekdays, ~30min after the
      existing data-pipeline Action). Required connecting GitHub access for
      cloud routines specifically (separate from the local git credentials
      already in use) — user installed the Claude GitHub App to unblock it.
      Each run: fetch results.json → Featured Setup + runner-up → Watch
      trigger levels (mirrors lib/signals.js) → grounded summary (explicitly
      no invented claims, not investment advice) → append-not-overwrite to
      daily_notes.json, skip if today's entry exists → commit & push.
- [x] Intraday Trading Basics rebuilt as an interactive accordion with
      progress tracking, an interactive position-size mini-calculator, and a
      checkable rules list — see the file map entry above for the full list
      of what's in each of the 7 sections. Content checked/expanded against a
      beginner guide the user provided, with several claims (FINRA's PDT
      replacement transition date, the NRA tax treatment) verified via web
      search before being written in, not taken as given.

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
