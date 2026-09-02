import { useEffect, useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { Sparkline, TrendChart, CHART_GREEN, CHART_RED } from './Charts.jsx'
import { formatInr } from '../lib/currency.js'
import { runRandomSearch, validatedLeaderboard } from '../lib/strategySearch.js'

const RESULTS_IN_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/results_in.json'
const SEARCH_IN_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/strategy_search_in.json'
const PORTFOLIO_IN_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/portfolio_in.json'
const LIVE_PRICE_IN_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/live_price_in.json'

const SUB_TABS = ['Watchlist', 'Discover', 'Portfolio']

const TIER_RULE_LABEL = {
  high: 'Opening Range Breakout',
  medium: 'VWAP Trend Pullback',
  low: 'Range Fade / Mean Reversion',
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function symbolOnly(ticker) {
  return ticker?.replace(/\.NS$/, '') ?? ticker
}

function daysHeld(openDate) {
  return Math.max(0, Math.floor((Date.now() - new Date(openDate).getTime()) / 86400000))
}

function useJsonFetch(url) {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  useEffect(() => {
    let cancelled = false
    fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setData(json)
        setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [url])
  return [data, status]
}

export default function India() {
  const [sub, setSub] = useState('Watchlist')
  const [results, resultsStatus] = useJsonFetch(RESULTS_IN_URL)
  const [search, searchStatus] = useJsonFetch(SEARCH_IN_URL)
  const [portfolio, portfolioStatus] = useJsonFetch(PORTFOLIO_IN_URL)
  const [livePrice] = useJsonFetch(LIVE_PRICE_IN_URL)

  return (
    <div>
      <h3 className="section-title">
        India (Nifty 100)
        <InfoTip
          text="A separate module for real NSE-listed Indian stocks — tradeable via a normal Indian demat account, no LRS or FX conversion involved (unlike the main US watchlist). Prices refresh once daily before market open; the paper-trading portfolio below is checked hourly during NSE hours (9:15 AM–3:30 PM IST) using a live-price bridge, not continuously — that hourly cadence is the fastest a scheduled routine can run, not a design choice."
        />
      </h3>
      <div className="view-mode-row" style={{ marginBottom: 16 }}>
        {SUB_TABS.map((t) => (
          <button key={t} className={`timeframe-btn ${sub === t ? 'active' : ''}`} onClick={() => setSub(t)}>
            {t}
          </button>
        ))}
      </div>
      {sub === 'Watchlist' && <IndiaWatchlist data={results} status={resultsStatus} />}
      {sub === 'Discover' && <IndiaDiscover search={search} searchStatus={searchStatus} results={results} />}
      {sub === 'Portfolio' && (
        <IndiaPortfolio portfolio={portfolio} portfolioStatus={portfolioStatus} results={results} livePrice={livePrice} />
      )}
    </div>
  )
}

function IndiaWatchlist({ data, status }) {
  if (status === 'loading' && !data) return <div className="empty-state">Loading Nifty 100 data…</div>
  if (status === 'error' && !data) {
    return <div className="empty-state">Couldn't load results_in.json — it may not exist yet.</div>
  }
  if (!data?.tickers?.length) return <div className="empty-state">No ticker data available yet.</div>

  const rows = [...data.tickers].sort((a, b) => {
    if (a.trades === 0 && b.trades === 0) return 0
    if (a.trades === 0) return 1
    if (b.trades === 0) return -1
    return b.total_return_pct - a.total_return_pct
  })

  return (
    <div>
      <div className="status-bar" style={{ marginBottom: 16 }}>
        <span>
          {data.tickers.length} tickers · generated {new Date(data.generated_at).toLocaleString()} · period {data.period} · NSE, ₹ native
        </span>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Tier</th>
              <th>Last Close</th>
              <th>Chg %</th>
              <th>Trend</th>
              <th>
                Trades
                <InfoTip text="Number of times this ticker's tier strategy triggered during the backtest window. Zero means no signal, not a bad rating." />
              </th>
              <th>Win Rate</th>
              <th>
                Total Return
                <InfoTip text="Sum of % gain/loss across all backtested trades — daily-bar approximation, not a real intraday backtest, not compounded." />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.ticker}>
                <td style={{ fontWeight: 600 }}>{symbolOnly(t.ticker)}</td>
                <td style={{ textTransform: 'capitalize' }}>{t.tier}</td>
                <td>{formatInr(t.last_close)}</td>
                <td className={t.last_change_pct >= 0 ? 'change up' : 'change down'}>
                  {t.last_change_pct >= 0 ? '+' : ''}
                  {fmt(t.last_change_pct)}%
                </td>
                <td style={{ width: 90 }}>
                  {t.history?.length > 1 && (
                    <Sparkline
                      values={t.history.map((h) => h.close)}
                      color={t.history[t.history.length - 1].close >= t.history[0].close ? 'var(--green)' : 'var(--red)'}
                    />
                  )}
                </td>
                <td>{t.trades}</td>
                <td>{t.trades === 0 ? '—' : `${fmt(t.win_rate, 1)}%`}</td>
                <td className={t.trades === 0 ? '' : t.total_return_pct >= 0 ? 'change up' : 'change down'}>
                  {t.trades === 0 ? '—' : `${t.total_return_pct >= 0 ? '+' : ''}${fmt(t.total_return_pct)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ReturnCell({ trades, ret }) {
  return (
    <span>
      <span className={ret >= 0 ? 'change up' : 'change down'}>
        {ret >= 0 ? '+' : ''}
        {fmt(ret)}%
      </span>
      <span className="help-text" style={{ margin: 0 }}>
        {trades} trade{trades === 1 ? '' : 's'}
      </span>
    </span>
  )
}

function TrainTestTable({ rows, title, infoText }) {
  return (
    <div className="card table-wrap" style={{ marginBottom: 20 }}>
      <table>
        <thead>
          <tr>
            <th colSpan="6" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', paddingBottom: 4 }}>
              {title}
              {infoText && <InfoTip text={infoText} />}
            </th>
          </tr>
          <tr>
            <th>Rank</th>
            <th>Ticker</th>
            <th>Rule</th>
            <th>Stop / Target</th>
            <th>Train Return</th>
            <th>
              Test Return
              <InfoTip text="Same parameters, re-run against the ~30% of history held out from training — data this combination never had a chance to fit itself to." />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.ticker}-${r.tierRule}-${r.stopFrac}-${r.targetMult}-${i}`}>
              <td>{i + 1}</td>
              <td style={{ fontWeight: 600 }}>{symbolOnly(r.ticker)}</td>
              <td>{TIER_RULE_LABEL[r.tierRule] ?? r.tierRule}</td>
              <td>
                {fmt(r.stopFrac)} / {fmt(r.targetMult, 1)}×
              </td>
              <td>
                <ReturnCell trades={r.trainTrades} ret={r.trainReturn} />
              </td>
              <td>
                <ReturnCell trades={r.testTrades} ret={r.testReturn} />
                {r.validated && (
                  <span className="status-flag near-target" style={{ marginLeft: 6 }}>
                    held up
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IndiaDiscover({ search, searchStatus, results }) {
  const [liveResults, setLiveResults] = useState(null)
  const [liveValidated, setLiveValidated] = useState(null)
  const [running, setRunning] = useState(false)

  if (searchStatus === 'loading' && !search) return <div className="empty-state">Loading search results…</div>
  if (searchStatus === 'error' || !search) {
    return <div className="empty-state">Couldn't load strategy_search_in.json — it may not exist yet.</div>
  }

  function runLiveSearch() {
    if (!results?.tickers?.length) return
    setRunning(true)
    setTimeout(() => {
      const r = runRandomSearch(results.tickers, 500)
      setLiveResults(r.slice(0, 10))
      setLiveValidated(validatedLeaderboard(r, 10))
      setRunning(false)
    }, 10)
  }

  const equitySeries = search.run_history?.map((h) => ({ date: h.date, value: h.bestValidatedReturn ?? 0 })) ?? []

  return (
    <div>
      <div className="basics-callout critical" style={{ marginBottom: 20 }}>
        <div className="basics-callout-title">⚠ Same overfitting trap as the US Discover tab</div>
        <p style={{ marginBottom: 8 }}>
          Testing thousands of random combinations against one fixed slice of history <strong>will</strong> turn up
          spuriously good-looking results by chance alone — the last search run's own top training result was{' '}
          <strong>+{fmt(search?.leaderboard?.[0]?.trainReturn)}%</strong> in training but{' '}
          <strong>{fmt(search?.leaderboard?.[0]?.testReturn)}%</strong> on data it never saw.
        </p>
        <p style={{ marginBottom: 0 }}>
          "Held Up Out-of-Sample" below is ranked by test return, restricted to combinations that also stayed
          profitable on the held-out ~30%. Trust that one more — though with only a few weeks of held-out Nifty 100
          data so far, "validated" means "some real evidence," not "proven."
        </p>
      </div>

      <div className="status-bar" style={{ marginBottom: 16 }}>
        <span>
          Last run {new Date(search.updated_at).toLocaleString()} · {search.trials_last_run} trials ·{' '}
          {search.trials_total_ever} total ever · train/test split {Math.round(search.train_fraction * 100)}/
          {Math.round((1 - search.train_fraction) * 100)} · min {search.min_trades_floor} train /{' '}
          {search.min_test_trades_floor} test trades to qualify
        </span>
      </div>

      {search.best_ever ? (
        <div className="featured-setup" style={{ marginBottom: 20 }}>
          <div className="kicker">
            Best Ever Found (Out-of-Sample Validated)
            <InfoTip text="The best test-period return among all combinations that held up out-of-sample, across every search run so far. This is what the Portfolio tab's 'discovered_in' strategy forward-paper-trades." />
          </div>
          <div className="headline">
            {symbolOnly(search.best_ever.ticker)} · {TIER_RULE_LABEL[search.best_ever.tierRule] ?? search.best_ever.tierRule}
          </div>
          <div className="sub">
            stop {fmt(search.best_ever.stopFrac)} / target {fmt(search.best_ever.targetMult, 1)}× · train{' '}
            {search.best_ever.trainTrades}t {search.best_ever.trainReturn >= 0 ? '+' : ''}
            {fmt(search.best_ever.trainReturn)}% · test {search.best_ever.testTrades}t +{fmt(search.best_ever.testReturn)}% ·
            found {search.best_ever.foundOn}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: 20 }}>
          Nothing has validated out-of-sample yet — check back after more search runs.
        </div>
      )}

      {equitySeries.length > 1 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="section-title" style={{ fontSize: 14 }}>
            Best Validated Result Over Time
          </h3>
          <TrendChart series={equitySeries} color={CHART_GREEN} yFormat={(v) => `${v.toFixed(0)}%`} />
        </div>
      )}

      <TrainTestTable
        rows={search.validated_leaderboard ?? []}
        title="Held Up Out-of-Sample — Top 10"
        infoText="Ranked by test-period return, restricted to combinations that stayed profitable on data they never trained on."
      />
      <TrainTestTable
        rows={search.leaderboard ?? []}
        title="Latest Search — Top 10 by Training Return (overfitting-prone view)"
        infoText="Ranked by training return only. Compare each row's Train vs Test column yourself — a big gap, or a negative Test, is the overfitting signature in action."
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ fontSize: 14 }}>
          Try a Search Yourself
          <InfoTip text="Runs 500 fresh random trials right in your browser against the Nifty 100 data already loaded, with the same train/test split. Purely exploratory — nothing here is saved or published." />
        </h3>
        <button className="btn" onClick={runLiveSearch} disabled={running || !results?.tickers?.length}>
          {running ? 'Running 500 trials…' : 'Run 500 trials now'}
        </button>
        {liveResults && (
          <div style={{ marginTop: 16 }}>
            <TrainTestTable rows={liveValidated} title="Your Live Run — Held Up Out-of-Sample (not saved)" />
            <TrainTestTable rows={liveResults} title="Your Live Run — Top 10 by Training Return (not saved)" />
          </div>
        )}
      </div>
    </div>
  )
}

function IndiaPortfolio({ portfolio, portfolioStatus, results, livePrice }) {
  if (portfolioStatus === 'loading' && !portfolio) return <div className="empty-state">Loading portfolio…</div>
  if (portfolioStatus === 'error' || !portfolio) {
    return <div className="empty-state">Couldn't load portfolio_in.json — it may not exist yet.</div>
  }

  const strategy = portfolio.strategies?.discovered_in
  if (!strategy) return <div className="empty-state">No discovered_in strategy found in portfolio_in.json.</div>

  const startingCapital = portfolio.starting_capital_inr ?? 80000
  const open = strategy.positions.filter((p) => p.status === 'open')
  const closed = strategy.positions.filter((p) => p.status === 'closed')
  const realizedTotal = closed.reduce((sum, p) => sum + (p.realizedPnlInr ?? 0), 0)
  const totalCapital = startingCapital + realizedTotal

  const enrichedOpen = open.map((p) => {
    let currentPrice = p.entryPriceInr
    let isLive = false
    if (livePrice?.ticker === p.ticker && livePrice.price) {
      currentPrice = livePrice.price
      isLive = true
    } else {
      const t = results?.tickers?.find((x) => x.ticker === p.ticker)
      if (t) currentPrice = t.last_close
    }
    const currentValue = p.shares * currentPrice
    const unrealizedPnl = currentValue - p.allocatedInr
    return { ...p, currentPrice, isLive, unrealizedPnl, unrealizedPnlPct: p.allocatedInr ? (unrealizedPnl / p.allocatedInr) * 100 : 0 }
  })
  const unrealizedTotal = enrichedOpen.reduce((sum, p) => sum + p.unrealizedPnl, 0)

  const equitySeries = [...closed]
    .sort((a, b) => new Date(a.closeDate) - new Date(b.closeDate))
    .reduce(
      (acc, p) => {
        acc.push({ date: new Date(p.closeDate).toLocaleDateString(), value: acc[acc.length - 1].value + (p.realizedPnlInr ?? 0) })
        return acc
      },
      [{ date: 'Start', value: startingCapital }]
    )

  return (
    <div>
      <h3 className="section-title" style={{ fontSize: 14 }}>
        {strategy.label}
        <InfoTip text="A single simulated ₹80,000 account that always holds whatever the Discover search's best out-of-sample-validated combo currently is. Checked hourly during NSE market hours, not continuously." />
      </h3>
      <p className="basics-body" style={{ marginTop: -8 }}>{strategy.description}</p>

      <div className="lab-results" style={{ marginBottom: 16 }}>
        <div className="lab-stat">
          <div className="label">Total Capital</div>
          <div className="value">{formatInr(totalCapital)}</div>
        </div>
        <div className="lab-stat">
          <div className="label">Unrealized P/L</div>
          <div className={`value ${unrealizedTotal === 0 ? '' : unrealizedTotal > 0 ? 'change up' : 'change down'}`}>
            {unrealizedTotal >= 0 ? '+' : ''}
            {formatInr(unrealizedTotal)}
          </div>
        </div>
        <div className="lab-stat">
          <div className="label">Realized P/L</div>
          <div className={`value ${realizedTotal === 0 ? '' : realizedTotal > 0 ? 'change up' : 'change down'}`}>
            {realizedTotal >= 0 ? '+' : ''}
            {formatInr(realizedTotal)}
          </div>
        </div>
      </div>

      <h3 className="section-title" style={{ fontSize: 14 }}>
        Open Position ({enrichedOpen.length})
      </h3>
      {enrichedOpen.length === 0 ? (
        <div className="empty-state">No open position yet — waiting for the next hourly automated run.</div>
      ) : (
        <div className="card table-wrap" style={{ marginBottom: 20 }}>
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Opened</th>
                <th>Entry</th>
                <th>Current</th>
                <th>Stop / Target</th>
                <th>Allocated</th>
                <th>Unrealized P/L</th>
              </tr>
            </thead>
            <tbody>
              {enrichedOpen.map((p) => (
                <tr key={p.id}>
                  <td>
                    {symbolOnly(p.ticker)}
                    {p.reason && (
                      <div className="help-text" style={{ margin: 0, maxWidth: 220, whiteSpace: 'normal' }}>
                        {p.reason}
                      </div>
                    )}
                  </td>
                  <td>
                    {new Date(p.openDate).toLocaleDateString()}
                    <div className="help-text" style={{ margin: 0 }}>{daysHeld(p.openDate)}d ago</div>
                  </td>
                  <td>{formatInr(p.entryPriceInr)}</td>
                  <td>
                    {formatInr(p.currentPrice)}
                    {p.isLive && <span className="live-dot" title="Live intraday price" />}
                  </td>
                  <td>
                    {formatInr(p.stopPriceInr)} / {formatInr(p.targetPriceInr)}
                  </td>
                  <td>{formatInr(p.allocatedInr)}</td>
                  <td className={p.unrealizedPnl >= 0 ? 'change up' : 'change down'}>
                    {p.unrealizedPnl >= 0 ? '+' : ''}
                    {formatInr(p.unrealizedPnl)} ({p.unrealizedPnlPct >= 0 ? '+' : ''}
                    {fmt(p.unrealizedPnlPct, 1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="section-title" style={{ fontSize: 14 }}>
        Closed Positions ({closed.length})
      </h3>
      {closed.length === 0 ? (
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
              {[...closed].reverse().map((p) => (
                <tr key={p.id}>
                  <td>{symbolOnly(p.ticker)}</td>
                  <td>{new Date(p.openDate).toLocaleDateString()}</td>
                  <td>{new Date(p.closeDate).toLocaleDateString()}</td>
                  <td>
                    {formatInr(p.entryPriceInr)} → {formatInr(p.exitPriceInr)}
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
        <div className="card">
          <h3 className="section-title" style={{ fontSize: 14 }}>
            Capital Over Time
          </h3>
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
