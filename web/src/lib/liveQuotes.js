// Polls the /api/quote serverless function (see web/api/quote.js) for
// near-real-time prices. Only works where Vercel actually runs the function —
// plain `vite dev` has no /api routes, so a failed first call marks live data
// as unavailable and the app just falls back to the daily results.json prices
// instead of retrying forever.

export async function fetchLiveQuotes(symbols) {
  if (!symbols?.length) return null
  try {
    const res = await fetch(`/api/quote?symbols=${symbols.join(',')}`)
    if (!res.ok) return null
    const json = await res.json()
    if (!json?.quotes) return null
    return json
  } catch {
    return null
  }
}
