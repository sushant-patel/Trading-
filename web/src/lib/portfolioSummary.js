// Lightweight cross-portfolio summary for the Compare view — reads each
// strategy's localStorage independently. Portfolio.jsx computes its own
// (richer, per-position) numbers separately; this exists only so the
// Compare view doesn't have to mount all three full Portfolio components
// just to show four numbers per strategy.
const STARTING_CAPITAL_INR = 80000

function currentPriceFor(ticker, data, liveQuotes) {
  const live = liveQuotes?.[ticker]
  if (live?.price) return live.price
  const t = data?.tickers?.find((x) => x.ticker === ticker)
  return t ? t.last_close : null
}

export function loadPortfolioRaw(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.positions ? parsed : { positions: [] }
  } catch {
    return { positions: [] }
  }
}

export function summarizePortfolio(storageKey, data, liveQuotes, fx) {
  const portfolio = loadPortfolioRaw(storageKey)
  const openPositions = portfolio.positions.filter((p) => p.status === 'open')
  const closedPositions = portfolio.positions.filter((p) => p.status === 'closed')

  const realizedTotalInr = closedPositions.reduce((sum, p) => sum + p.realizedPnlInr, 0)
  const totalCapitalInr = STARTING_CAPITAL_INR + realizedTotalInr
  const allocatedInr = openPositions.reduce((sum, p) => sum + p.allocatedInr, 0)
  const unrealizedTotalInr = openPositions.reduce((sum, p) => {
    const price = currentPriceFor(p.ticker, data, liveQuotes) ?? p.entryPriceUsd
    const rate = fx?.rate ?? p.fxRateAtOpen
    const currentValueInr = p.shares * price * rate
    return sum + (currentValueInr - p.allocatedInr)
  }, 0)

  return {
    totalCapitalInr,
    allocatedInr,
    availableInr: totalCapitalInr - allocatedInr,
    unrealizedTotalInr,
    openCount: openPositions.length,
    closedCount: closedPositions.length,
  }
}
