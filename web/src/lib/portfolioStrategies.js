import { computeFeaturedSetup } from './featured.js'
import { computeTriggerLevel } from './signals.js'

export const HIGH_CONVICTION_THRESHOLD_PCT = 1.5

// Three independent ₹80,000 paper portfolios, each constrained to a
// different rule, meant to run side by side for 1-2 weeks so the approaches
// can actually be compared before any real money moves. Each gets its own
// full ₹80,000 (not a split) so none cramps another's position sizing.
export const PORTFOLIO_STRATEGIES = [
  {
    id: 'featured',
    label: 'Featured Setup Only',
    storageKey: 'tt_paper_portfolio_featured',
    description:
      "Only the ticker currently ranked #1 by Featured Setup (highest backtested return among tickers with ≥5 trades) is allowed. Tests whether following this site's own top-ranked pick, and only that pick, actually pays off.",
    getAllowedTickers(data) {
      const featured = computeFeaturedSetup(data.tickers)
      return featured ? [featured.ticker] : []
    },
    emptyMessage: 'No ticker currently qualifies as Featured Setup (needs ≥5 backtested trades this window) — check back once more data accumulates.',
  },
  {
    id: 'diversified',
    label: 'Diversified',
    storageKey: 'tt_paper_portfolio_diversified',
    description:
      'Any ticker is allowed — the discipline here is spreading positions across different volatility tiers (High/Medium/Low) instead of concentrating in one. Tests whether spreading across tiers helps or just dilutes whatever edge exists.',
    getAllowedTickers(data) {
      return data.tickers.map((t) => t.ticker)
    },
  },
  {
    id: 'highconviction',
    label: 'High-Conviction Triggers',
    storageKey: 'tt_paper_portfolio_highconviction',
    description: `Only tickers currently within ${HIGH_CONVICTION_THRESHOLD_PCT}% of their trigger level (per the Watch tab) are allowed. Tests whether waiting for a near-trigger setup improves outcomes over trading whenever.`,
    getAllowedTickers(data) {
      return data.tickers
        .filter((t) => {
          const trig = computeTriggerLevel(t.history, t.tier)
          return trig && Math.abs(trig.distancePct) <= HIGH_CONVICTION_THRESHOLD_PCT
        })
        .map((t) => t.ticker)
    },
    emptyMessage: `No ticker is currently within ${HIGH_CONVICTION_THRESHOLD_PCT}% of a trigger level — check the Watch tab, or wait for tomorrow's data.`,
  },
]
