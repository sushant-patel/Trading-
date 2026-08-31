import { useEffect, useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { TrendChart, CHART_GREEN, CHART_RED } from './Charts.jsx'
import { formatInr } from '../lib/currency.js'

const PORTFOLIOS_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/portfolios.json'
const STRATEGY_ORDER = ['featured', 'diversified', 'highconviction', 'discovered']

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

function summarize(strategy, data, liveQuotes, fx, startingCapital) {
  const open = strategy.positions.filter((p) => p.status === 'open')
  const closed = strategy.positions.filter((p) => p.status === 'closed')
  const realizedTotalInr = closed.reduce((sum, p) => sum + p.realizedPnlInr, 0)
  const totalCapitalInr = startingCapital + realizedTotalInr
  const allocatedInr = open.reduce((sum, p) => sum + p.allocatedInr, 0)
  const enrichedOpen = open.map((p) => {
    const cur = currentPriceFor(p.ticker, data, liveQuotes)
    const currentPriceUsd = cur?.price ?? p.entryPriceUsd
    const rate = fx?.rate ?? p.fxRateAtOpen
    const currentValueInr = p.shares * currentPriceUsd * rate
    const unrealizedPnlInr = currentValueInr - p.allocatedInr
    return { ...p, currentPriceUsd, unrealizedPnlInr, unrealizedPnlPct: p.allocatedInr ? (unrealizedPnlInr / p.allocatedInr) * 100 : 0, isLive: cur?.isLive ?? false }
  })
  const unrealizedTotalInr = enrichedOpen.reduce((sum, p) => sum + p.unrealizedPnlInr, 0)
  return { open: enrichedOpen, closed, totalCapitalInr, allocatedInr, unrealizedTotalInr }
}

export default function ManagedPortfolios({ data, status, liveQuotes, fx }) {
  const [ledger, setLedger] = useState(null)
  const [ledgerStatus, setLedgerStatus] = useState('loading')
  const [view, setView] = useState('compare')

  useEffect(() => {
    fetch(PORTFOLIOS_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setLedger(json)
        setLedgerStatus('ok')
      })
      .catch(() => setLedgerStatus('error'))
  }, [])

  if (status === 'loading' && !data) return <div className="empty-state">Loading…</div>
  if (!data?.tickers?.length) return <div className="empty-state">No data available yet.</div>
  if (ledgerStatus === 'loading') return <div className="empty-state">Loading portfolios…</div>
  if (ledgerStatus === 'error' || !ledger) {
    return <div className="empty-state">Couldn't load portfolios.json — it may not exist yet.</div>
  }

  const startingCapital = ledger.starting_capital_inr ?? 80000
  const strategies = STRATEGY_ORDER.map((id) => ({ id, ...ledger.strategies[id] })).filter((s) => s.label)
  const activeStrategy = strategies.find((s) => s.id === view)

  return (
    <div>
      <div className="trends-header">
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          Portfolios
          <InfoTip text="Three independent simulated ₹80,000 accounts, each constrained to a different rule, managed automatically by the scheduled Daily routine — not something you click open/close on yourself. Each has its own full ₹80,000, none is split or shared." learnId="paper-portfolio" />
        </h3>
        <div className="view-mode-row">
          <button className={`timeframe-btn ${view === 'compare' ? 'active' : ''}`} onClick={() => setView('compare')}>
            Compare All
          </button>
          {strategies.map((s) => (
            <button key={s.id} className={`timeframe-btn ${view === s.id ? 'active' : ''}`} onClick={() => setView(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="basics-callout" style={{ borderColor: 'var(--blue)', background: 'rgba(79, 142, 247, 0.06)', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13 }}>
          Managed automatically by the scheduled routine (weekdays, ~13:00 UTC / 6:30 PM IST) — not manually
          editable here. If a strategy shows no positions yet, it hasn't had its first automated open.{' '}
          {ledger.note}
        </p>
      </div>

      {view === 'compare' && (
        <div className="compare-portfolios-grid">
          {strategies.map((s) => {
            const sum = summarize(s, data, liveQuotes, fx, startingCapital)
            const totalWithUnrealized = sum.totalCapitalInr + sum.unrealizedTotalInr
            const changeFromStart = totalWithUnrealized - startingCapital
            return (
              <div className="compare-portfolio-card" key={s.id} onClick={() => setView(s.id)}>
                <div className="row1">
                  <span style={{ fontWeight: 700 }}>{s.label}</span>
                </div>
                <div className="compare-portfolio-value">{formatInr(totalWithUnrealized)}</div>
                <div className={changeFromStart >= 0 ? 'change up' : 'change down'} style={{ fontSize: 13 }}>
                  {changeFromStart >= 0 ? '+' : ''}
                  {formatInr(changeFromStart)} vs. {formatInr(startingCapital)} start
                </div>
                <div className="help-text" style={{ marginTop: 10 }}>
                  {sum.open.length} open · {sum.closed.length} closed
                </div>
                <div className="basics-body" style={{ marginTop: 8, fontSize: 12 }}>{s.description}</div>
              </div>
            )
          })}
        </div>
      )}

      {activeStrategy && <StrategyDetail strategy={activeStrategy} data={data} liveQuotes={liveQuotes} fx={fx} startingCapital={startingCapital} />}
    </div>
  )
}

function StrategyDetail({ strategy, data, liveQuotes, fx, startingCapital }) {
  const sum = summarize(strategy, data, liveQuotes, fx, startingCapital)
  const equitySeries = [...strategy.positions]
    .filter((p) => p.status === 'closed')
    .sort((a, b) => new Date(a.closeDate) - new Date(b.closeDate))
    .reduce((acc, p) => {
      acc.push({ date: new Date(p.closeDate).toLocaleDateString(), value: acc[acc.length - 1].value + p.realizedPnlInr })
      return acc
    }, [{ date: 'Start', value: startingCapital }])

  return (
    <div>
      <h3 className="section-title" style={{ fontSize: 14 }}>
        {strategy.label}
      </h3>
      <p className="basics-body" style={{ marginTop: -8 }}>{strategy.description}</p>

      <div className="lab-results" style={{ marginBottom: 16 }}>
        <div className="lab-stat">
          <div className="label">Total Capital</div>
          <div className="value">{formatInr(sum.totalCapitalInr)}</div>
        </div>
        <div className="lab-stat">
          <div className="label">Allocated</div>
          <div className="value">{formatInr(sum.allocatedInr)}</div>
        </div>
        <div className="lab-stat">
          <div className="label">Unrealized P/L</div>
          <div className={`value ${sum.unrealizedTotalInr === 0 ? '' : sum.unrealizedTotalInr > 0 ? 'change up' : 'change down'}`}>
            {sum.unrealizedTotalInr >= 0 ? '+' : ''}
            {formatInr(sum.unrealizedTotalInr)}
          </div>
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: 14 }}>Open Positions ({sum.open.length})</h3>
      {sum.open.length === 0 ? (
        <div className="empty-state">No open positions yet — waiting for the next automated run.</div>
      ) : (
        <div className="card table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Opened</th>
                <th>Entry</th>
                <th>Current</th>
                <th>Allocated</th>
                <th>Unrealized P/L</th>
              </tr>
            </thead>
            <tbody>
              {sum.open.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.ticker}
                    {p.reason && <div className="help-text" style={{ margin: 0, maxWidth: 200, whiteSpace: 'normal' }}>{p.reason}</div>}
                  </td>
                  <td>
                    {new Date(p.openDate).toLocaleDateString()}
                    <div className="help-text" style={{ margin: 0 }}>{daysHeld(p.openDate)}d ago</div>
                  </td>
                  <td>${fmt(p.entryPriceUsd)}</td>
                  <td>
                    ${fmt(p.currentPriceUsd)}
                    {p.isLive && <span className="live-dot" title="Live price" />}
                  </td>
                  <td>{formatInr(p.allocatedInr)}</td>
                  <td className={p.unrealizedPnlInr >= 0 ? 'change up' : 'change down'}>
                    {p.unrealizedPnlInr >= 0 ? '+' : ''}
                    {formatInr(p.unrealizedPnlInr)} ({p.unrealizedPnlPct >= 0 ? '+' : ''}{fmt(p.unrealizedPnlPct, 1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section-title" style={{ fontSize: 14 }}>Closed Positions ({sum.closed.length})</h3>
      {sum.closed.length === 0 ? (
        <div className="empty-state">Nothing closed yet.</div>
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
              {sum.closed.map((p) => (
                <tr key={p.id}>
                  <td>{p.ticker}</td>
                  <td>{new Date(p.openDate).toLocaleDateString()}</td>
                  <td>{new Date(p.closeDate).toLocaleDateString()}</td>
                  <td>${fmt(p.entryPriceUsd)} → ${fmt(p.exitPriceUsd)}</td>
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
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 14 }}>Capital Over Time</h3>
          <TrendChart
            series={equitySeries}
            color={equitySeries[equitySeries.length - 1].value >= startingCapital ? CHART_GREEN : CHART_RED}
            yFormat={(v) => `₹${Math.round(v).toLocaleString('en-IN')}`}
          />
        </div>
      )}
    </div>
  )
}
