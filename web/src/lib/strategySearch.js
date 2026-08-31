import { runBacktest } from './backtest.js'

// Same statistical floor used everywhere else in the app (Featured Setup,
// Watch's High-Conviction strategy) — trades below this are too few to trust.
export const MIN_TRADES_FLOOR = 5
// The test slice is short (~30% of 6mo ≈ 5-6 weeks), so very few trades will
// fire in it for most (ticker, rule) combos. A floor of 2 is deliberately low
// — it's "at least some out-of-sample evidence exists", not "statistically
// solid". Treat "validated" as a weak signal, stronger than nothing, much
// weaker than the word usually implies.
export const MIN_TEST_TRADES_FLOOR = 2
export const TRAIN_FRACTION = 0.7
export const TIER_RULE_POOL = ['high', 'medium', 'low']

function randRange(min, max) {
  return min + Math.random() * (max - min)
}

// Chronological split: everything before the split point is "train" (what
// the search optimizes against), everything after is "test" (never touched
// while picking parameters, only used afterward to check the pick still
// works). This is THE fix for the overfitting problem the Discover tab warns
// about — a combo that only looks good on the exact data it was tuned to is
// not evidence of anything; a combo that also works on data it never saw is.
//
// Known approximation: the first ~10-20 rows of the test slice have less
// lookback context than they would with the full history available (medium
// tier's 20-day SMA and low tier's 10-day-low both need prior rows) — the
// existing rolling-window code in backtest.js already degrades gracefully
// with fewer points rather than breaking, so this just means the first couple
// of weeks of the test period are slightly noisier, not wrong.
export function splitHistory(history, trainFraction = TRAIN_FRACTION) {
  const splitIdx = Math.floor(history.length * trainFraction)
  return { train: history.slice(0, splitIdx), test: history.slice(splitIdx) }
}

// Random search over (ticker × entry rule × stop distance × target multiple).
// Every trial is fit on the train slice only, then immediately checked
// against the test slice with the exact same parameters — no re-tuning.
export function runRandomSearch(tickers, trialCount, trainFraction = TRAIN_FRACTION) {
  const results = []
  for (let i = 0; i < trialCount; i++) {
    const t = tickers[Math.floor(Math.random() * tickers.length)]
    if (!t?.history?.length) continue
    const { train, test } = splitHistory(t.history, trainFraction)

    const tierRule = TIER_RULE_POOL[Math.floor(Math.random() * TIER_RULE_POOL.length)]
    const stopFrac = Math.round(randRange(0.1, 0.6) * 100) / 100
    const targetMult = Math.round(randRange(1.0, 3.0) * 10) / 10

    const trainBt = runBacktest(train, tierRule, { stopFrac, targetMult })
    if (trainBt.trades < MIN_TRADES_FLOOR) continue

    const testBt = runBacktest(test, tierRule, { stopFrac, targetMult })
    const validated = testBt.trades >= MIN_TEST_TRADES_FLOOR && testBt.totalReturn > 0

    results.push({
      ticker: t.ticker,
      tierRule,
      stopFrac,
      targetMult,
      trainTrades: trainBt.trades,
      trainWinRate: trainBt.winRate,
      trainReturn: trainBt.totalReturn,
      testTrades: testBt.trades,
      testWinRate: testBt.winRate,
      testReturn: testBt.totalReturn,
      validated,
    })
  }
  results.sort((a, b) => b.trainReturn - a.trainReturn)
  return results
}

// Same trials, viewed through the lens that actually matters: did it hold up
// on data it never saw. Sorted by test-period return, restricted to trials
// that cleared the (low) test-trade floor and stayed profitable out of sample.
export function validatedLeaderboard(results, limit = 10) {
  return [...results]
    .filter((r) => r.validated)
    .sort((a, b) => b.testReturn - a.testReturn)
    .slice(0, limit)
}
