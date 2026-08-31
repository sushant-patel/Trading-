import InfoTip from './InfoTip.jsx'
import { computeTriggerLevel } from '../lib/signals.js'

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

const NEAR_THRESHOLD_PCT = 1.5

export default function Watch({ data, status, onSelectTicker }) {
  if (status === 'loading' && !data) {
    return <div className="empty-state">Loading…</div>
  }
  if (!data?.tickers?.length) {
    return <div className="empty-state">No data available yet.</div>
  }

  const rows = data.tickers
    .map((t) => {
      const trig = computeTriggerLevel(t.history, t.tier)
      if (!trig) return null
      return { ...t, ...trig }
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))

  const near = rows.filter((r) => Math.abs(r.distancePct) <= NEAR_THRESHOLD_PCT)

  return (
    <div>
      <h3 className="section-title">
        Tomorrow's Watch
        <InfoTip text="This does NOT predict which way any price moves. It's a mechanical readout: the exact level that would trigger each ticker's tier rule on the next session, computed only from data already known today. The Medium-tier level is an approximation — the real rule's 20-day average shifts slightly once tomorrow's own close is known, so treat it as close, not exact." learnId="tomorrows-watch" />
      </h3>
      <p className="watch-disclaimer">
        Sorted by distance to trigger — closest first. This is not a forecast of direction, only of what price
        would mechanically fire each ticker's rule.
      </p>

      {near.length > 0 && (
        <div className="featured-setup" style={{ marginBottom: 20 }}>
          <div className="kicker">
            Within {NEAR_THRESHOLD_PCT}% of triggering
            <InfoTip text="Tickers whose trigger level is close enough that a normal day's move could reach it. Doesn't mean it will — only that it's worth watching tomorrow." />
          </div>
          {near.map((r) => (
            <div key={r.ticker} className="watch-near-row">
              <strong>{r.ticker}</strong> ({r.tier}) — {r.desc}, currently{' '}
              <span className={r.distancePct >= 0 ? 'change up' : 'change down'}>
                {r.distancePct >= 0 ? '+' : ''}
                {fmt(r.distancePct)}%
              </span>{' '}
              away
            </div>
          ))}
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Tier</th>
              <th>Last Close</th>
              <th>
                Trigger Level
                <InfoTip text="The reference price from the tier's own rule — today's high (High tier), ~20-day average (Medium), or 10-day low (Low)." />
              </th>
              <th>Distance</th>
              <th>What has to happen</th>
              <th>
                Track record
                <InfoTip text="This ticker's own backtested trades/win-rate/return over the current data window — context for how much to trust a signal here if it fires." />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="clickable-row" onClick={() => onSelectTicker?.(r.ticker)}>
                <td style={{ fontWeight: 600 }}>{r.ticker}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.tier}</td>
                <td>${fmt(r.last_close)}</td>
                <td>${fmt(r.level)}</td>
                <td className={r.distancePct >= 0 ? 'change up' : 'change down'}>
                  {r.distancePct >= 0 ? '+' : ''}
                  {fmt(r.distancePct)}%
                </td>
                <td className="help-text" style={{ margin: 0 }}>
                  {r.desc}
                </td>
                <td className="help-text" style={{ margin: 0 }}>
                  {r.trades === 0 ? 'no trades yet' : `${r.trades} trades, ${fmt(r.win_rate, 0)}% win`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
