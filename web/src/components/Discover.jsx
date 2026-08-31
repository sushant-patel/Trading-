import { useEffect, useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { TrendChart, CHART_BLUE } from './Charts.jsx'
import { runRandomSearch, MIN_TRADES_FLOOR } from '../lib/strategySearch.js'

const SEARCH_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/strategy_search.json'

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

const TIER_RULE_LABEL = {
  high: 'Opening Range Breakout',
  medium: 'VWAP Trend Pullback',
  low: 'Range Fade / Mean Reversion',
}

function LeaderboardTable({ rows, title, infoText }) {
  return (
    <div className="card table-wrap" style={{ marginBottom: 20 }}>
      <table>
        <thead>
          <tr>
            <th colSpan="7" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', paddingBottom: 4 }}>
              {title}
              {infoText && <InfoTip text={infoText} />}
            </th>
          </tr>
          <tr>
            <th>Rank</th>
            <th>Ticker</th>
            <th>Rule</th>
            <th>Stop / Target</th>
            <th>Trades</th>
            <th>Win Rate</th>
            <th>Return</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.ticker}-${r.tierRule}-${r.stopFrac}-${r.targetMult}-${i}`}>
              <td>{i + 1}</td>
              <td style={{ fontWeight: 600 }}>{r.ticker}</td>
              <td>{TIER_RULE_LABEL[r.tierRule] ?? r.tierRule}</td>
              <td>
                {fmt(r.stopFrac)} / {fmt(r.targetMult, 1)}×
              </td>
              <td>{r.trades}</td>
              <td>{fmt(r.winRate, 1)}%</td>
              <td className={r.totalReturn >= 0 ? 'change up' : 'change down'}>
                {r.totalReturn >= 0 ? '+' : ''}
                {fmt(r.totalReturn)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Discover({ data, status }) {
  const [search, setSearch] = useState(null)
  const [searchStatus, setSearchStatus] = useState('loading')
  const [liveResults, setLiveResults] = useState(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetch(SEARCH_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setSearch(json)
        setSearchStatus('ok')
      })
      .catch(() => setSearchStatus('error'))
  }, [])

  if (status === 'loading' && !data) return <div className="empty-state">Loading…</div>
  if (!data?.tickers?.length) return <div className="empty-state">No data available yet.</div>

  function runLiveSearch() {
    setRunning(true)
    setTimeout(() => {
      const results = runRandomSearch(data.tickers, 500)
      setLiveResults(results.slice(0, 10))
      setRunning(false)
    }, 10)
  }

  const equitySeries = search?.run_history?.map((h) => ({ date: h.date, value: h.bestReturn })) ?? []

  return (
    <div>
      <h3 className="section-title">
        Discover
        <InfoTip text="Automated random search: tries many combinations of (ticker × entry rule × stop distance × target multiple) through the same backtest engine the Lab tab uses, and ranks them by return. Runs on a schedule so it can keep looking without you doing anything." />
      </h3>

      <div className="basics-callout critical" style={{ marginBottom: 20 }}>
        <div className="basics-callout-title">⚠ Read this before trusting any leaderboard below</div>
        <p style={{ marginBottom: 0 }}>
          Testing hundreds of random parameter combinations against one fixed slice of history <strong>will</strong> turn
          up spuriously good-looking results by chance alone — this is a real statistical trap (overfitting /
          "data-dredging"), not a hypothetical. Notice how several of the top results below often cluster on the
          same ticker with only a handful of trades — that's the signature of a fit tuned to noise, not a real edge.
          A high rank here means "looked good on this specific backtest," never "will work going forward." Results
          with more trades are more trustworthy than results with fewer, but none of this is investment advice.
        </p>
      </div>

      {searchStatus === 'loading' && <div className="empty-state">Loading search results…</div>}
      {searchStatus === 'error' && <div className="empty-state">Couldn't load strategy_search.json — it may not exist yet.</div>}

      {searchStatus === 'ok' && search && (
        <>
          <div className="status-bar" style={{ marginBottom: 16 }}>
            <span>
              Last run {new Date(search.updated_at).toLocaleString()} · {search.trials_last_run} trials · {search.trials_total_ever} total ever ·
              min {search.min_trades_floor ?? MIN_TRADES_FLOOR} trades to qualify
            </span>
          </div>

          {search.best_ever && (
            <div className="featured-setup" style={{ marginBottom: 20 }}>
              <div className="kicker">
                Best Ever Found
                <InfoTip text="The single best-performing combination across every search run so far, kept even if a later run doesn't beat it. Found on the date shown — re-checked every run against fresh data, so it can still be displaced if it stops holding up." />
              </div>
              <div className="headline">
                {search.best_ever.ticker} · {TIER_RULE_LABEL[search.best_ever.tierRule] ?? search.best_ever.tierRule}
              </div>
              <div className="sub">
                stop {fmt(search.best_ever.stopFrac)} / target {fmt(search.best_ever.targetMult, 1)}× · {search.best_ever.trades} trades ·{' '}
                {fmt(search.best_ever.winRate, 1)}% win rate · +{fmt(search.best_ever.totalReturn)}% · found {search.best_ever.foundOn}
              </div>
            </div>
          )}

          {equitySeries.length > 1 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 className="section-title" style={{ fontSize: 14 }}>
                Best Result Over Time
                <InfoTip text="The top backtested return found on each search run. An upward trend means the search (or fresh data) is turning up better combinations; a flat line means nothing has beaten the current best in a while." />
              </h3>
              <TrendChart series={equitySeries} color={CHART_BLUE} yFormat={(v) => `${v.toFixed(0)}%`} />
            </div>
          )}

          <LeaderboardTable
            rows={search.leaderboard ?? []}
            title="Latest Search — Top 10"
            infoText="The top results from the most recent scheduled search run, re-computed against current data each time."
          />
        </>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ fontSize: 14 }}>
          Try a Search Yourself
          <InfoTip text="Runs 500 fresh random trials right in your browser against the data already loaded. Purely exploratory — nothing here is saved or published, unlike the scheduled search above." />
        </h3>
        <button className="btn" onClick={runLiveSearch} disabled={running}>
          {running ? 'Running 500 trials…' : 'Run 500 trials now'}
        </button>
        {liveResults && (
          <div style={{ marginTop: 16 }}>
            <LeaderboardTable rows={liveResults} title="Your Live Run — Top 10 (not saved)" />
          </div>
        )}
      </div>
    </div>
  )
}
