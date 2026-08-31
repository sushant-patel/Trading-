const SECTIONS = [
  { id: 'start', label: 'Getting Started' },
  { id: 'concepts', label: 'Key Concepts' },
  { id: 'sitemap', label: 'What Each Tab Does' },
  { id: 'limits', label: 'Limitations' },
]

const STEPS = [
  {
    title: 'Check the Watchlist',
    body: "Each ticker's volatility tier (High/Medium/Low) and the sparkline trend. This tells you which strategy the pipeline is testing for it, and roughly how it's been moving.",
  },
  {
    title: 'Look at Backtest + Featured Setup',
    body: "See which rule has actually worked over the data window, and how many trades it's based on. The Featured Setup panel auto-picks the current best performer — but read the Trades column before trusting a Win Rate.",
  },
  {
    title: 'Study the chart in Trends',
    body: 'Pick a ticker, hover the chart for exact prices, and switch the timeframe to see the move in context — a stock up 20% over 6 months can still be flat over the last month.',
  },
  {
    title: 'Experiment in the Lab',
    body: "Tune stop distance and target multiple for a strategy and watch trades/win-rate/return recompute instantly. This is how you build intuition for why a rule works or doesn't — not by reading about it, but by moving the sliders.",
  },
  {
    title: 'Size any real trade in the Calculator',
    body: 'Before risking real money, use the position-size calculator with your actual account size and a risk % you’re comfortable with (0.5-1% per trade is a common starting convention). It tells you exactly how many shares keeps your downside capped.',
  },
  {
    title: 'Practice first in Paper Portfolio',
    body: 'Allocate part of a simulated ₹80,000 to a pick, based on whatever caught your eye in Backtest, Trends, or the Lab. Then leave it — check back in a few days or next week and see if you were right, with zero real money at risk.',
  },
  {
    title: 'Journal your real trades',
    body: 'Once you do trade with real money, log it in Journal. It’s the only tab that reflects your actual account — everything else here is analysis or simulation.',
  },
  {
    title: 'Check Settings when something looks off',
    body: 'The data source URL, live currency rate, and India tax notes all live there — useful if a number seems stale or you want the FX/tax context behind what you’re seeing.',
  },
]

const CONCEPTS = [
  {
    term: 'Volatility Tier',
    body: "Each stock is classified High / Medium / Low based on its average daily (High−Low)/Close range: ≥3.5% = High, 2.5-3.5% = Medium, <2.5% = Low. The tier decides which of the three strategies below gets backtested for that stock — it is recalculated fresh every time the data refreshes, so a stock can move tiers over time.",
  },
  {
    term: 'The three strategies',
    body: 'High tier runs Opening Range Breakout (enter when price closes above the prior day’s high). Medium runs VWAP Trend Pullback (enter on a pullback to the 20-day average within an uptrend). Low runs Range Fade / Mean Reversion (enter when price dips below a recent low and reclaims it). These are simple, fixed rules — not adaptive, not AI-driven.',
  },
  {
    term: 'Backtest vs. live trading',
    body: 'The backtest replays the strategy against DAILY bars, as an approximation — real intraday price action within a day is not modeled. It also ignores commissions, slippage, bid/ask spread, and taxes. Treat every number here as a rough edge check, not a performance guarantee.',
  },
  {
    term: 'Win Rate & sample size',
    body: 'The % of backtested trades that closed profitable. This number is meaningless with only 1-3 trades — a coin flip can land heads 3 times in a row. Only trust it once the Trades count is reasonably large (double digits is a better bar than single digits).',
  },
  {
    term: 'Total Return (backtest)',
    body: 'The sum of each trade’s % gain/loss, not compounded and not risk-adjusted. It answers "did this rule have an edge on this stock over this window", not "how much money would I have made."',
  },
  {
    term: 'Position Sizing (risk %)',
    body: 'How much of your account you risk on a single trade if your stop is hit, as a percentage — not how much money you put into the trade. A common starting convention is 0.5-1% per trade, so that even a string of losses doesn’t meaningfully damage the account. The Calculator tab turns this into an actual share count.',
  },
  {
    term: 'Stop / Target',
    body: 'The stop is the price where you accept you were wrong and exit to cap the loss. The target is the price where you take profit. The "target multiple" is how many multiples of your risk you’re aiming to win — a 2.0x target means aiming to make twice what you’d lose if stopped out.',
  },
  {
    term: 'Featured Setup methodology',
    body: 'Automatically the ticker with the highest backtested return among those with at least 5 trades this window — the trade-count floor exists specifically so a lucky single winning trade can’t "win." It re-ranks itself every time results.json updates. It is explicitly not investment advice.',
  },
  {
    term: 'Paper Portfolio',
    body: 'A fully simulated ₹80,000 account, separate from anything real. Opening a position converts your ₹ amount to USD at the live FX rate and buys (fractional) shares at the current price. Nothing here touches a real broker — it exists so you can test your own predictions forward in time without risking money.',
  },
  {
    term: 'Live prices',
    body: "Where the site is deployed on Vercel, a small server-side function fetches near-real-time quotes (this can't be done directly from your browser — the price API blocks that for security, so a proxy function on the server does it instead). It only works on the deployed site, not on `npm run dev` locally.",
  },
  {
    term: 'Currency conversion',
    body: 'A live USD→INR mid-market rate, refreshed every 6 hours. This is not the rate a real broker or LRS remittance would give you — real conversions carry a spread and TCS (see Tax Notes in Settings). Treat ₹ figures here as indicative, not exact.',
  },
]

