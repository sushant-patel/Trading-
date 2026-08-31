import { useEffect, useMemo, useState } from 'react'
import InfoTip from './components/InfoTip.jsx'
import { getUsdInrRate, formatInr } from './lib/currency.js'

const DEFAULT_DATA_URL =
  'https://raw.githubusercontent.com/sushant-patel/Trading-/main/results.json'

const STORAGE_KEYS = {
  dataUrl: 'tt_data_source_url',
  journal: 'tt_journal_entries',
}

const TABS = ['Watchlist', 'Backtest', 'Calculator', 'Journal', 'Settings']

const TIER_INFO = {
  high: "High volatility tier (avg daily range ≥ 3.5%). Strategy: Opening Range Breakout — enters long when price closes above the prior day's high.",
  medium: '2.5–3.5% avg daily range. Strategy: VWAP Trend Pullback — enters long when price pulls back to its 20-day average within an uptrend.',
  low: '< 2.5% avg daily range. Strategy: Range Fade / Mean Reversion — enters long when price dips below a recent low and reclaims it.',
}

function inrEquivalent(usdAmount, fx) {
  if (!fx?.rate || usdAmount === null || usdAmount === undefined || Number.isNaN(usdAmount)) return null
  return formatInr(usdAmount * fx.rate)
}

function loadDataUrl() {
  try {
    return localStorage.getItem(STORAGE_KEYS.dataUrl) || DEFAULT_DATA_URL
  } catch {
    return DEFAULT_DATA_URL
  }
}

function loadJournal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.journal)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveJournal(entries) {
  try {
    localStorage.setItem(STORAGE_KEYS.journal, JSON.stringify(entries))
  } catch {
    // localStorage unavailable (private browsing, quota, etc.) — entries stay in-memory only
  }
}

