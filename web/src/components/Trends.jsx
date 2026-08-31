import { useState } from 'react'
import InfoTip from './InfoTip.jsx'
import { Sparkline, TrendChart, CompareChart, CHART_GREEN, CHART_RED, CATEGORICAL_COLORS } from './Charts.jsx'

const TIMEFRAMES = [
  { key: '1m', label: '1M', days: 21 },
  { key: '3m', label: '3M', days: 63 },
  { key: 'all', label: 'All', days: null },
]

const VIEW_MODES = ['Single', 'Grid', 'Compare']
const MAX_COMPARE = 6

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

function sliceByTimeframe(history, tf) {
  return tf.days ? history.slice(-tf.days) : history
}

function periodChangePct(closes) {
  const first = closes[0]
  const last = closes[closes.length - 1]
  return first ? ((last - first) / first) * 100 : null
}

// Color by position within the CURRENT selection (an ordered array, capped at
// MAX_COMPARE === CATEGORICAL_COLORS.length), not by each ticker's fixed index
// in the full 18-ticker watchlist — indexing by the full list collided every
// 6 tickers (index 0 and 12 both landed on slot 0, e.g. NVDA and ORCL selected
// together got identical blue). Selection order is preserved by array
// push/filter, so an existing member's color only shifts if something earlier
// in the selection is removed — acceptable since removal already reflows.
function colorForTicker(ticker, selection) {
  const idx = selection.indexOf(ticker)
  return CATEGORICAL_COLORS[idx % CATEGORICAL_COLORS.length]
}

export default function Trends({ data, status, ticker, onSelectTicker }) {
  const [mode, setMode] = useState('Single')
  const [timeframe, setTimeframe] = useState('all')
  const [compareSelection, setCompareSelection] = useState(null)

  if (status === 'loading' && !data) {
    return <div className="empty-state">Loading trends…</div>
  }
  if (!data?.tickers?.length) {
    return <div className="empty-state">No trend data available yet.</div>
  }

  const tickers = data.tickers
  const selected = tickers.find((t) => t.ticker === ticker) ?? tickers[0]
  const tf = TIMEFRAMES.find((t) => t.key === timeframe)
  const selection = compareSelection ?? [selected.ticker]

  function toggleCompare(tk) {
    setCompareSelection((prev) => {
      const cur = prev ?? [selected.ticker]
      if (cur.includes(tk)) return cur.filter((x) => x !== tk)
      if (cur.length >= MAX_COMPARE) return cur
      return [...cur, tk]
    })
  }

  function goToTicker(tk) {
    onSelectTicker(tk)
    setMode('Single')
  }

  return (
    <div>
      <div className="trends-header">
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          Price Trend
          <InfoTip text="Daily closing price over the data window — the same bars the backtest runs against. Single shows one ticker with hover detail; Grid shows all 18 at a glance; Compare overlays a few, normalized to % change, so different price scales are comparable." />
        </h3>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="view-mode-row">
            {VIEW_MODES.map((m) => (
              <button
                key={m}
                className={`timeframe-btn ${mode === m ? 'active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m}
              </button>
            ))}
          </div>
          {mode !== 'Grid' && (
            <div className="timeframe-row">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  className={`timeframe-btn ${timeframe === t.key ? 'active' : ''}`}
                  onClick={() => setTimeframe(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {mode === 'Single' && (
            <select className="ticker-select" value={selected.ticker} onChange={(e) => onSelectTicker(e.target.value)}>
              {tickers.map((t) => (
                <option key={t.ticker} value={t.ticker}>
                  {t.ticker}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {mode === 'Single' && (
        <SingleView data={data} selected={selected} tf={tf} />
      )}

      {mode === 'Grid' && <GridView tickers={tickers} onSelect={goToTicker} />}

      {mode === 'Compare' && (
        <CompareView tickers={tickers} tf={tf} selection={selection} onToggle={toggleCompare} />
      )}
    </div>
  )
}

function SingleView({ data, selected, tf }) {
  const fullHistory = selected.history ?? []
  const slicedHistory = sliceByTimeframe(fullHistory, tf)
  const series = slicedHistory.map((h) => ({ date: h.date, value: h.close }))
  const change = periodChangePct(series.map((s) => s.value))

  return (
    <div className="card">
      <div className="trend-summary">
        <div>
          <span className="trend-ticker">{selected.ticker}</span>
          <span className="trend-meta">
            {tf.label} view · {series.length} sessions
          </span>
        </div>
        {change !== null && (
          <span className={change >= 0 ? 'change up' : 'change down'} style={{ fontSize: 15 }}>
            {change >= 0 ? '+' : ''}
            {fmt(change)}% over {tf.label === 'All' ? 'full period' : tf.label}
          </span>
        )}
      </div>
      <TrendChart series={series} color={change >= 0 ? CHART_GREEN : CHART_RED} />
    </div>
  )
}

function GridView({ tickers, onSelect }) {
  return (
    <div className="trend-grid">
      {tickers.map((t) => {
        const closes = (t.history ?? []).map((h) => h.close)
        const change = periodChangePct(closes)
        const color = change >= 0 ? CHART_GREEN : CHART_RED
        return (
          <div key={t.ticker} className="trend-grid-card" onClick={() => onSelect(t.ticker)}>
            <div className="row1">
              <span style={{ fontWeight: 600 }}>{t.ticker}</span>
              {change !== null && (
                <span className={change >= 0 ? 'change up' : 'change down'} style={{ fontSize: 12 }}>
                  {change >= 0 ? '+' : ''}
                  {fmt(change)}%
                </span>
              )}
            </div>
            <Sparkline values={closes} width={200} height={44} color={color} />
          </div>
        )
      })}
    </div>
  )
}

function CompareView({ tickers, tf, selection, onToggle }) {
  const seriesList = selection
    .map((tk) => {
      const t = tickers.find((x) => x.ticker === tk)
      if (!t) return null
      const hist = sliceByTimeframe(t.history ?? [], tf)
      if (hist.length < 2) return null
      const base = hist[0].close
      const points = hist.map((h) => ({ date: h.date, value: base ? ((h.close - base) / base) * 100 : 0 }))
      return { ticker: tk, color: colorForTicker(tk, selection), points }
    })
    .filter(Boolean)

  return (
    <div>
      <div className="compare-picker">
        {tickers.map((t) => {
          const active = selection.includes(t.ticker)
          const disabled = !active && selection.length >= MAX_COMPARE
          return (
            <button
              key={t.ticker}
              className={`compare-chip ${active ? 'active' : ''}`}
              style={active ? { borderColor: colorForTicker(t.ticker, selection), color: colorForTicker(t.ticker, selection) } : {}}
              disabled={disabled}
              onClick={() => onToggle(t.ticker)}
            >
              {t.ticker}
            </button>
          )
        })}
      </div>
      <div className="help-text" style={{ marginBottom: 12 }}>
        Up to {MAX_COMPARE} at once, normalized to % change from the start of the selected timeframe so different
        price scales are comparable.
      </div>
      <div className="card">
        <CompareChart seriesList={seriesList} />
      </div>
    </div>
  )
}
