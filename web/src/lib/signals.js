// Forward-looking helpers. Neither of these predicts price direction — they
// compute exact levels from data that's already known today, mirroring the
// same per-tier rules backtest.js/intraday_screener.py use to decide entries.

// What price would trigger this ticker's tier rule on the NEXT session,
// using only data through today. For the medium tier this is an
// approximation: the real rule's SMA20 on the next session includes that
// session's own (unknown) close, so the "today's SMA20" used here is the
// closest knowable proxy, not the exact future value.
export function computeTriggerLevel(history, tier) {
  if (!history || history.length < 2) return null
  const last = history[history.length - 1]

  if (tier === 'high') {
    return {
      level: last.high,
      desc: "close above today's high",
      distancePct: ((last.high - last.close) / last.close) * 100,
    }
  }
  if (tier === 'medium') {
    const closes = history.map((h) => h.close)
    const window = closes.slice(-20)
    const sma20 = window.reduce((a, b) => a + b, 0) / window.length
    return {
      level: sma20,
      desc: 'pull back to ~20-day average, then close above it',
      distancePct: ((sma20 - last.close) / last.close) * 100,
    }
  }
  // low
  const tenDayLow = Math.min(...history.slice(-10).map((h) => h.low))
  return {
    level: tenDayLow,
    desc: 'dip below the 10-day low, then close back above it',
    distancePct: ((tenDayLow - last.close) / last.close) * 100,
  }
}

// If a position were opened right now at entryPrice, what stop/target would
// this tier's own rule imply? Mirrors backtest.js's per-tier entry math
// exactly, using the most recent bar as the "entry day".
export function computeHypotheticalStopTarget(history, tier, entryPrice, { stopFrac, targetMult }) {
  if (!history || history.length < 2 || !entryPrice) return null
  const last = history[history.length - 1]
  const prev = history[history.length - 2]

  if (tier === 'high') {
    const risk = prev.high - prev.low
    const stop = entryPrice - risk * stopFrac
    const target = entryPrice + (entryPrice - stop) * targetMult
    return { stop, target }
  }
  // medium & low both peg the stop to the entry day's low in the original script
  const stop = last.low
  const risk = entryPrice - stop
  const target = entryPrice + risk * targetMult
  return { stop, target }
}
