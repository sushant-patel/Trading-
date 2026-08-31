// Shared "Featured Setup" ranking — used by the Backtest tab's callout and
// by the Portfolios tab's "Featured Setup Only" strategy, so the two never
// drift out of sync with each other.
export const MIN_TRADES_FOR_RANKING = 5

export function computeFeaturedSetup(tickers) {
  const qualifying = (tickers ?? []).filter((t) => t.trades >= MIN_TRADES_FOR_RANKING)
  if (!qualifying.length) return null
  return [...qualifying].sort((a, b) => b.total_return_pct - a.total_return_pct)[0]
}
