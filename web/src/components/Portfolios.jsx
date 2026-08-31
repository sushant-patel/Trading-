import { useState } from 'react'
import InfoTip from './InfoTip.jsx'
import Portfolio from './Portfolio.jsx'
import { PORTFOLIO_STRATEGIES } from '../lib/portfolioStrategies.js'
import { summarizePortfolio } from '../lib/portfolioSummary.js'
import { formatInr } from '../lib/currency.js'

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

export default function Portfolios({ data, status, liveQuotes, fx }) {
  const [view, setView] = useState('compare')

  if (status === 'loading' && !data) {
    return <div className="empty-state">Loading…</div>
  }
  if (!data?.tickers?.length) {
    return <div className="empty-state">No data available yet.</div>
  }

  const activeStrategy = PORTFOLIO_STRATEGIES.find((s) => s.id === view)

  return (
    <div>
      <div className="trends-header">
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          Portfolios
          <InfoTip text="Three independent simulated ₹80,000 accounts, each constrained to a different rule, meant to run side by side for a week or two so you can compare approaches before risking real money. Each has its own full ₹80,000 — none is split or shares capital with the others." />
        </h3>
        <div className="view-mode-row">
          <button className={`timeframe-btn ${view === 'compare' ? 'active' : ''}`} onClick={() => setView('compare')}>
            Compare All
          </button>
          {PORTFOLIO_STRATEGIES.map((s) => (
            <button key={s.id} className={`timeframe-btn ${view === s.id ? 'active' : ''}`} onClick={() => setView(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'compare' && <CompareView data={data} liveQuotes={liveQuotes} fx={fx} onOpen={setView} />}
      {activeStrategy && <Portfolio key={activeStrategy.id} data={data} status={status} liveQuotes={liveQuotes} fx={fx} strategy={activeStrategy} />}
    </div>
  )
}

function CompareView({ data, liveQuotes, fx, onOpen }) {
  const summaries = PORTFOLIO_STRATEGIES.map((s) => ({
    strategy: s,
    ...summarizePortfolio(s.storageKey, data, liveQuotes, fx),
  }))

  return (
    <div>
      <p className="basics-body" style={{ marginBottom: 16 }}>
        Click any card to open that portfolio and start/close positions.
      </p>
      <div className="compare-portfolios-grid">
        {summaries.map(({ strategy, totalCapitalInr, unrealizedTotalInr, openCount, closedCount }) => {
          const totalWithUnrealized = totalCapitalInr + unrealizedTotalInr
          const changeFromStart = totalWithUnrealized - 80000
          return (
            <div className="compare-portfolio-card" key={strategy.id} onClick={() => onOpen(strategy.id)}>
              <div className="row1">
                <span style={{ fontWeight: 700 }}>{strategy.label}</span>
              </div>
              <div className="compare-portfolio-value">{formatInr(totalWithUnrealized)}</div>
              <div className={changeFromStart >= 0 ? 'change up' : 'change down'} style={{ fontSize: 13 }}>
                {changeFromStart >= 0 ? '+' : ''}
                {formatInr(changeFromStart)} vs. ₹80,000 start
              </div>
              <div className="help-text" style={{ marginTop: 10 }}>
                {openCount} open · {closedCount} closed
              </div>
              <div className="basics-body" style={{ marginTop: 8, fontSize: 12 }}>{strategy.description}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
