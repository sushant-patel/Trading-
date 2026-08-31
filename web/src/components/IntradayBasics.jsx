import { useState } from 'react'

const PROGRESS_KEY = 'tt_learn_basics_reviewed'
const RULES_KEY = 'tt_learn_rules_checked'

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveSet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // localStorage unavailable — progress just won't persist across reloads
  }
}

// ---------- Illustrations (plain inline SVG, no chart library) ----------

function DayTimeline() {
  const width = 720
  const height = 90
  const padStart = 40
  const padEnd = 40
  const trackY = 46
  const startMin = 9 * 60 + 15
  const endMin = 15 * 60 + 30
  const totalMin = endMin - startMin
  const xFor = (hh, mm) => padStart + ((hh * 60 + mm - startMin) / totalMin) * (width - padStart - padEnd)

  const segments = [
    { from: [9, 15], to: [10, 30], color: 'var(--green)' },
    { from: [10, 30], to: [13, 30], color: 'var(--border)' },
    { from: [13, 30], to: [15, 15], color: 'var(--green)' },
    { from: [15, 15], to: [15, 30], color: 'var(--amber)' },
  ]
  const ticks = [
    [9, 15, '9:15 Open'],
    [10, 30, '10:30'],
    [13, 30, '1:30'],
    [15, 30, '3:30 Close'],
  ]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="basics-illustration">
      {segments.map((s, i) => (
        <rect
          key={i}
          x={xFor(...s.from)}
          y={trackY}
          width={xFor(...s.to) - xFor(...s.from)}
          height="14"
          rx="3"
          fill={s.color}
          opacity={s.color === 'var(--border)' ? 1 : 0.55}
        />
      ))}
      {ticks.map(([hh, mm, label], i) => (
        <g key={i}>
          <line x1={xFor(hh, mm)} x2={xFor(hh, mm)} y1={trackY - 4} y2={trackY + 18} className="chart-gridline" />
          <text x={xFor(hh, mm)} y={trackY - 10} textAnchor="middle" className="chart-axis-label">
            {label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function TradeFlowComparison() {
  return (
    <div className="flow-compare">
      <div className="flow-row">
        <div className="flow-kicker intraday">Intraday (MIS)</div>
        <div className="flow-track">
          <div className="flow-step buy">Buy</div>
          <div className="flow-arrow">same session →</div>
          <div className="flow-step sell">Sell</div>
        </div>
        <div className="flow-note">Must close by ~3:15 PM. Broker auto-squares-off if you don't. No overnight price risk — but no overnight upside either.</div>
      </div>
      <div className="flow-row">
        <div className="flow-kicker delivery">Delivery / Investment (CNC)</div>
        <div className="flow-track">
          <div className="flow-step buy">Buy</div>
          <div className="flow-arrow">held, any duration →</div>
          <div className="flow-step sell">Sell (whenever)</div>
        </div>
        <div className="flow-note">Shares actually land in your demat account. Full price risk while held, but no forced exit time.</div>
      </div>
    </div>
  )
}

function CashVsMarginComparison() {
  return (
    <div className="flow-compare">
      <div className="flow-row">
        <div className="flow-kicker delivery">Cash account</div>
        <div className="flow-note" style={{ marginBottom: 0 }}>
          You trade with your own available funds — no borrowing. Simpler, lower risk of large losses, but capital
          availability and settlement timing can limit how often you can round-trip. This is the ONLY option for
          this app's US-stock watchlist when trading from India via LRS — see the callout above.
        </div>
      </div>
      <div className="flow-row">
        <div className="flow-kicker intraday">Margin account</div>
        <div className="flow-note" style={{ marginBottom: 0 }}>
          The broker lends you extra buying power. Example: $5,000 equity controlling a $20,000 position — a 5%
          adverse move is a $1,000 loss, which is <strong>20% of your actual $5,000</strong>, not 5%. Leverage
          multiplies losses exactly as much as gains. Not available on this app's US stocks from India, at all.
        </div>
      </div>
    </div>
  )
}

function CandlestickIllustration() {
  const candles = [
    { wickTop: 15, bodyTop: 30, bodyBottom: 50, wickBottom: 60, up: true },
    { wickTop: 25, bodyTop: 40, bodyBottom: 62, wickBottom: 80, up: false },
    { wickTop: 10, bodyTop: 25, bodyBottom: 42, wickBottom: 52, up: true },
    { wickTop: 32, bodyTop: 45, bodyBottom: 68, wickBottom: 76, up: false },
    { wickTop: 8, bodyTop: 22, bodyBottom: 48, wickBottom: 58, up: true },
  ]
  const width = 420
  const height = 100
  const gap = 78

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="basics-illustration">
      {candles.map((c, i) => {
        const x = 45 + i * gap
        const color = c.up ? 'var(--green)' : 'var(--red)'
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={c.wickTop} y2={c.wickBottom} stroke={color} strokeWidth="1.5" />
            <rect x={x - 9} y={c.bodyTop} width="18" height={c.bodyBottom - c.bodyTop} fill={color} rx="1.5" opacity="0.85" />
          </g>
        )
      })}
      <text x="45" y="94" textAnchor="middle" className="chart-axis-label">up</text>
      <text x="123" y="94" textAnchor="middle" className="chart-axis-label">down</text>
      <text x="201" y="94" textAnchor="middle" className="chart-axis-label">up</text>
      <text x="279" y="94" textAnchor="middle" className="chart-axis-label">down</text>
      <text x="357" y="94" textAnchor="middle" className="chart-axis-label">up</text>
    </svg>
  )
}

function SupportResistanceIllustration() {
  const width = 400
  const height = 110
  const points = [[10, 70], [70, 38], [130, 74], [190, 40], [250, 72], [310, 36], [390, 66]]
  const resistanceY = 37
  const supportY = 73

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="basics-illustration">
      <line x1="0" x2={width} y1={resistanceY} y2={resistanceY} stroke="var(--red)" strokeDasharray="4 3" strokeWidth="1.5" />
      <text x="6" y={resistanceY - 6} className="chart-axis-label" fill="var(--red)">Resistance</text>
      <line x1="0" x2={width} y1={supportY} y2={supportY} stroke="var(--green)" strokeDasharray="4 3" strokeWidth="1.5" />
      <text x="6" y={supportY + 14} className="chart-axis-label" fill="var(--green)">Support</text>
      <polyline
        points={points.map((p) => p.join(',')).join(' ')}
        fill="none"
        stroke="var(--blue)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ---------- Interactive widgets ----------

function MiniPositionCalculator() {
  const [account, setAccount] = useState('2000')
  const [riskPct, setRiskPct] = useState('0.5')
  const [entry, setEntry] = useState('100')
  const [stop, setStop] = useState('98')

  const riskAmount = (parseFloat(account) || 0) * ((parseFloat(riskPct) || 0) / 100)
  const perShareRisk = Math.abs((parseFloat(entry) || 0) - (parseFloat(stop) || 0))
  const shares = perShareRisk > 0 ? Math.floor(riskAmount / perShareRisk) : 0

  return (
    <div className="mini-calc">
      <div className="mini-calc-inputs">
        <label>
          Account ($)
          <input type="number" value={account} onChange={(e) => setAccount(e.target.value)} />
        </label>
        <label>
          Risk (%)
          <input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
        </label>
        <label>
          Entry ($)
          <input type="number" value={entry} onChange={(e) => setEntry(e.target.value)} />
        </label>
        <label>
          Stop ($)
          <input type="number" value={stop} onChange={(e) => setStop(e.target.value)} />
        </label>
      </div>
      <div className="mini-calc-result">
        Max loss <strong>${riskAmount.toFixed(2)}</strong> ÷ risk/share <strong>${perShareRisk.toFixed(2)}</strong> ={' '}
        <strong className="mini-calc-shares">{shares.toLocaleString()} shares</strong>
      </div>
      <div className="help-text" style={{ margin: 0 }}>
        Use this same formula with your actual account size and stop before sizing any real trade.
      </div>
    </div>
  )
}

const GOLDEN_RULES = [
  'Protect capital first — everything else is secondary.',
  'Never enter a trade without knowing your stop first.',
  'Position size comes from your risk, not from how much money you have.',
  "Don't use high leverage as a beginner — and remember, there's none available on this app's US stocks from India anyway.",
  'Trade liquid stocks/ETFs, not obscure penny stocks.',
  "Don't trade based solely on news or social-media hype.",
  'One good strategy beats ten random indicators.',
  'Paper trade before using meaningful real money.',
  'Track every single trade, win or lose.',
  'Never make a fixed daily profit your objective — consistency and discipline come first.',
]

function GoldenRulesChecklist() {
  const [checked, setChecked] = useState(() => loadSet(RULES_KEY))

  function toggle(i) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      saveSet(RULES_KEY, next)
      return next
    })
  }

  return (
    <div>
      <div className="rules-progress">
        {checked.size} / {GOLDEN_RULES.length} checked off — tick each one once it's actually second nature, not just read
      </div>
      <div className="rules-checklist">
        {GOLDEN_RULES.map((rule, i) => (
          <label className={`rule-item ${checked.has(i) ? 'checked' : ''}`} key={i}>
            <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} />
            {rule}
          </label>
        ))}
      </div>
    </div>
  )
}