function fmt(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return Number(n).toFixed(digits)
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Watchlist')
  const [dataUrl, setDataUrl] = useState(loadDataUrl)
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState('')
  const [lastFetched, setLastFetched] = useState(null)
  const [journal, setJournal] = useState(loadJournal)
  const [fx, setFx] = useState(null)

  function refreshFx() {
    getUsdInrRate().then(setFx)
  }

  useEffect(() => {
    refreshFx()
  }, [])

  async function fetchData(url) {
    setStatus('loading')
    setErrorMsg('')
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.tickers) throw new Error('Response missing "tickers" field')
      setData(json)
      setStatus('ok')
      setLastFetched(new Date())
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message || String(err))
    }
  }

  useEffect(() => {
    fetchData(dataUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSaveSettings(newUrl) {
    setDataUrl(newUrl)
    try {
      localStorage.setItem(STORAGE_KEYS.dataUrl, newUrl)
    } catch {
      // ignore — falls back to in-memory only for this session
    }
    fetchData(newUrl)
  }

  function addJournalEntry(entry) {
    const updated = [entry, ...journal]
    setJournal(updated)
    saveJournal(updated)
  }

  function deleteJournalEntry(id) {
    const updated = journal.filter((e) => e.id !== id)
    setJournal(updated)
    saveJournal(updated)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Trading Tracker</h1>
          <div className="subtitle">
            Watchlist · Backtest · Position Sizing · Journal
          </div>
        </div>
      </header>

      <StatusBar
        status={status}
        errorMsg={errorMsg}
        lastFetched={lastFetched}
        onRefresh={() => fetchData(dataUrl)}
        generatedAt={data?.generated_at}
      />

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Watchlist' && <Watchlist data={data} status={status} fx={fx} />}
      {activeTab === 'Backtest' && <Backtest data={data} status={status} />}
      {activeTab === 'Calculator' && <Calculator fx={fx} />}
      {activeTab === 'Journal' && (
        <Journal
          entries={journal}
          onAdd={addJournalEntry}
          onDelete={deleteJournalEntry}
          tickers={data?.tickers?.map((t) => t.ticker) ?? []}
          fx={fx}
        />
      )}
      {activeTab === 'Settings' && (
        <Settings
          currentUrl={dataUrl}
          onSave={handleSaveSettings}
          status={status}
          errorMsg={errorMsg}
          fx={fx}
          onRefreshFx={refreshFx}
        />
      )}
    </div>
  )
}

function StatusBar({ status, errorMsg, lastFetched, onRefresh, generatedAt }) {
  const dotClass =
    status === 'ok' ? 'ok' : status === 'error' ? 'error' : status === 'loading' ? 'loading' : ''

  let label = 'Idle'
  if (status === 'loading') label = 'Loading data…'
  else if (status === 'ok') label = `Data loaded${generatedAt ? ` · generated ${new Date(generatedAt).toLocaleString()}` : ''}`
  else if (status === 'error') label = `Failed to load data: ${errorMsg}`

  return (
    <div className="status-bar">
      <span className={`status-dot ${dotClass}`} />
      <span>{label}</span>
      {lastFetched && <span>· fetched {lastFetched.toLocaleTimeString()}</span>}
      <button className="refresh-btn" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  )
}

function Watchlist({ data, status, fx }) {
  if (status === 'loading' && !data) {
    return <div className="empty-state">Loading watchlist…</div>
  }
  if (status === 'error' && !data) {
    return (
      <div className="empty-state">
        Couldn't load data. Check the data source URL in Settings.
      </div>
    )
  }
  if (!data?.tickers?.length) {
    return <div className="empty-state">No ticker data available yet.</div>
  }

  return (
    <div className="grid">
      {data.tickers.map((t) => (
        <div className="ticker-card" key={t.ticker}>
          <div className="row1">
            <span className="ticker">{t.ticker}</span>
            <span className={`tier-badge ${t.tier}`}>
              {t.tier}
              <InfoTip text={TIER_INFO[t.tier] || 'Volatility tier for this ticker.'} />
            </span>
          </div>
          <div className="price">${fmt(t.last_close)}</div>
          {fx?.rate && <div className="price-inr">≈ {inrEquivalent(t.last_close, fx)}</div>}
          <div className={`change ${t.last_change_pct >= 0 ? 'up' : 'down'}`}>
            {t.last_change_pct >= 0 ? '+' : ''}
            {fmt(t.last_change_pct)}%
          </div>
          <div className="meta">
            <span>
              Avg range <strong>{fmt(t.avg_range_pct)}%</strong>
              <InfoTip text="Average daily (High−Low)/Close range over the lookback period. This one number decides the tier (and therefore the strategy) above: ≥3.5% = high, 2.5–3.5% = medium, <2.5% = low." />
            </span>
            <span>
              Win rate <strong>{fmt(t.win_rate, 1)}%</strong>
              <InfoTip text={`% of backtested trades that closed profitable over "${data.period}". Based on only ${t.trades} trade${t.trades === 1 ? '' : 's'} here — too small a sample to trust as a real predictor, treat it as directional only.`} />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Backtest({ data, status }) {
  if (status === 'loading' && !data) {
    return <div className="empty-state">Loading backtest results…</div>
  }
  if (!data?.tickers?.length) {
    return <div className="empty-state">No backtest data available yet.</div>
  }

  const rows = [...data.tickers].sort((a, b) => b.total_return_pct - a.total_return_pct)

  return (
    <div>
      <h3 className="section-title">
        Backtest Results ({data.period})
        <InfoTip text="Each ticker's tier strategy re-run against its own recent price history. This runs on DAILY bars as an approximation — not a true intraday backtest — and ignores fees, slippage, and spread. It's a rough edge check, not a live track record." />
      </h3>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Tier</th>
              <th>Avg Range %</th>
              <th>
                Trades
                <InfoTip text="Number of times the strategy's entry condition triggered during the backtest window. Zero means the setup just didn't occur — not that the stock is bad." />
              </th>
              <th>
                Win Rate
                <InfoTip text="% of those trades that closed profitable. Small trade counts make this noisy — a longer --period gives a more reliable read." />
              </th>
              <th>
                Total Return
                <InfoTip text="Sum of % gain/loss across all backtested trades for this ticker. Not compounded, not risk-adjusted, and not a real balance change." />
              </th>
            </tr>
          </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.ticker}>
              <td>{t.ticker}</td>
              <td style={{ textTransform: 'capitalize' }}>{t.tier}</td>
              <td>{fmt(t.avg_range_pct)}%</td>
              <td>{t.trades}</td>
              <td>{fmt(t.win_rate, 1)}%</td>
              <td className={t.total_return_pct >= 0 ? 'change up' : 'change down'}>
                {t.total_return_pct >= 0 ? '+' : ''}
                {fmt(t.total_return_pct)}%
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Calculator({ fx }) {
  const [accountSize, setAccountSize] = useState(10000)
  const [riskPct, setRiskPct] = useState(1)
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')

  const result = useMemo(() => {
    const acct = parseFloat(accountSize)
    const risk = parseFloat(riskPct)
    const e = parseFloat(entry)
    const s = parseFloat(stop)
    if (!acct || !risk || !e || !s || e === s) return null

    const riskAmount = acct * (risk / 100)
    const perShareRisk = Math.abs(e - s)
    const shares = Math.floor(riskAmount / perShareRisk)
    const positionValue = shares * e

    return {
      riskAmount,
      perShareRisk,
      shares,
      positionValue,
      pctOfAccount: (positionValue / acct) * 100,
    }
  }, [accountSize, riskPct, entry, stop])

  return (
    <div className="card">
      <h3 className="section-title">
        Position Size Calculator
        <InfoTip text="Answers one question: how many shares can I buy without risking more than I'm comfortable losing on this single trade? It doesn't know your real account or place any order — it's just the math." />
      </h3>
      <div className="form-grid">
        <div className="field">
          <label>
            Account size ($)
            <InfoTip text="Total capital in your trading account. Only used to compute the risk amount below." />
          </label>
          <input
            type="number"
            value={accountSize}
            onChange={(e) => setAccountSize(e.target.value)}
          />
          {fx?.rate && accountSize && <div className="help-text">≈ {inrEquivalent(parseFloat(accountSize), fx)}</div>}
        </div>
        <div className="field">
          <label>
            Risk per trade (%)
            <InfoTip text="The max % of your account you're willing to lose if this trade hits its stop. 0.5–1% is a common starting convention so no single loss meaningfully damages the account — that's a general guideline, not personalized advice for your situation." />
          </label>
          <input
            type="number"
            step="0.1"
            value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Entry price ($)
            <InfoTip text="The price you plan to buy at." />
          </label>
          <input
            type="number"
            step="0.01"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        </div>
        <div className="field">
          <label>
            Stop price ($)
            <InfoTip text="The price at which you'd exit to cap the loss if the trade goes against you. Below entry for a long, above entry for a short." />
          </label>
          <input
            type="number"
            step="0.01"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
          />
        </div>
      </div>

      {result ? (
        <div className="result-box">
          <div className="line">
            <span className="label">
              Risk amount
              <InfoTip text="Account size × risk % — the dollar amount you stand to lose if the stop is hit." />
            </span>
            <span className="value">
              ${fmt(result.riskAmount)}
              {fx?.rate && <span className="value-sub"> ({inrEquivalent(result.riskAmount, fx)})</span>}
            </span>
          </div>
          <div className="line">
            <span className="label">
              Risk per share
              <InfoTip text="|Entry − Stop| — how much you lose per share if stopped out." />
            </span>
            <span className="value">${fmt(result.perShareRisk)}</span>
          </div>
          <div className="line total">
            <span className="label">
              Shares to buy
              <InfoTip text="Risk amount ÷ risk per share, rounded down. This is the position size that keeps your loss at exactly the risk amount above if the stop is hit." />
            </span>
            <span className="value">{result.shares.toLocaleString()}</span>
          </div>
          <div className="line">
            <span className="label">Position value</span>
            <span className="value">
              ${fmt(result.positionValue)}
              {fx?.rate && <span className="value-sub"> ({inrEquivalent(result.positionValue, fx)})</span>}
            </span>
          </div>
          <div className="line">
            <span className="label">
              % of account
              <InfoTip text="Position value as a % of account size — a sanity check against putting too much capital into one trade, separately from the risk % above." />
            </span>
            <span className="value">{fmt(result.pctOfAccount)}%</span>
          </div>
        </div>
      ) : (
        <div className="help-text">Enter account size, risk %, entry, and stop to calculate position size.</div>
      )}
    </div>
  )
}

function Journal({ entries, onAdd, onDelete, tickers, fx }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    ticker: tickers[0] || '',
    direction: 'long',
    entry: '',
    exit: '',
    size: '',
    notes: '',
  })

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.ticker || !form.entry) return

    const entryPrice = parseFloat(form.entry)
    const exitPrice = parseFloat(form.exit)
    const size = parseFloat(form.size) || 0
    let pnl = null
    if (!Number.isNaN(exitPrice) && form.exit !== '') {
      const diff = form.direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
      pnl = diff * (size || 1)
    }

    onAdd({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      ...form,
      entry: entryPrice,
      exit: form.exit === '' ? null : exitPrice,
      size,
      pnl,
    })

    setForm((f) => ({ ...f, entry: '', exit: '', size: '', notes: '' }))
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">
          Log a Trade
          <InfoTip text="Your own trade history, typed in by hand — this app can't see your broker. Saved only in this browser's localStorage, so it won't show up on another device or browser." />
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Date</label>
              <input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} />
            </div>
            <div className="field">
              <label>Ticker</label>
              <input
                type="text"
                value={form.ticker}
                onChange={(e) => update('ticker', e.target.value.toUpperCase())}
                placeholder="e.g. NVDA"
                required
              />
            </div>
            <div className="field">
              <label>Direction</label>
              <select value={form.direction} onChange={(e) => update('direction', e.target.value)}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </div>
            <div className="field">
              <label>Shares</label>
              <input type="number" value={form.size} onChange={(e) => update('size', e.target.value)} />
            </div>
            <div className="field">
              <label>Entry price ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.entry}
                onChange={(e) => update('entry', e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Exit price ($, optional)</label>
              <input type="number" step="0.01" value={form.exit} onChange={(e) => update('exit', e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Setup, reasoning, what went right/wrong…" />
          </div>
          <button type="submit" className="btn">
            Add entry
          </button>
        </form>
      </div>

      <h3 className="section-title">History ({entries.length})</h3>
      {entries.length === 0 ? (
        <div className="empty-state">No journal entries yet — log your first trade above.</div>
      ) : (
        entries.map((e) => (
          <div className="journal-entry" key={e.id}>
            <div className="top-row">
              <div>
                <span className="ticker-tag">{e.ticker}</span>
                <span style={{ textTransform: 'capitalize', color: 'var(--text-dim)', fontSize: 12 }}>
                  {e.direction}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="date">{e.date}</span>
                <button className="btn danger" onClick={() => onDelete(e.id)}>
                  Delete
                </button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Entry ${fmt(e.entry)}
              {e.exit !== null && <> · Exit ${fmt(e.exit)}</>}
              {e.size ? <> · {e.size} shares</> : null}
              {e.pnl !== null && (
                <>
                  {' · P/L '}
                  <span className={e.pnl >= 0 ? 'pnl up' : 'pnl down'}>
                    {e.pnl >= 0 ? '+' : ''}
                    {fmt(e.pnl)}
                    {fx?.rate && ` (${e.pnl >= 0 ? '+' : ''}${inrEquivalent(e.pnl, fx)})`}
                  </span>
                  <InfoTip text="Estimated as (Exit − Entry) × Shares, reversed for shorts. Doesn't include commissions, fees, spread, or tax." />
                </>
              )}
            </div>
            {e.notes && <div className="notes">{e.notes}</div>}
          </div>
        ))
      )}
    </div>
  )
}

function Settings({ currentUrl, onSave, status, errorMsg, fx, onRefreshFx }) {
  const [url, setUrl] = useState(currentUrl)
  const [taxOpen, setTaxOpen] = useState(false)

  return (
    <div>
      <div className="card settings-form" style={{ marginBottom: 16 }}>
        <h3 className="section-title">
          Data Source
          <InfoTip text="The daily GitHub Action fetches prices, runs the strategy, and commits results.json to the repo. This URL is where the dashboard fetches that file from — plain fetch() in your browser, no backend." />
        </h3>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>results.json URL</label>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="help-text">
            Points at the raw <code>results.json</code> committed by the daily GitHub Action, e.g.{' '}
            <code>https://raw.githubusercontent.com/&lt;user&gt;/&lt;repo&gt;/main/results.json</code>. This only
            works if the repo is public — a private repo's raw files aren't fetchable from the browser without a
            token. Saved in this browser only.
          </div>
        </div>
        <button className="btn" onClick={() => onSave(url)}>
          Save &amp; refresh
        </button>
        {status === 'error' && (
          <div className="help-text" style={{ color: 'var(--red)', marginTop: 10 }}>
            Last attempt failed: {errorMsg}
          </div>
        )}
      </div>

      <div className="card settings-form" style={{ marginBottom: 16 }}>
        <h3 className="section-title">
          Currency Conversion
          <InfoTip text="Live USD→INR mid-market rate from a public FX API, cached for 6 hours. This is NOT the rate your broker will actually give you — real conversions carry a spread/markup, and LRS remittances add TCS on top (see Tax Notes below). Treat these ₹ figures as indicative only." />
        </h3>
        {fx?.rate ? (
          <div style={{ fontSize: 14 }}>
            1 USD ≈ <strong>₹{fx.rate.toFixed(2)}</strong>
            {fx.stale && <span style={{ color: 'var(--amber)' }}> (showing last cached rate — refresh failed)</span>}
            <div className="help-text">Fetched {new Date(fx.fetchedAt).toLocaleString()}</div>
          </div>
        ) : (
          <div className="help-text">Fetching live rate…</div>
        )}
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={onRefreshFx}>
          Refresh rate
        </button>
      </div>

      <div className="card settings-form">
        <h3 className="section-title" style={{ cursor: 'pointer' }} onClick={() => setTaxOpen((o) => !o)}>
          {taxOpen ? '▾' : '▸'} Tax Notes — India
          <InfoTip text="General educational notes only, not tax advice. Rates and thresholds change with each Union Budget — verify current rules with a CA before filing." />
        </h3>
        {taxOpen && (
          <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
            <p>
              For an Indian resident buying US stocks directly, gains are generally treated as capital gains on
              foreign (unlisted) equity:
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Short-term (held ≤ 24 months):</strong> gains are added to
              your total income and taxed at your regular income-tax slab rate — not a flat rate.
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Long-term (held &gt; 24 months):</strong> currently taxed at a
              flat <strong style={{ color: 'var(--text)' }}>12.5%</strong> plus applicable surcharge and cess, with
              no indexation benefit.
            </p>
            <p>
              <strong style={{ color: 'var(--text)' }}>Remitting money abroad (LRS):</strong> the first{' '}
              <strong style={{ color: 'var(--text)' }}>₹10 lakh</strong> per financial year has no TCS; amounts
              remitted for investment above that are subject to{' '}
              <strong style={{ color: 'var(--text)' }}>20% TCS</strong>. TCS isn't an extra tax — it's adjustable
              against your final income-tax liability when you file.
            </p>
            <p style={{ marginTop: 10, fontStyle: 'italic' }}>
              This is general, illustrative information, not personalized tax advice, and none of it is computed
              from your actual trades — the Journal tab doesn't factor holding periods or tax lots. Confirm current
              rates with a chartered accountant before relying on this for filing.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
