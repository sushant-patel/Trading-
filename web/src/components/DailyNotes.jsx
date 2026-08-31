import { useEffect, useState } from 'react'
import InfoTip from './InfoTip.jsx'

const DEFAULT_NOTES_URL = 'https://raw.githubusercontent.com/sushant-patel/Trading-/main/daily_notes.json'

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

export default function DailyNotes() {
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch(DEFAULT_NOTES_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setData(json)
        setStatus('ok')
      })
      .catch((err) => {
        setStatus('error')
        setErrorMsg(err.message || String(err))
      })
  }, [])

  const entries = [...(data?.entries ?? [])].sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div>
      <h3 className="section-title">
        Daily Notes
        <InfoTip text="A running log of analysis on the current watchlist, meant to accumulate one entry per day. Not yet automated — entries currently need to be added manually. Nothing here is a recommendation; it summarizes what the backtest and Watch tab show, in plain language." />
      </h3>

      <div className="basics-callout" style={{ borderColor: 'var(--amber)', background: 'rgba(232, 179, 57, 0.08)' }}>
        <div className="basics-callout-title" style={{ color: 'var(--amber)' }}>
          Not yet running automatically
        </div>
        <p>
          This tab reads <code>daily_notes.json</code> from the repo, the same way the rest of the dashboard reads{' '}
          <code>results.json</code>. Right now there's a single manually-added entry — turning this into an actual
          daily log needs a scheduled routine to run once a day, which hasn't been set up yet.
        </p>
      </div>

      {status === 'loading' && <div className="empty-state">Loading notes…</div>}
      {status === 'error' && (
        <div className="empty-state">Couldn't load daily notes ({errorMsg}). The file may not exist yet.</div>
      )}
      {status === 'ok' && entries.length === 0 && <div className="empty-state">No entries yet.</div>}

      {entries.map((e) => (
        <div className="card" key={e.date} style={{ marginBottom: 16 }}>
          <div className="trend-summary">
            <span className="trend-ticker" style={{ fontSize: 16 }}>
              {new Date(e.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            {e.author && <span className="trend-meta">by {e.author}</span>}
          </div>
          {e.summary && <p className="basics-body" style={{ marginTop: 8 }}>{e.summary}</p>}

          {e.featured && (
            <div className="featured-setup" style={{ marginTop: 4, marginBottom: 12 }}>
              <div className="kicker">Top backtested edge that day</div>
              <div className="headline">
                {e.featured.ticker} · {e.featured.tier}
              </div>
              <div className="sub">
                {e.featured.trades} trades · {fmt(e.featured.win_rate, 1)}% win rate · +{fmt(e.featured.total_return_pct)}%
                {e.runner_up && (
                  <>
                    {' '}
                    · runner-up: {e.runner_up.ticker} ({fmt(e.runner_up.total_return_pct)}%)
                  </>
                )}
              </div>
            </div>
          )}

          {e.watch_highlights?.length > 0 && (
            <>
              <div className="section-title" style={{ fontSize: 13, marginBottom: 6 }}>
                Closest to triggering
              </div>
              <ul className="limits-list" style={{ marginBottom: 12 }}>
                {e.watch_highlights.map((w) => (
                  <li key={w.ticker}>
                    <strong>{w.ticker}</strong> ({w.tier}) — {w.desc}, {w.distance_pct >= 0 ? '+' : ''}
                    {fmt(w.distance_pct)}% away
                  </li>
                ))}
              </ul>
            </>
          )}

          {e.notes && <p className="basics-body">{e.notes}</p>}
        </div>
      ))}
    </div>
  )
}