const MISTAKES = [
  'High leverage', 'No stop loss', 'Revenge trading', 'Sizing up after a loss',
  'Trading on social-media hype', '"Cheap" penny stocks', 'Trading every candle',
  'Moving your stop farther away', 'Chasing a fixed daily target', 'Starting with options/0DTE',
  'Using emergency or borrowed money', 'Changing strategy every few days',
]

function MistakesChips() {
  return (
    <div className="mistake-chips">
      {MISTAKES.map((m) => (
        <span className="mistake-chip" key={m}>
          ✕ {m}
        </span>
      ))}
    </div>
  )
}

const LEARNING_WEEKS = [
  { title: 'Market Basics', items: ['Market hours', 'Bid/ask', 'Order types (market/limit/stop)', 'Candlesticks', 'Volume'] },
  { title: 'Technical Basics', items: ['Support / resistance', 'Trend', 'Breakouts', 'Pullbacks', 'Volume confirmation'] },
  { title: 'Risk Management', items: ['Stop loss', 'Position sizing', 'Risk/reward', 'Max daily loss', 'Trading journal'] },
  { title: 'Paper Trading', items: ['50-100 simulated trades', 'Same strategy every time', 'Use the Paper Portfolio tab here'] },
]

function LearningPathTimeline() {
  return (
    <div className="learning-path">
      {LEARNING_WEEKS.map((w, i) => (
        <div className="path-step" key={w.title}>
          <div className="path-step-num">Week {i + 1}</div>
          <div className="path-step-title">{w.title}</div>
          <ul className="path-step-items">
            {w.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

const JOURNAL_EXAMPLE = [
  ['Stock', 'NVIDIA'],
  ['Entry', '$180'],
  ['Stop', '$178'],
  ['Target', '$184'],
  ['Position', '10 shares'],
  ['Risk', '$20'],
  ['Reason', 'Opening range breakout'],
  ['Result', '+$40'],
  ['Mistake', 'Entered a little late'],
]

const START_STEPS = [
  { title: 'Learn before you fund anything', body: 'Read this whole section, use the Lab and Paper Portfolio here with zero real money, and understand every number this site shows before opening a real account.' },
  { title: 'Decide: Indian stocks, US stocks, or both', body: "They need different accounts and work under different rules (see the callout above). This app's watchlist is US stocks, so if that's your focus, you need an LRS-enabled international broker, not a plain Indian demat account." },
  { title: 'Open the right account(s)', body: 'Indian stocks: a demat + trading account with a SEBI-registered broker (Zerodha, Groww, Upstox, etc.), PAN + Aadhaar KYC. US stocks: an LRS-enabled platform (INDmoney, Vested, Groww US stocks, IBKR via LRS, etc.) with FEMA/LRS declaration.' },
  { title: 'Understand your remittance limits (for US stocks)', body: 'LRS allows up to $250,000/year, but the first ₹10 lakh has no TCS and amounts above that carry 20% TCS (adjustable against your tax bill) — see Tax Notes in Settings.' },
  { title: "Confirm your broker's actual same-day rules", body: "Don't assume — some platforms lock sale proceeds until T+2/T+3 settlement, which blocks same-day round trips entirely. Ask support directly before planning any intraday-style strategy on US stocks." },
  { title: 'Practice for 1-2 weeks with zero real money', body: 'Use the Portfolio tab here with your intended real capital amount, tracking your own reasoning against outcomes, before a single real rupee moves.' },
  { title: 'Start real money small, sized by risk not by feeling', body: 'Use the risk % discipline above (0.5-1% per trade is a common starting convention) — position size should come from your stop distance, not a round number that feels right.' },
  { title: 'Keep a written trade log, win or lose', body: 'Whatever record actually reflects your real account. Reviewing it honestly, including losses, is how you actually improve.' },
]

// ---------- Accordion shell ----------

function AccordionSection({ id, title, icon, open, reviewed, onToggleOpen, onToggleReviewed, children }) {
  return (
    <div className={`accordion-item ${open ? 'open' : ''}`}>
      <button className="accordion-header" onClick={() => onToggleOpen(id)}>
        <span
          className={`accordion-check ${reviewed ? 'checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleReviewed(id)
          }}
          title="Mark as reviewed"
        >
          {reviewed ? '✓' : ''}
        </span>
        <span className="accordion-icon">{icon}</span>
        <span className="accordion-title">{title}</span>
        <span className="accordion-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}

const SECTIONS = ['what', 'accounts', 'reading', 'risk', 'strategy', 'money', 'path']

export default function IntradayBasics() {
  const [openId, setOpenId] = useState('what')
  const [reviewed, setReviewed] = useState(() => loadSet(PROGRESS_KEY))

  function toggleReviewed(id) {
    setReviewed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveSet(PROGRESS_KEY, next)
      return next
    })
  }

  const pct = Math.round((reviewed.size / SECTIONS.length) * 100)

  const sectionProps = (id, title, icon) => ({
    id,
    title,
    icon,
    open: openId === id,
    reviewed: reviewed.has(id),
    onToggleOpen: (clickedId) => setOpenId((cur) => (cur === clickedId ? null : clickedId)),
    onToggleReviewed: toggleReviewed,
  })

  return (
    <div>
      <p className="basics-intro">
        "Intraday trading" means buying and selling the same security within a single trading session — you never
        hold the position overnight. Click through the sections below; check one off once you've actually read it.
      </p>

      <div className="progress-bar-wrap">
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-bar-label">
          {reviewed.size} / {SECTIONS.length} sections reviewed
        </span>
      </div>

      <div className="accordion">
        <AccordionSection {...sectionProps('what', 'What Is Intraday Trading?', '📖')}>
          <p className="basics-body">
            Example: buy 10 NVIDIA shares at $180, sell at $183 → profit = 10 × $3 = $30, before brokerage, taxes,
            and FX costs. In an eligible margin account you can also short-sell — sell first, buy back later if the
            price falls — but see the account-types section below for why that mostly doesn't apply here.
          </p>

          <div className="basics-callout critical">
            <div className="basics-callout-title">⚠ Read this before assuming anything about this app's watchlist</div>
            <p>
              Every ticker this app tracks (NVDA, TSLA, AMD, etc.) is a <strong>US stock</strong>. If you're trading
              them from India via the RBI's Liberalised Remittance Scheme (the normal route — INDmoney, Vested,
              Groww US, IBKR), two things are true that don't apply to Indian NSE/BSE intraday trading:
            </p>
            <ul>
              <li>
                <strong>No margin/leverage.</strong> RBI rules explicitly prohibit using LRS-remitted funds for
                margin or margin calls on overseas exchanges — every US-stock trade from India is a plain cash
                trade.
              </li>
              <li>
                <strong>Same-day round trips are broker-dependent, not universal.</strong> Some platforms let you
                buy and sell the same US stock the same session with proceeds available immediately (INDmoney is
                one). Others lock sale proceeds until settlement (T+2/T+3). Confirm with your specific broker.
              </li>
            </ul>
          </div>

          <h4 className="basics-subhead">U.S. market timings from India</h4>
          <p className="basics-body">
            Regular U.S. hours are 9:30 AM–4:00 PM Eastern Time. Because the U.S. observes daylight saving and India
            doesn't, the IST window shifts twice a year:
          </p>
          <div className="card table-wrap" style={{ marginBottom: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>U.S. schedule</th>
                  <th>India (IST)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>U.S. daylight-saving period</td>
                  <td>7:00 PM – 1:30 AM</td>
                </tr>
                <tr>
                  <td>U.S. standard-time period</td>
                  <td>8:00 PM – 2:30 AM</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="help-text">You don't have to trade the whole session — many traders concentrate on the first 1-2 hours after the open.</p>
        </AccordionSection>

        <AccordionSection {...sectionProps('accounts', 'Account Types & the Rules That Actually Apply', '🏦')}>
          <h4 className="basics-subhead">Cash vs. margin account</h4>
          <CashVsMarginComparison />

          <h4 className="basics-subhead">Indian NSE/BSE intraday (MIS orders) — for contrast</h4>
          <p className="basics-body">
            Regular NSE trading runs 9:15 AM – 3:30 PM IST. SEBI mandates a minimum 20% margin for intraday equity —
            up to <strong>5x leverage</strong> on an MIS order. Brokers begin auto-closing open MIS positions from
            around 3:15 PM, whether you've acted or not.
          </p>
          <DayTimeline />
          <div className="basics-legend">
            <span><span className="dot" style={{ background: 'var(--green)' }} /> Historically higher-volume windows</span>
            <span><span className="dot" style={{ background: 'var(--border)' }} /> Often choppier, lower-conviction stretch</span>
            <span><span className="dot" style={{ background: 'var(--amber)' }} /> Auto square-off begins</span>
          </div>

          <h4 className="basics-subhead">Intraday vs. delivery, side by side</h4>
          <TradeFlowComparison />

          <h4 className="basics-subhead">The $25,000 rule you may have heard of — it changed</h4>
          <p className="basics-body">
            The old US Pattern Day Trader (PDT) rule required $25,000 minimum equity to day-trade on margin.
            FINRA replaced it, effective <strong>June 4, 2026</strong>, with a proportional intraday-margin
            framework instead — firms have a transition window through <strong>October 20, 2027</strong> to fully
            migrate, and the new baseline margin-account minimum is <strong>$2,000</strong> (brokers can require
            more). Your specific broker may still apply the old rules during the transition — check directly.
            Mostly moot for LRS-based Indian investors anyway, since LRS trades are cash accounts, never margin.
          </p>
        </AccordionSection>

        <AccordionSection {...sectionProps('reading', 'Reading a Chart', '📊')}>
          <h4 className="basics-subhead">Candlesticks</h4>
          <p className="basics-body">Each candle encodes four numbers for its period: Open, High, Low, Close. Body color shows direction; wicks show the full range traded.</p>
          <CandlestickIllustration />
          <p className="help-text">A simple beginner combination: a 15-minute chart for broader structure, a 5-minute chart for the actual entry. Avoid constantly switching between many timeframes.</p>

          <h4 className="basics-subhead">Support &amp; resistance</h4>
          <p className="basics-body">Support is a level where price has previously found buying interest; resistance is where it's previously met selling pressure. Neither guarantees a reversal — they're zones of prior interest, not walls.</p>
          <SupportResistanceIllustration />

          <h4 className="basics-subhead">Liquidity, volume &amp; spread</h4>
          <p className="basics-body">
            <strong>Liquidity</strong> means plenty of buyers and sellers; <strong>volume</strong> is how much
            actually traded. A tight <strong>bid/ask spread</strong> (e.g. bid $100.00 / ask $100.02) is much
            cheaper to trade than a wide one (bid $100.00 / ask $100.50) — the difference is cost you pay on every
            round trip, before the stock even needs to move in your favor. Sudden volume spikes often accompany
            earnings, news, or broader market moves, and help gauge whether a price move has real participation.
          </p>
        </AccordionSection>

        <AccordionSection {...sectionProps('risk', 'Risk Management — the most important section', '🛡️')}>
          <h4 className="basics-subhead">Stop loss</h4>
          <p className="basics-body">
            A stop loss is the price where you accept the trade idea was wrong and exit to cap the damage. Entry
            $100, stop $98, 10 shares → maximum loss = 10 × $2 = $20. Without a stop, a small losing trade can
            become a much larger one.
          </p>

          <h4 className="basics-subhead">Position sizing — try it live</h4>
          <p className="basics-body">Position size = Maximum Risk ÷ Risk Per Share. Change the numbers below and watch the share count respond:</p>
          <MiniPositionCalculator />

          <h4 className="basics-subhead">Risk : reward</h4>
          <p className="basics-body">
            Entry $100, stop $98 (risk $2/share), target $104 (reward $4/share) → 1:2 risk:reward. You don't need to
            win every trade for that to work: 10 losers at -$20 each = -$200; 10 winners at +$40 each = +$400; net
            +$200 before costs and taxes. Win rate alone isn't the whole picture — its relationship to risk:reward
            is.
          </p>

          <h4 className="basics-subhead">The honest risk picture</h4>
          <p className="basics-body">
            SEBI's own data: roughly <strong>87.7% of individual equity-derivatives traders lost money in FY2026</strong>,
            totaling ₹91,685 crore (specifically about F&O, not plain cash intraday equity, but the direction
            generalizes). On the US side, FINRA's own investor materials note that{' '}
            <strong>evidence indicates an account under $50,000 significantly impairs a day trader's ability to
            actually profit</strong> once costs are accounted for. Nothing on this site should be read as
            suggesting otherwise.
          </p>
        </AccordionSection>

        <AccordionSection {...sectionProps('strategy', 'A Strategy to Study: Opening Range Breakout', '🎯')}>
          <p className="basics-body">
            One well-known beginner-friendly setup: watch the first 15 minutes of a session, note the opening high
            and low, then watch for a breakout above that high (or below that low) with real volume behind it.
            Example: opening high $100, opening low $98 → entry $100.20, stop $99.40, target $101.80.
          </p>
          <p className="basics-body">
            This is exactly what this app's <strong>High-volatility tier</strong> backtests (see Watchlist, Backtest,
            and the Lab tab) — so you can study how this specific rule has actually performed on real tickers,
            adjust its stop/target in the Lab, and paper-trade it in Portfolio, all before ever risking real money
            on it.
          </p>
          <p className="help-text">Don't blindly buy every breakout — false breakouts are common. Backtest and practice a setup before risking real money on it.</p>
        </AccordionSection>

        <AccordionSection {...sectionProps('money', 'Money Reality: Currency & Tax', '💱')}>
          <h4 className="basics-subhead">You're exposed to two things, not one</h4>
          <p className="basics-body">
            Your result depends on the stock's move <em>and</em> USD/INR at conversion time, plus broker fees and
            currency-conversion costs. For small trades, FX costs alone can matter more than you'd expect.
          </p>

          <h4 className="basics-subhead">US tax — the good news for most Indian residents</h4>
          <p className="basics-body">
            Per the IRS, nonresident aliens generally do <strong>not</strong> owe US capital-gains tax on US stock
            trades — the main exceptions are gains connected to a US trade/business, or if you're physically
            present in the US 183+ days in the year. Dividends are treated differently: they face 30% US
            withholding at source, often reduced under the US-India tax treaty once you file Form W-8BEN with your
            broker.
          </p>

          <h4 className="basics-subhead">Indian tax — don't rely on generic advice here</h4>
          <p className="basics-body">
            Indian taxation of your gains, LRS/remittance rules, TCS, and reporting requirements depend on your
            specific circumstances. See the <strong>Tax Notes</strong> panel in Settings for the STCG/LTCG/TCS
            specifics already covered there, and consult a CA who specifically handles foreign securities for
            anything beyond casual amounts.
          </p>
        </AccordionSection>

        <AccordionSection {...sectionProps('path', 'Your Path: 4 Weeks to Ready', '🗺️')}>
          <LearningPathTimeline />

          <h4 className="basics-subhead">Keep a trading journal like this</h4>
          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <tbody>
                {JOURNAL_EXAMPLE.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ fontWeight: 600, width: 120 }}>{k}</td>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="help-text" style={{ marginBottom: 16 }}>
            After 50-100 trades, analyze: win rate, average win, average loss, risk:reward, max losing streak,
            which setups actually work, and which mistakes repeat.
          </p>

          <h4 className="basics-subhead">10 rules worth internalizing</h4>
          <GoldenRulesChecklist />

          <h4 className="basics-subhead">Mistakes to avoid</h4>
          <MistakesChips />

          <h4 className="basics-subhead">Where to actually start</h4>
          <div className="steps-list">
            {START_STEPS.map((s, i) => (
              <div className="step-card" key={s.title}>
                <div className="step-num">{i + 1}</div>
                <div>
                  <div className="step-title">{s.title}</div>
                  <div className="step-body">{s.body}</div>
                </div>
              </div>
            ))}
          </div>
        </AccordionSection>
      </div>

      <div className="basics-refs">
        <div className="basics-refs-title">Sources (Indian + international, checked before writing this)</div>
        <a href="https://www.incredmoney.com/knowledge-center/intraday-trading/intraday-auto-square-off-time/" target="_blank" rel="noreferrer">Intraday auto square-off timing — InCred Money ↗</a>
        <a href="https://www.indmoney.com/blog/us-stocks/trade-us-stocks-from-india" target="_blank" rel="noreferrer">Intraday trading in US stocks from India — INDmoney ↗</a>
        <a href="https://www.investingcube.com/shares/sebi-intraday-trading-regulations-2026-what-you-need-to-know/" target="_blank" rel="noreferrer">SEBI intraday regulations 2026 — InvestingCube ↗</a>
        <a href="https://www.finra.org/investors/insights/intraday-margin-requirements" target="_blank" rel="noreferrer">Understanding the New Intraday Margin Requirements — FINRA ↗</a>
        <a href="https://www.finra.org/investors/insights/frequent-intraday-trading" target="_blank" rel="noreferrer">Frequent Intraday Trading: Understanding the Basics — FINRA ↗</a>
        <a href="https://www.finra.org/rules-guidance/rulebooks/finra-rules/2270" target="_blank" rel="noreferrer">Day-Trading Risk Disclosure Statement — FINRA Rule 2270 ↗</a>
        <a href="https://www.irs.gov/individuals/international-taxpayers/taxation-of-nonresident-aliens" target="_blank" rel="noreferrer">Taxation of Nonresident Aliens — IRS ↗</a>
        <a href="https://www.rbi.org.in/commonperson/english/scripts/FAQs.aspx?Id=1834" target="_blank" rel="noreferrer">Liberalised Remittance Scheme FAQ — RBI ↗</a>
      </div>
    </div>
  )
}
