// Vercel serverless function — proxies Yahoo Finance's chart endpoint server-side.
// Exists because query2.finance.yahoo.com doesn't send CORS headers, so the
// browser can't call it directly (confirmed by testing); calling it from here
// (server-to-server, no browser CORS enforcement) and returning same-origin
// JSON is the workaround. Only runs where Vercel executes it — plain `vite dev`
// has no /api routes, so the dashboard treats a failed call here as "no live
// data available" rather than an error.

const WATCHLIST_TICKERS = new Set([
  'NVDA', 'TSLA', 'AMZN', 'META', 'AVGO', 'AMD', 'MSFT', 'GOOGL', 'AAPL', 'JPM',
  'NFLX', 'INTC', 'ORCL', 'CRM', 'DIS', 'BAC', 'PLTR', 'INFY',
])

export default async function handler(req, res) {
  const raw = (req.query.symbols || '').toString()
  const symbols = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => WATCHLIST_TICKERS.has(s))
    .slice(0, 25)

  if (!symbols.length) {
    res.status(400).json({ error: 'symbols query param required, e.g. ?symbols=NVDA,AMD' })
    return
  }

  const quotes = {}
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const r = await fetch(
          `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        if (!r.ok) return
        const json = await r.json()
        const meta = json?.chart?.result?.[0]?.meta
        if (!meta || typeof meta.regularMarketPrice !== 'number') return
        const prevClose = meta.previousClose ?? meta.chartPreviousClose
        quotes[sym] = {
          price: meta.regularMarketPrice,
          previousClose: prevClose ?? null,
          changePct: prevClose ? ((meta.regularMarketPrice - prevClose) / prevClose) * 100 : null,
          dayHigh: meta.regularMarketDayHigh ?? null,
          dayLow: meta.regularMarketDayLow ?? null,
          marketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : null,
        }
      } catch {
        // one symbol failing shouldn't take down the others
      }
    })
  )

  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
  res.status(200).json({ quotes, fetchedAt: Date.now() })
}