const TAB_GUIDE = [
  { name: 'Watchlist', body: 'All tracked tickers as cards: price, change, sparkline trend, tier, avg range, win rate. Click a card to jump straight to its chart in Trends.' },
  { name: 'Trends', body: 'Full price chart for one ticker at a time, with a timeframe filter and a hover tooltip showing the exact price on any day.' },
  { name: 'Backtest', body: 'The full results table for every ticker’s strategy, plus the Featured Setup callout at the top.' },
  { name: 'Lab', body: 'Tune a strategy’s stop/target live against real history and watch the backtest recompute instantly — no server round-trip.' },
  { name: 'Portfolio', body: 'The simulated ₹80,000 paper-trading account — open and close positions, track unrealized/realized P/L over time.' },
  { name: 'Calculator', body: 'Position-size math: given account size, risk %, entry, and stop, tells you how many shares to buy.' },
  { name: 'Journal', body: 'Your own real trade log, typed in by hand, saved only in this browser.' },
  { name: 'Settings', body: 'Data source URL, live currency rate, and India tax notes.' },
]

export default function Learn() {
  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="learn">
      <div className="learn-intro card">
        <h2 className="learn-title">Trading Tracker — how this all fits together</h2>
        <p>
          This site pairs a real (if simple) rule-based screener with tools to understand, test, and practice
          around its output before ever risking real money. Nothing here places real trades. Read this page once,
          then use the nav below to jump around.
        </p>
      </div>

      <nav className="learn-nav">
        {SECTIONS.map((s) => (
          <button key={s.id} className="learn-nav-btn" onClick={() => scrollTo(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>

      <section id="start" className="learn-section">
        <h3 className="section-title">Getting Started</h3>
        <div className="steps-list">
          {STEPS.map((s, i) => (
            <div className="step-card" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <div>
                <div className="step-title">{s.title}</div>
                <div className="step-body">{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="concepts" className="learn-section">
        <h3 className="section-title">Key Concepts</h3>
        <div className="glossary-grid">
          {CONCEPTS.map((c) => (
            <div className="glossary-card" key={c.term}>
              <div className="glossary-term">{c.term}</div>
              <div className="glossary-body">{c.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="sitemap" className="learn-section">
        <h3 className="section-title">What Each Tab Does</h3>
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tab</th>
                <th>What it's for</th>
              </tr>
            </thead>
            <tbody>
              {TAB_GUIDE.map((t) => (
                <tr key={t.name}>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{t.name}</td>
                  <td>{t.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="limits" className="learn-section">
        <h3 className="section-title">Limitations — read this before trusting any number here</h3>
        <ul className="limits-list">
          <li>The backtest runs on daily bars, not true intraday ticks — it's an approximation, by the script's own design.</li>
          <li>No fees, slippage, spread, or taxes are modeled anywhere in the backtest or Lab.</li>
          <li>Small trade counts (see Trades in Backtest) make win rates and returns unreliable — this is explicitly flagged throughout the app, not hidden.</li>
          <li>Live prices only work on the deployed site (Vercel), not in local development, and depend on a third-party data feed that can lag or fail.</li>
          <li>The Paper Portfolio is 100% simulated — good paper results do not guarantee good real results, and vice versa.</li>
          <li>Currency and tax information is general and educational, not personalized financial or tax advice — verify with a professional before acting on it.</li>
          <li>This tool places no real orders anywhere, by design. It's for analysis, practice, and tracking only.</li>
        </ul>
      </section>
    </div>
  )
}
