import { useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { TrendChart, CHART_GREEN, CHART_RED } from './Charts.jsx'
import { formatInr } from '../lib/currency.js'
import { computeHypotheticalStopTarget } from '../lib/signals.js'
import { TIER_DEFAULTS } from '../lib/backtest.js'

const STARTING_CAPITAL_INR = 80000
const STORAGE_KEY = 'tt_paper_portfolio'
const NEAR_LEVEL_PCT = 2

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed?.positions ? parsed : { positions: [] }
  } catch {
    return { positions: [] }
  }
}

function savePortfolio(portfolio) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio))
  } catch {
    // localStorage unavailable — portfolio stays in-memory only for this session
  }
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function daysHeld(openDate) {
  return Math.max(0, Math.floor((Date.now() - new Date(openDate).getTime()) / 86400000))
}

function currentPriceFor(ticker, data, liveQuotes) {
  const live = liveQuotes?.[ticker]
  if (live?.price) return { price: live.price, isLive: true }
  const t = data?.tickers?.find((x) => x.ticker === ticker)
  return t ? { price: t.last_close, isLive: false } : null
}

// Flags how close the current price is to the stop/target implied at open —
// a nudge to consider closing, not an automatic action.
function stopTargetFlag(currentPriceUsd, stopPriceUsd, targetPriceUsd) {
  if (!stopPriceUsd || !targetPriceUsd) return null
  if (currentPriceUsd <= stopPriceUsd) return { kind: 'stop-hit', label: 'At/below stop' }
  if (currentPriceUsd >= targetPriceUsd) return { kind: 'target-hit', label: 'At/above target' }
  const stopDist = ((currentPriceUsd - stopPriceUsd) / currentPriceUsd) * 100
  const targetDist = ((targetPriceUsd - currentPriceUsd) / currentPriceUsd) * 100
  if (stopDist <= NEAR_LEVEL_PCT) return { kind: 'near-stop', label: 'Near stop' }
  if (targetDist <= NEAR_LEVEL_PCT) return { kind: 'near-target', label: 'Near target' }
  return null
}

