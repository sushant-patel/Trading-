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

## India (Nifty 100) module — added 2026-09-02

A second, parallel module for real NSE-listed Indian stocks, extending the
same architecture rather than being a separate project (user's explicit
choice via `AskUserQuestion`). Genuinely different from the US side in ways
that shaped the design:

- **Real Indian market, not LRS.** These are tradeable via a normal Indian
  demat account — no Liberalised Remittance Scheme, no USD→INR conversion
  anywhere in this module. `entryPriceInr`/`stopPriceInr`/etc., never `Usd`.
- **Universe**: Nifty 100 (Nifty 50 + Nifty Next 50), 100 `.NS` tickers.
  Sourced from Wikipedia's NIFTY_50/NIFTY_Next_50 pages and individually
  verified against real `yfinance` data before being trusted — a first-pass
  scrape from a secondary aggregator site (smart-investing.in) had visibly
  wrong/duplicate tickers (e.g. Bajaj Finance mapped to Bajaj Finserv's own
  symbol `BAJAJFINSV`). Never trust a scraped ticker list without checking
  it against live data first; this bit once already.
- **"Real-time" redefined around a real platform limit.** Claude Code
  scheduled routines cannot fire more than once per hour. So "real-time
  paper trading" here means: an out-of-sample-validated strategy (same
  70/30 train/test methodology as the US Discover tab) forward-paper-traded
  with hourly stop/target checks during NSE hours (9:15 AM–3:30 PM IST),
  not continuous. This was surfaced to the user explicitly before building,
  not silently redefined.
