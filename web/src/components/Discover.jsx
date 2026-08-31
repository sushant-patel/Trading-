import { useEffect, useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { TrendChart, CHART_BLUE, CHART_GREEN } from './Charts.jsx'
import { runRandomSearch, validatedLeaderboard, MIN_TRADES_FLOOR, MIN_TEST_TRADES_FLOOR, TRAIN_FRACTION } from '../lib/strategySearch.js'

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

function TrainTestTable({ rows, title, infoText, emphasize }) {
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
            <th className={emphasize === 'train' ? '' : ''}>Train Return</th>
            <th className={emphasize === 'test' ? '' : ''}>
              Test Return
              <InfoTip text="Same parameters, re-run against the ~30% of history held out from training — data this combination never had a chance to fit itself to." />
            </th>
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
              <td>
                <ReturnCell trades={r.trainTrades} ret={r.trainReturn} />
              </td>
              <td>
                <ReturnCell trades={r.testTrades} ret={r.testReturn} />
                {r.validated && <span className="status-flag near-target" style={{ marginLeft: 6 }}>held up</span>}
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
  const [liveValidated, setLiveValidated] = useState(null)
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
      setLiveValidated(validatedLeaderboard(results, 10))
      setRunning(false)
    }, 10)
  }

  const equitySeries =
    search?.run_history?.map((h) => ({ date: h.date, value: h.bestValidatedReturn ?? h.bestReturn ?? 0 })) ?? []

  return (
    <div>
      <h3 className="section-title">
        Discover
        <InfoTip text="Automated random search: tries many combinations of (ticker × entry rule × stop distance × target multiple) through the same backtest engine the Lab tab uses. Every combination is fit on ~70% of the history and then re-checked, unchanged, against the other ~30% it never saw — that check is what separates a real pattern from a lucky fit. Runs on a schedule." />
      </h3>

      <div className="basics-callout critical" style={{ marginBottom: 20 }}>
        <div className="basics-callout-title">⚠ Why this tab has two leaderboards, not one</div>
        <p style={{ marginBottom: 8 }}>
          Testing hundreds of random combinations against one fixed slice of history <strong>will</strong> turn up
          spuriously good-looking results by chance alone. This isn't hypothetical — it's the last search run's own
          top training result: <strong>+{fmt(search?.leaderboard?.[0]?.trainReturn)}%</strong> in training,{' '}
          <strong>{fmt(search?.leaderboard?.[0]?.testReturn)}%</strong> on data it never saw. It looked great and
          then lost money the moment it was checked.
        </p>
        <p style={{ marginBottom: 0 }}>
          "Latest Search" below is ranked by training return — the overfitting-prone view, shown for transparency.
          "Held Up Out-of-Sample" is ranked by test return, restricted to combinations that were also profitable on
          the held-out ~30%. Trust the second one more — though with only a few weeks of held-out data, "validated"
          here means "some real evidence," not "proven."
        </p>
      </div>

      {searchStatus === 'loading' && <div className="empty-state">Loading search results…</div>}
      {searchStatus === 'error' && <div className="empty-state">Couldn't load strategy_search.json — it may not exist yet.</div>}

      {searchStatus === 'ok' && search && (
        <>
          <div className="status-bar" style={{ marginBottom: 16 }}>
            <span>
              Last run {new Date(search.updated_at).toLocaleString()} · {search.trials_last_run} trials · {search.trials_total_ever} total ever · train/test
              split {Math.round((search.train_fraction ?? TRAIN_FRACTION) * 100)}/{Math.round((1 - (search.train_fraction ?? TRAIN_FRACTION)) * 100)} ·
              min {search.min_trades_floor ?? MIN_TRADES_FLOOR} train / {search.min_test_trades_floor ?? MIN_TEST_TRADES_FLOOR} test trades to qualify
            </span>
          </div>

          {search.best_ever ? (
            <div className="featured-setup" style={{ marginBottom: 20 }}>
              <div className="kicker">
                Best Ever Found (Out-of-Sample Validated)
                <InfoTip text="The best test-period return among all combinations that held up out-of-sample, across every search run so far. Re-checked every run against fresh data, so it can still be displaced if something better turns up — or if this one stops holding up." />
              </div>
              <div className="headline">
                {search.best_ever.ticker} · {TIER_RULE_LABEL[search.best_ever.tierRule] ?? search.best_ever.tierRule}
              </div>
              <div className="sub">
                stop {fmt(search.best_ever.stopFrac)} / target {fmt(search.best_ever.targetMult, 1)}× · train {search.best_ever.trainTrades}t{' '}
                {fmt(search.best_ever.trainReturn)}% · test {search.best_ever.testTrades}t +{fmt(search.best_ever.testReturn)}% · found{' '}
                {search.best_ever.foundOn}
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
                <InfoTip text="The best out-of-sample (test-period) return found on each search run. This is the trend worth watching — an upward line here means genuinely better ideas are turning up, not just noisier ones." />
              </h3>
              <TrendChart series={equitySeries} color={CHART_GREEN} yFormat={(v) => `${v.toFixed(0)}%`} />
            </div>
          )}

          <TrainTestTable
            rows={search.validated_leaderboard ?? []}
            title="Held Up Out-of-Sample — Top 10"
            infoText="Ranked by test-period return, restricted to combinations that stayed profitable on data they never trained on."
            emphasize="test"
          />

          <TrainTestTable
            rows={search.leaderboard ?? []}
            title="Latest Search — Top 10 by Training Return (overfitting-prone view)"
            infoText="Ranked by training return only. Compare each row's Train vs Test column yourself — a big gap, or a negative Test, is the overfitting signature in action."
            emphasize="train"
          />
        </>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title" style={{ fontSize: 14 }}>
          Try a Search Yourself
          <InfoTip text="Runs 500 fresh random trials right in your browser against the data already loaded, with the same train/test split. Purely exploratory — nothing here is saved or published, unlike the scheduled search above." />
        </h3>
        <button className="btn" onClick={runLiveSearch} disabled={running}>
          {running ? 'Running 500 trials…' : 'Run 500 trials now'}
        </button>
        {liveResults && (
          <div style={{ marginTop: 16 }}>
            <TrainTestTable rows={liveValidated} title="Your Live Run — Held Up Out-of-Sample (not saved)" emphasize="test" />
            <TrainTestTable rows={liveResults} title="Your Live Run — Top 10 by Training Return (not saved)" emphasize="train" />
          </div>
        )}
      </div>
    </div>
  )
}