export default function Portfolio({ data, status, liveQuotes, fx }) {
  const [portfolio, setPortfolio] = useState(loadPortfolio)
  const [form, setForm] = useState({ ticker: '', amountInr: '', reason: '' })

  if (status === 'loading' && !data) {
    return <div className="empty-state">Loading…</div>
  }
  if (!data?.tickers?.length) {
    return <div className="empty-state">No data available yet.</div>
  }

  function persist(next) {
    setPortfolio(next)
    savePortfolio(next)
  }

  const openPositions = portfolio.positions.filter((p) => p.status === 'open')
  const closedPositions = [...portfolio.positions]
    .filter((p) => p.status === 'closed')
    .sort((a, b) => new Date(b.closeDate) - new Date(a.closeDate))

  const realizedTotalInr = closedPositions.reduce((sum, p) => sum + p.realizedPnlInr, 0)
  const totalCapitalInr = STARTING_CAPITAL_INR + realizedTotalInr
  const allocatedInr = openPositions.reduce((sum, p) => sum + p.allocatedInr, 0)
  const availableInr = totalCapitalInr - allocatedInr

  const enrichedOpen = openPositions.map((p) => {
    const cur = currentPriceFor(p.ticker, data, liveQuotes)
    const currentPriceUsd = cur?.price ?? p.entryPriceUsd
    const currentFxRate = fx?.rate ?? p.fxRateAtOpen
    const currentValueInr = p.shares * currentPriceUsd * currentFxRate
    const unrealizedPnlInr = currentValueInr - p.allocatedInr
    const unrealizedPnlPct = p.allocatedInr ? (unrealizedPnlInr / p.allocatedInr) * 100 : 0
    const flag = stopTargetFlag(currentPriceUsd, p.stopPriceUsd, p.targetPriceUsd)
    return {
      ...p,
      currentPriceUsd,
      currentValueInr,
      unrealizedPnlInr,
      unrealizedPnlPct,
      isLive: cur?.isLive ?? false,
      flag,
    }
  })

  const unrealizedTotalInr = enrichedOpen.reduce((sum, p) => sum + p.unrealizedPnlInr, 0)

  // Equity curve: starting capital, then cumulative capital after each close,
  // in chronological order — entirely derived from closed positions, no
  // separate history log needed.
  const equitySeries = [...closedPositions]
    .sort((a, b) => new Date(a.closeDate) - new Date(b.closeDate))
    .reduce(
      (acc, p) => {
        const prevValue = acc[acc.length - 1].value
        acc.push({ date: new Date(p.closeDate).toLocaleDateString(), value: prevValue + p.realizedPnlInr })
        return acc
      },
      [{ date: 'Start', value: STARTING_CAPITAL_INR }]
    )

  function handleOpen(e) {
    e.preventDefault()
    const amount = parseFloat(form.amountInr)
    if (!form.ticker || !amount || amount <= 0 || amount > availableInr) return
    const cur = currentPriceFor(form.ticker, data, liveQuotes)
    if (!cur || !fx?.rate) return

    const tier = data.tickers.find((t) => t.ticker === form.ticker)?.tier ?? null
    const history = data.tickers.find((t) => t.ticker === form.ticker)?.history ?? []
    const defaults = tier ? TIER_DEFAULTS[tier] : null
    const st = defaults ? computeHypotheticalStopTarget(history, tier, cur.price, defaults) : null

    const allocatedUsd = amount / fx.rate
    const shares = allocatedUsd / cur.price
    const position = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ticker: form.ticker,
      tier,
      status: 'open',
      openDate: new Date().toISOString(),
      entryPriceUsd: cur.price,
      fxRateAtOpen: fx.rate,
      allocatedInr: amount,
      shares,
      reason: form.reason.trim(),
      stopPriceUsd: st?.stop ?? null,
      targetPriceUsd: st?.target ?? null,
    }
    persist({ positions: [position, ...portfolio.positions] })
    setForm({ ticker: '', amountInr: '', reason: '' })
  }

  function handleClose(id) {
    const pos = portfolio.positions.find((p) => p.id === id)
    if (!pos) return
    const cur = currentPriceFor(pos.ticker, data, liveQuotes)
    const exitPriceUsd = cur?.price ?? pos.entryPriceUsd
    const fxRateAtClose = fx?.rate ?? pos.fxRateAtOpen
    const exitValueInr = pos.shares * exitPriceUsd * fxRateAtClose
    const realizedPnlInr = exitValueInr - pos.allocatedInr
    const updated = portfolio.positions.map((p) =>
      p.id === id
        ? { ...p, status: 'closed', closeDate: new Date().toISOString(), exitPriceUsd, fxRateAtClose, realizedPnlInr }
        : p
    )
    persist({ positions: updated })
  }

  function handleReset() {
    if (!window.confirm('Reset the paper portfolio back to ₹80,000? This deletes every open and closed position.')) return
    persist({ positions: [] })
  }

  const canOpen = fx?.rate && data.tickers.length > 0

  return (
    <div>
      <h3 className="section-title">
        Paper Portfolio
        <InfoTip text="Fully simulated — no real money, no real orders, nothing sent to any broker. Allocate part of a virtual ₹80,000, open a position at today's price, then come back in a few days or next week to see what actually happened before risking anything real." learnId="paper-portfolio" />
      </h3>

      <div className="lab-results" style={{ marginBottom: 16 }}>
        <div className="lab-stat">
          <div className="label">Total Capital</div>
          <div className="value">{formatInr(totalCapitalInr)}</div>
        </div>
        <div className="lab-stat">
          <div className="label">Available</div>
          <div className="value">{formatInr(availableInr)}</div>
        </div>
        <div className="lab-stat">
          <div className="label">Allocated</div>
          <div className="value">{formatInr(allocatedInr)}</div>
        </div>
        <div className="lab-stat">
          <div className="label">Unrealized P/L</div>
          <div className={`value ${unrealizedTotalInr === 0 ? '' : unrealizedTotalInr > 0 ? 'change up' : 'change down'}`}>
            {unrealizedTotalInr >= 0 ? '+' : ''}
            {formatInr(unrealizedTotalInr)}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ fontSize: 14 }}>
          Open a Position
          <InfoTip text="Entry price is today's last close (or the live price if available). Shares are computed as your ₹ amount converted to USD at the current FX rate, divided by the entry price — fractional shares are allowed since this is simulated. A stop/target is also computed automatically using that ticker's tier rule, so open positions can flag when price nears either." />
        </h3>
        <form onSubmit={handleOpen}>
          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Ticker</label>
              <select value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}>
                <option value="">Select…</option>
                {data.tickers.map((t) => (
                  <option key={t.ticker} value={t.ticker}>
                    {t.ticker} · {t.tier}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Amount (₹)</label>
              <input
                type="number"
                min="0"
                max={availableInr}
                value={form.amountInr}
                onChange={(e) => setForm((f) => ({ ...f, amountInr: e.target.value }))}
                placeholder={`up to ${Math.max(0, Math.floor(availableInr))}`}
              />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>
              Reason / prediction (optional)
              <InfoTip text="Write down why you're opening this — e.g. 'Featured Setup pick, 44% win rate over 36 trades' or 'near its trigger level in Watch'. Saved with the position so you can check later whether your reasoning actually held up, not just the P/L." />
            </label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="What made you pick this, and what do you expect to happen?"
            />
          </div>
          <button type="submit" className="btn" disabled={!canOpen || availableInr <= 0}>
            Open Position
          </button>
        </form>
        {availableInr <= 0 && (
          <div className="help-text" style={{ marginTop: 10 }}>
            No capital left to allocate — close a position first, or reset the portfolio below.
          </div>
        )}
      </div>

      <h3 className="section-title" style={{ fontSize: 14 }}>
        Open Positions ({enrichedOpen.length})
      </h3>
      {enrichedOpen.length === 0 ? (
        <div className="empty-state">No open positions — allocate some capital above to start.</div>
      ) : (
        <div className="card table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Opened</th>
                <th>Entry</th>
                <th>
                  Current
                  <InfoTip text="Live price when the app is deployed and the market data feed is reachable; otherwise falls back to the last daily close from results.json." />
                </th>
                <th>Allocated</th>
                <th>Unrealized P/L</th>
                <th>
                  Status
                  <InfoTip text="Compares the current price to the stop/target implied by this ticker's tier rule at the moment you opened the position. A nudge to reconsider, not an automatic close." />
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrichedOpen.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.ticker}
                    {p.reason && (
                      <div className="help-text" style={{ margin: 0, maxWidth: 160, whiteSpace: 'normal' }}>
                        {p.reason}
                      </div>
                    )}
                  </td>
                  <td>
                    {new Date(p.openDate).toLocaleDateString()}
                    <div className="help-text" style={{ margin: 0 }}>
                      {daysHeld(p.openDate)}d ago
                    </div>
                  </td>
                  <td>${fmt(p.entryPriceUsd)}</td>
                  <td>
                    ${fmt(p.currentPriceUsd)}
                    {p.isLive && <span className="live-dot" title="Live price" />}
                  </td>
                  <td>{formatInr(p.allocatedInr)}</td>
                  <td className={p.unrealizedPnlInr >= 0 ? 'change up' : 'change down'}>
                    {p.unrealizedPnlInr >= 0 ? '+' : ''}
                    {formatInr(p.unrealizedPnlInr)} ({p.unrealizedPnlPct >= 0 ? '+' : ''}
                    {fmt(p.unrealizedPnlPct, 1)}%)
                  </td>
                  <td>
                    {p.flag ? (
                      <span className={`status-flag ${p.flag.kind}`}>{p.flag.label}</span>
                    ) : (
                      <span className="help-text" style={{ margin: 0 }}>
                        —
                      </span>
                    )}
                  </td>
                  <td>
                    <button className="btn danger" onClick={() => handleClose(p.id)}>
                      Close
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section-title" style={{ fontSize: 14 }}>
        Closed Positions ({closedPositions.length})
      </h3>
      {closedPositions.length === 0 ? (
        <div className="empty-state">Nothing closed yet — this is where your track record builds up.</div>
      ) : (
        <div className="card table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Entry → Exit</th>
                <th>Realized P/L</th>
              </tr>
            </thead>
            <tbody>
              {closedPositions.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.ticker}
                    {p.reason && (
                      <div className="help-text" style={{ margin: 0, maxWidth: 160, whiteSpace: 'normal' }}>
                        {p.reason}
                      </div>
                    )}
                  </td>
                  <td>{new Date(p.openDate).toLocaleDateString()}</td>
                  <td>{new Date(p.closeDate).toLocaleDateString()}</td>
                  <td>
                    ${fmt(p.entryPriceUsd)} → ${fmt(p.exitPriceUsd)}
                  </td>
                  <td className={p.realizedPnlInr >= 0 ? 'change up' : 'change down'}>
                    {p.realizedPnlInr >= 0 ? '+' : ''}
                    {formatInr(p.realizedPnlInr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {equitySeries.length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ fontSize: 14 }}>
            Capital Over Time
            <InfoTip text="Starting ₹80,000, plus cumulative realized P/L after each closed position, in the order you closed them. Doesn't move on unrealized P/L — only what you've actually locked in by closing." />
          </h3>
          <TrendChart
            series={equitySeries}
            color={equitySeries[equitySeries.length - 1].value >= STARTING_CAPITAL_INR ? CHART_GREEN : CHART_RED}
            yFormat={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`}
          />
        </div>
      )}

      <button className="btn secondary" onClick={handleReset}>
        Reset portfolio to ₹80,000
      </button>
    </div>
  )
}
