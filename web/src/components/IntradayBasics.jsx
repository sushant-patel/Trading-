// Illustrated NSE trading-day timeline — plain inline SVG, no chart library,
// consistent with the rest of the app's hand-rolled chart style.
function DayTimeline() {
  const width = 720
  const height = 90
  const padStart = 40
  const padEnd = 40
  const trackY = 46
  const startMin = 9 * 60 + 15 // 9:15
  const endMin = 15 * 60 + 30 // 15:30
  const totalMin = endMin - startMin

  const xFor = (hh, mm) => {
    const t = hh * 60 + mm - startMin
    return padStart + (t / totalMin) * (width - padStart - padEnd)
  }

  const segments = [
    { from: [9, 15], to: [10, 30], color: 'var(--green)', label: 'Good window' },
    { from: [10, 30], to: [13, 30], color: 'var(--border)', label: 'Often choppy — avoid' },
    { from: [13, 30], to: [15, 15], color: 'var(--green)', label: 'Good window' },
    { from: [15, 15], to: [15, 30], color: 'var(--amber)', label: 'Auto square-off' },
  ]

  // 3:15 and 3:30 are only 15 minutes apart on a ~6h axis — labeling both
  // collided, so the amber segment alone marks the square-off start and only
  // the close time gets a label.
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

// Simple side-by-side flow: an intraday round trip (same session, no
// overnight hold) vs. a delivery/investment trade (held across sessions).
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

const START_STEPS = [
  {
    title: 'Learn before you fund anything',
    body: 'Read this whole page, use the Lab and Paper Portfolio here with zero real money, and understand every number this site shows before opening a real account.',
  },
  {
    title: 'Decide: Indian stocks, US stocks, or both',
    body: 'They need different accounts and work under different rules (see the callout above). This app\'s watchlist is US stocks, so if that\'s your focus, you need an LRS-enabled international broker, not a plain Indian demat account.',
  },
  {
    title: 'Open the right account(s)',
    body: 'Indian stocks: a demat + trading account with a SEBI-registered broker (Zerodha, Groww, Upstox, etc.), PAN + Aadhaar KYC. US stocks: an LRS-enabled platform (INDmoney, Vested, Groww US stocks, IBKR via LRS, etc.) with FEMA/LRS declaration.',
  },
  {
    title: 'Understand your remittance limits (for US stocks)',
    body: 'LRS allows up to $250,000/year, but the first ₹10 lakh has no TCS and amounts above that carry 20% TCS (adjustable against your tax bill) — see Tax Notes in Settings.',
  },
  {
    title: 'Confirm your broker\'s actual same-day rules',
    body: "Don't assume — some platforms lock sale proceeds until T+2/T+3 settlement, which blocks same-day round trips entirely. Ask support directly before planning any intraday-style strategy on US stocks.",
  },
  {
    title: 'Practice for 1-2 weeks with zero real money',
    body: 'Use the Paper Portfolio tab here with your intended real capital amount, tracking your own reasoning against outcomes, before a single real rupee moves.',
  },
  {
    title: 'Start real money small, sized by risk not by feeling',
    body: 'Use the Calculator\'s risk % discipline (0.5-1% per trade is a common starting convention) — position size should come from your stop distance, not a round number that feels right.',
  },
  {
    title: 'Journal every real trade, win or lose',
    body: 'The Journal tab is the only place that reflects your actual account. Reviewing it honestly, including losses, is how you actually improve.',
  },
]

export default function IntradayBasics() {
  return (
    <div>
      <p className="basics-intro">
        "Intraday trading" means buying and selling the same security within a single trading session — you never
        hold the position overnight. The mechanics differ meaningfully depending on whether you're trading Indian
        stocks or the US stocks this app tracks, and that difference matters more than most guides mention.
      </p>

      <div className="basics-callout critical">
        <div className="basics-callout-title">⚠ Read this before assuming anything about this app's watchlist</div>
        <p>
          Every ticker this app tracks (NVDA, TSLA, AMD, etc.) is a <strong>US stock</strong>. If you're trading
          them from India via the RBI's Liberalised Remittance Scheme (the normal route — INDmoney, Vested, Groww
          US, IBKR), two things are true that don't apply to Indian NSE/BSE intraday trading:
        </p>
        <ul>
          <li>
            <strong>No margin/leverage.</strong> RBI rules explicitly prohibit using LRS-remitted funds for margin
            or margin calls on overseas exchanges — every US-stock trade from India is a plain cash trade. The 5x
            leverage described below for MIS orders does not exist here.
          </li>
          <li>
            <strong>Same-day round trips are broker-dependent, not universal.</strong> Some platforms let you buy
            and sell the same US stock the same session with proceeds available immediately (INDmoney is one).
            Others lock sale proceeds until settlement (T+2/T+3) and don't practically support same-day round
            trips at all. Confirm this with your specific broker — don't assume.
          </li>
        </ul>
      </div>

      <h4 className="basics-subhead">How Indian NSE/BSE intraday trading works (MIS orders)</h4>
      <p className="basics-body">
        Regular NSE trading runs 9:15 AM – 3:30 PM IST. SEBI mandates a minimum 20% margin for intraday equity —
        meaning up to <strong>5x leverage</strong> on an MIS (Margin Intraday Square-off) order. Brokers begin
        auto-closing any still-open MIS positions from around 3:15 PM, whether you've acted or not.
      </p>
      <DayTimeline />
      <div className="basics-legend">
        <span><span className="dot" style={{ background: 'var(--green)' }} /> Historically higher-volume windows (9:15-10:30, 1:30-3:15)</span>
        <span><span className="dot" style={{ background: 'var(--border)' }} /> Often choppier, lower-conviction stretch</span>
        <span><span className="dot" style={{ background: 'var(--amber)' }} /> Auto square-off begins</span>
      </div>

      <h4 className="basics-subhead">Intraday vs. delivery, side by side</h4>
      <TradeFlowComparison />

      <h4 className="basics-subhead">The honest risk picture</h4>
      <p className="basics-body">
        SEBI's own data: roughly <strong>87.7% of individual equity-derivatives traders lost money in FY2026</strong>,
        totaling ₹91,685 crore. That figure is specifically about F&O (derivatives), not plain cash intraday
        equity, but the direction of the finding generalizes — active short-term trading is genuinely hard, and
        SEBI has tightened margin monitoring and risk-disclosure requirements partly because of exactly this.
        Nothing on this site should be read as suggesting otherwise.
      </p>

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

      <div className="basics-refs">
        <div className="basics-refs-title">Sources (Indian + international, checked before writing this)</div>
        <a href="https://www.incredmoney.com/knowledge-center/intraday-trading/intraday-auto-square-off-time/" target="_blank" rel="noreferrer">
          Intraday auto square-off timing — InCred Money ↗
        </a>
        <a href="https://www.indmoney.com/blog/us-stocks/trade-us-stocks-from-india" target="_blank" rel="noreferrer">
          Intraday trading in US stocks from India — INDmoney ↗
        </a>
        <a href="https://appreciatewealth.com/blog/can-indians-do-intraday-trading-in-us-stocks-in-2026" target="_blank" rel="noreferrer">
          Can Indians do intraday trading in US stocks? — Appreciate Wealth ↗
        </a>
        <a href="https://www.investingcube.com/shares/sebi-intraday-trading-regulations-2026-what-you-need-to-know/" target="_blank" rel="noreferrer">
          SEBI intraday regulations 2026 — InvestingCube ↗
        </a>
        <a href="https://www.warriortrading.com/pattern-day-trader-rule/" target="_blank" rel="noreferrer">
          US Pattern Day Trader rule explained — Warrior Trading ↗
        </a>
      </div>
    </div>
  )
}
