import { runBacktest } from './backtest.js'

// Same statistical floor used everywhere else in the app (Featured Setup,
// Watch's High-Conviction strategy) — trades below this are too few to trust.
export const MIN_TRADES_FLOOR = 5
export const TIER_RULE_POOL = ['high', 'medium', 'low']

function randRange(min, max) {
  return min + Math.random() * (max - min)
}

// Random search over (ticker × entry rule × stop distance × target multiple).
// Each trial re-uses the exact same backtest engine as the Lab tab — this
// isn't a different, unverified strategy simulator, just many parameter
// combinations run through the one already-tested one.
export function runRandomSearch(tickers, trialCount) {
  const results = []
  for (let i = 0; i < trialCount; i++) {
    const t = tickers[Math.floor(Math.random() * tickers.length)]
    if (!t?.history?.length) continue
    const tierRule = TIER_RULE_POOL[Math.floor(Math.random() * TIER_RULE_POOL.length)]
    const stopFrac = Math.round(randRange(0.1, 0.6) * 100) / 100
    const targetMult = Math.round(randRange(1.0, 3.0) * 10) / 10
    const bt = runBacktest(t.history, tierRule, { stopFrac, targetMult })
    if (bt.trades < MIN_TRADES_FLOOR) continue
    results.push({
      ticker: t.ticker,
      tierRule,
      stopFrac,
      targetMult,
      trades: bt.trades,
      winRate: bt.winRate,
      totalReturn: bt.totalReturn,
    })
  }
  results.sort((a, b) => b.totalReturn - a.totalReturn)
  return results
}