- **The live-price gap.** `results_in.json` only refreshes once/day
  (pre-market), so without a fix, "hourly" checks would all see the same
  stale price all session. Cloud routines also can't fetch a live price
  themselves — confirmed unable to reach `yfinance`/Yahoo endpoints, same
  restriction as the FX-rate issue on the US side (see "Cloud routine
  network restrictions" below). Fixed with `fetch_live_price_in.py`, a
  GitHub Action (unrestricted network) that fetches ONE current price —
  for whichever ticker is held, or the current `best_ever` candidate if
  nothing's held yet — and publishes it to `live_price_in.json` for the
  hourly routine to read.
- **News/sentiment**: `WebSearch` IS reachable from the CCR sandbox
  (confirmed by direct test — see "Cloud routine network restrictions"),
  but `WebFetch` to specific article URLs is NOT (confirmed blocked on
  moneycontrol.com and economictimes.indiatimes.com). The hourly routine
  does one `WebSearch` per prospective new position as a soft informational
  check — it can skip opening on something genuinely severe (trading halt,
  fraud probe, delisting), but a search failure or ordinary noise never
  blocks a combination that already cleared out-of-sample validation.

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

## Cloud routine network restrictions (discovered 2026-08-31)

Claude Code cloud routines (the `schedule` skill / `RemoteTrigger`) run inside
a sandbox ("CCR") whose network egress proxy only allows `raw.githubusercontent.com`,
`github.com`/`api.github.com`, package registries (npm/pypi/crates/Go proxy),
and `api.anthropic.com`. Every other host — confirmed with both `curl` and the
`WebFetch` tool against `open.er-api.com` (FX rate) and Yahoo Finance's chart
endpoints — returns a hard 403 / `EGRESS_BLOCKED`, every time, not a transient
failure. This is specific to the CCR sandbox: the exact same calls work fine
from the user's own browser, from a Vercel serverless function
(`web/api/quote.js`), and from the GitHub Actions runner (`daily_screener.yml`).

This silently broke the portfolio-management routine the first time it ran
(session `cse_0139CoAf1NEXdosR2biR9EUq`) — it correctly refused to fabricate
prices and reported the failure via `PushNotification` rather than guessing,
but no positions got opened. **The fix**: `intraday_screener.py` now fetches
and publishes a same-day USD→INR rate (`fetch_usd_inr_rate()`, via
`yf.Ticker("USDINR=X")`) as a top-level `usd_inr_rate` field in `results.json`
(see Data contract below), and every price a routine needs is already in
`results.json` as each ticker's `last_close`. **Any future cloud routine for
this project must get FX rate and prices from `results.json` (fetched via
`raw.githubusercontent.com`, which works), never by calling a live FX/quote
API directly** — it will not work, don't spend a run re-discovering this.

## File map

- `screener_core.py` — the shared analysis engine (fetch_history/analyze/
  backtest_daily_breakout/TickerResult/DEFAULT_TIER_RULES), extracted from
  `intraday_screener.py` so both the US and India runner scripts share one
  tested implementation instead of drifting apart. Both `TIER_RULES` and
  `analyze()`'s tier_rules parameter exist specifically so India can be
  re-tuned independently of the US watchlist once the Discover search has
  enough signal, without forking the actual backtest math.
- `intraday_screener.py` — the US analysis script. Run locally with
  `python intraday_screener.py --period 6mo --json-out results.json`.
  Flags: `--period` (yfinance period string — 1mo gives too few backtested
  trades to be meaningful, see Backtest finding below), `--tickers` (override
  watchlist), `--json-out` (write results for the dashboard).
- `intraday_screener_in.py` — the India (Nifty 100) counterpart. Run with
  `python intraday_screener_in.py --period 6mo --json-out results_in.json`.
  Same flags. `WATCHLIST` here is the verified 100-ticker `.NS` list (see
  the India module section above for how it was sourced/verified) — don't
  hand-edit tickers into this list without checking them against live
  `yfinance` data first.
- `fetch_live_price_in.py` — the India live-price bridge (see India module
  section above). Run on a GitHub Actions runner via `live_price_in.yml`,
  not locally in normal use, though it works locally for testing (reads
  `portfolio_in.json` and `strategy_search_in.json` from the cwd).
- `.github/workflows/daily_screener.yml` — GitHub Actions workflow. Runs the
  script on a cron schedule (currently 12:30 UTC, Mon–Fri, `--period 6mo`) and
  commits the resulting `results.json` back to the repo. This is what makes
  the pipeline run without the PC being on. Confirmed working — see Status below.
- `results.json` — committed to repo root by the Action. Fetched live by the
  dashboard at `https://raw.githubusercontent.com/sushant-patel/Trading-/main/results.json`
  (only works because the repo is public — a private repo's raw files aren't
  browser-fetchable without a token).
- `.github/workflows/daily_screener_in.yml` — India counterpart, runs
  `intraday_screener_in.py --period 6mo --json-out results_in.json` at
  2:00 UTC / 7:30 AM IST weekdays (well before NSE's 9:15 AM open — IST has
  no DST, unlike the US action's ET offset, so this stays correct year-round).
- `.github/workflows/live_price_in.yml` — the India live-price bridge Action,
  every 30 min during 3:45–9:45 UTC weekdays (see India module section
  above for why this exists). Single-ticker fetch, deliberately light.
- `results_in.json` / `strategy_search_in.json` / `portfolio_in.json` /
  `live_price_in.json` — India counterparts, see Data contract below.
- `web/` — the Vite + React dashboard (standalone site, not a Claude artifact).
  - `web/src/App.jsx` — main component: tabs for Watchlist / Trends / Watch /
    Backtest / Lab / Discover / Portfolio / India / Notes / Learn / Settings. Owns
    the live-quote polling loop (30s interval, `web/src/lib/liveQuotes.js`),
    the `selectedTicker` state that lets a Watchlist card (or a Watch/Grid
    row) jump straight to that ticker in Trends, and a `window` event listener
    (`tt:learn-nav`) that switches to Learn and scrolls/highlights a specific
    concept when an InfoTip's "Learn more" link is clicked.
    **Calculator and Journal were removed from navigation** (user: "I will
    not do much there," wants everything automated instead) — their
    components (`Calculator`, `Journal`) and supporting state
    (`journal`/`addJournalEntry`/`deleteJournalEntry`/`STORAGE_KEYS.journal`)
    are still defined in this file, just unreferenced, same pattern as the
    old localStorage `Portfolio.jsx`/`Portfolios.jsx` — left in case a manual
    tool is wanted again later, not deleted outright. Every "Calculator tab"/
    "Journal tab" cross-reference elsewhere (Learn, IntradayBasics, the Tax
    Notes panel) was also updated when this happened — check for stray
    mentions of either if either ever comes back, or if another tab is
    hidden the same way in the future.
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
  - `web/src/components/India.jsx` — the India (Nifty 100) tab, self-
    contained (fetches its own `results_in.json`/`strategy_search_in.json`/
    `portfolio_in.json`/`live_price_in.json`, doesn't depend on the US tab's
    already-loaded `data`). Three internal sub-views (Watchlist/Discover/
    Portfolio), reusing `lib/strategySearch.js`/`lib/currency.js`'s
    `formatInr` directly since those are already market-agnostic. Watchlist
    is a sortable table, not cards — 100 tickers doesn't scale as cards the
    way 18 does. Discover's `TrainTestTable` is a straight port of the US
    Discover.jsx's CURRENT pattern (separate Train/Test return columns) —
    written correctly only on a second pass; the first draft mistakenly
    copied an OLDER, pre-validation shape of Discover.jsx from earlier
    session context and silently showed a combo's train return in a column
    meant to show test return. Caught via Playwright screenshot before
    commit, not shipped. If Discover.jsx's `TrainTestTable`/`ReturnCell`
    pattern changes again, update this file's copy too — it's a deliberate
    duplication (kept self-contained per the India module's design) not an
    import, so the two won't auto-sync.
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
  "usd_inr_rate": 95.152,
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
~380KB, still a single fast fetch. `usd_inr_rate` (added 2026-08-31, via
`yf.Ticker("USDINR=X")`) exists specifically so cloud routines — which can't
reach a live FX API from their sandbox, see "Cloud routine network
restrictions" above — have a same-day rate without any external call.

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
parameter-search result — `{updated_at, period, train_fraction,
min_trades_floor, min_test_trades_floor, trials_last_run, trials_total_ever,
leaderboard: [{ticker, tierRule, stopFrac, targetMult, trainTrades,
trainWinRate, trainReturn, testTrades, testWinRate, testReturn, validated},
...], validated_leaderboard: [...same shape, validated=true only...],
best_ever: {..., testReturn, foundOn}, run_history: [{date, bestTrainReturn,
bestValidatedReturn, trialsRun}, ...]}`. Produced by
`web/src/lib/strategySearch.js`'s `runRandomSearch()` (ticker × entry rule ×
stop distance × target multiple, run through the same `backtest.js` engine
the Lab tab uses), read by the Discover tab. **Out-of-sample validated as of
2026-08-31**: each ticker's history is chronologically split 70/30
(`splitHistory()`, `TRAIN_FRACTION`) before a trial runs — parameters are
fit on the train slice only, then re-checked, unmodified, against the test
slice it never saw. A result only counts as `validated: true` if it clears
`MIN_TEST_TRADES_FLOOR` (2) trades on test AND stays profitable there;
`best_ever`/`validatedLeaderboard()` only ever surface validated results.
This was added specifically because the leaderboard's own top *training*
results are a real, visible example of overfitting — e.g. an INTC combo
with train return +57% collapses to test return -14% (8 trades) — while a
few results (ORCL medium/high variants, MSFT high) hold up on both sides.
Don't strip the Discover tab's overfitting callout, and don't let `best_ever`
regress to tracking unvalidated training performance again.

### India (Nifty 100) data files

`results_in.json` (repo root) — same shape as `results.json` plus
`market: "NSE"` and `currency: "INR"` at the top level, no `usd_inr_rate`
field (not needed — prices are already INR). 100 tickers, `.NS` suffix.
Published by `daily_screener_in.yml`. At ~2.2MB (100 tickers × 6mo history,
vs. `results.json`'s ~380KB for 18) it's noticeably heavier — still a single
fetch, gzipped by GitHub's raw serving, but worth knowing if load time ever
becomes a concern.

`strategy_search_in.json` (repo root) — identical schema to
`strategy_search.json` plus `market`/`currency`, produced by the exact same
`runRandomSearch()`/`validatedLeaderboard()` (market-agnostic, no changes
needed) run against `results_in.json`'s tickers instead. Updated daily by
the "Trading Tracker (India) - Daily Search Refresh" routine
(`trig_01S4RvSvm3vumfC3zpMdbwAE`, cron `15 2 * * 1-5`, ~15 min after
`daily_screener_in.yml`).

`portfolio_in.json` (repo root) — single strategy, `discovered_in`
(`{label, description, positions: [...]}`), no top-level `strategies`
fan-out like `portfolios.json` since there's only the one India strategy so
far. Position shape: `{id, ticker, tierRule, stopFrac, targetMult, status,
openDate, entryPriceInr, allocatedInr, shares, stopPriceInr, targetPriceInr,
reason, closeDate?, exitPriceInr?, realizedPnlInr?}` — **no FX fields
anywhere** (`fxRateAtOpen` etc. from `portfolios.json` don't apply here,
prices are natively INR). Managed by the "Trading Tracker (India) - Hourly
Forward Paper Trading" routine (`trig_01TmSvG9gq2xs1kAtpMHVvmZ`, cron
`50 3-9 * * 1-5`, ~5 min after each `live_price_in.yml` fire) — only commits
when a position actually opens or closes, not every no-op hourly check.

`live_price_in.json` (repo root) — `{ticker, price, fetched_at}` (or
`ticker: null, price: null` when nothing to price yet). Published every
30 min during NSE hours by `live_price_in.yml` (a GitHub Action, unrestricted
network — see India module section above for why this bridge exists at
all). The hourly routine only trusts this file's price if its `ticker`
matches what it's checking AND `fetched_at` is today's UTC date; otherwise
it falls back to `results_in.json`'s `last_close` for that ticker.

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
- [x] Calculator and Journal tabs removed from navigation (user: wants
      automation, not manual entry) — components left in the tree, unused.
- [x] Discover tab rebuilt with out-of-sample validation (70/30 train/test
      split per ticker, `validated` flag, separate validated leaderboard) —
      see the `strategy_search.json` schema section above for the full
      before/after and the real overfitting example it surfaces.
- [x] 4th simulated portfolio, `discovered`, added — always tracks
      `strategy_search.json`'s validated `best_ever` combo.
- [x] Daily automation expanded: "Trading Tracker - Discover & Manage
      Portfolios" routine (`trig_01W694o9UA14tJByCF41L5AB`, cron
      `12 13 * * 1-5`) runs the out-of-sample search, updates
      `strategy_search.json`, runs stop/target checks on all 4 portfolios,
      keeps `discovered` in sync with `best_ever`, and — since 2026-08-31 —
      also self-heals: opens each rule-based portfolio's very first position
      if it has none yet, rather than depending on a separate one-time
      trigger. All FX/price needs come from `results.json` (`usd_inr_rate`,
      `last_close`) per the "Cloud routine network restrictions" section
      above; a standalone one-time "Open Positions at Market Open" routine
      (`trig_01VzeFNPUadBGxc1aUGdjUU3`) was tried first, failed on exactly
      this network restriction, and is now superseded by the self-healing
      logic in the recurring routine — that one-time trigger is left
      disabled (`ended_reason: run_once_fired`) rather than deleted.
- [x] India (Nifty 100) module — added 2026-09-02, see the dedicated
      CLAUDE.md section near the top for the full design (real NSE
      data, no LRS/FX, hourly-not-continuous "real-time", the live-
      price bridge, WebSearch-only news). Concretely: `screener_core.py`
      extraction, `intraday_screener_in.py` (100 verified tickers),
      `daily_screener_in.yml`, an out-of-sample search port
      (`strategy_search_in.json`), `portfolio_in.json` (single
      `discovered_in` strategy), `fetch_live_price_in.py` +
      `live_price_in.yml` (the live-price bridge), two new scheduled
      routines (`trig_01S4RvSvm3vumfC3zpMdbwAE` daily search refresh,
      `trig_01TmSvG9gq2xs1kAtpMHVvmZ` hourly forward paper trading),
      and a new India tab in the dashboard (`web/src/components/
      India.jsx`: Watchlist/Discover/Portfolio sub-views). Verified
      end-to-end for real: the hourly routine opened its first real
      position (DIVISLAB.NS, ₹9220 entry) using a live-price-bridge
      quote, a WebSearch news check, and the actual `signals.js`
      stop/target formula — confirmed rendering correctly in the
      dashboard via Playwright screenshots before anything was
      reported done. TIER_RULES not yet re-tuned for Indian-stock
      volatility (still the US defaults) — that's what the daily
      search refresh is for over time, same as the US side's own
      un-retuned `TIER_RULES` (see Backtest finding below).

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
