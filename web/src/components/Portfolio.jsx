import { useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { formatInr } from '../lib/currency.js'

const STARTING_CAPITAL_INR = 80000
const STORAGE_KEY = 'tt_paper_portfolio'

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

export default function Portfolio({ data, status, liveQuotes, fx }) {
  const [portfolio, setPortfolio] = useState(loadPortfolio)
  const [form, setForm] = useState({ ticker: '', amountInr: '' })

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
    return { ...p, currentPriceUsd, currentValueInr, unrealizedPnlInr, unrealizedPnlPct, isLive: cur?.isLive ?? false }
  })

  const unrealizedTotalInr = enrichedOpen.reduce((sum, p) => sum + p.unrealizedPnlInr, 0)

  function handleOpen(e) {
    e.preventDefault()
    const amount = parseFloat(form.amountInr)
    if (!form.ticker || !amount || amount <= 0 || amount > availableInr) return
    const cur = currentPriceFor(form.ticker, data, liveQuotes)
    if (!cur || !fx?.rate) return

    const allocatedUsd = amount / fx.rate
    const shares = allocatedUsd / cur.price
    const position = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ticker: form.ticker,
      tier: data.tickers.find((t) => t.ticker === form.ticker)?.tier ?? null,
      status: 'open',
      openDate: new Date().toISOString(),
      entryPriceUsd: cur.price,
      fxRateAtOpen: fx.rate,
      allocatedInr: amount,
      shares,
    }
    persist({ positions: [position, ...portfolio.positions] })
    setForm({ ticker: '', amountInr: '' })
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
        <InfoTip text="Fully simulated — no real money, no real orders, nothing sent to any broker. Allocate part of a virtual ₹80,000, open a position at today's price, then come back in a few days or next week to see what actually happened before risking anything real." />
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
          <InfoTip text="Entry price is today's last close (or the live price if available). Shares are computed as your ₹ amount converted to USD at the current FX rate, divided by the entry price — fractional shares are allowed since this is simulated." />
        </h3>
        <form onSubmit={handleOpen} className="form-grid" style={{ marginBottom: 0, alignItems: 'end' }}>
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
          <div className="field" style={{ marginBottom: 0 }}>
            <button type="submit" className="btn" disabled={!canOpen || availableInr <= 0}>
              Open Position
            </button>
          </div>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enrichedOpen.map((p) => (
                <tr key={p.id}>
                  <td>{p.ticker}</td>
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
        <div className="card table-wrap">
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
                  <td>{p.ticker}</td>
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

      <button className="btn secondary" style={{ marginTop: 16 }} onClick={handleReset}>
        Reset portfolio to ₹80,000
      </button>
    </div>
  )
}
