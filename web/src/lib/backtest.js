// Client-side port of intraday_screener.py's backtest_daily_breakout(), so the
// Lab tab can recompute trades/win-rate/return live as the user tunes
// stop_frac/target_mult, without a round trip to the Action. Keep this in sync
// with the Python version if the strategy logic changes there.

export const TIER_DEFAULTS = {
  high: { stopFrac: 0.35, targetMult: 1.8, label: 'High — Opening Range Breakout' },
  medium: { stopFrac: 0.3, targetMult: 1.6, label: 'Medium — VWAP Trend Pullback' },
  low: { stopFrac: 0.25, targetMult: 1.3, label: 'Low — Range Fade / Mean Reversion' },
}

function computeSma20(closes) {
  return closes.map((_, i) => {
    const start = Math.max(0, i - 19)
    const window = closes.slice(start, i + 1)
    if (window.length < 5) return null
    return window.reduce((a, b) => a + b, 0) / window.length
  })
}

export function runBacktest(history, tier, { stopFrac, targetMult }) {
  if (!history || history.length < 2) {
    return { trades: 0, winRate: 0, totalReturn: 0, outcomes: [] }
  }

  const closes = history.map((h) => h.close)
  const sma20 = tier === 'medium' ? computeSma20(closes) : null
  const outcomes = []

  for (let i = 1; i < history.length; i++) {
    const row = history[i]
    const prev = history[i - 1]
    let entry = null
    let stop = null
    let target = null

    if (tier === 'high') {
      if (row.close > prev.high) {
        entry = row.close
        const risk = prev.high - prev.low
        stop = entry - risk * stopFrac
        target = entry + (entry - stop) * targetMult
      }
    } else if (tier === 'medium') {
      const s = sma20[i]
      if (s !== null && row.close > s && row.low <= s) {
        entry = row.close
        const risk = entry - row.low
        stop = row.low
        target = entry + risk * targetMult
      }
    } else if (tier === 'low') {
      const windowLows = history.slice(Math.max(0, i - 10), i).map((h) => h.low)
      const tenDayLow = windowLows.length ? Math.min(...windowLows) : null
      if (tenDayLow !== null && row.low < tenDayLow && row.close > tenDayLow) {
        entry = row.close
        const risk = entry - row.low
        stop = row.low
        target = entry + risk * targetMult
      }
    }

    if (entry === null) continue

    let outcome = null
    for (let j = i + 1; j < Math.min(i + 6, history.length); j++) {
      const fwd = history[j]
      if (fwd.low <= stop) {
        outcome = ((stop - entry) / entry) * 100
        break
      }
      if (fwd.high >= target) {
        outcome = ((target - entry) / entry) * 100
        break
      }
    }
    if (outcome === null) {
      const endIdx = Math.min(i + 5, history.length - 1)
      outcome = ((history[endIdx].close - entry) / entry) * 100
    }
    outcomes.push(outcome)
  }

  if (!outcomes.length) return { trades: 0, winRate: 0, totalReturn: 0, outcomes: [] }

  const wins = outcomes.filter((o) => o > 0).length
  return {
    trades: outcomes.length,
    winRate: (wins / outcomes.length) * 100,
    totalReturn: outcomes.reduce((a, b) => a + b, 0),
    outcomes,
  }
}
