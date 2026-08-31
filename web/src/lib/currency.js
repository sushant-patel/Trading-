const RATE_CACHE_KEY = 'tt_usd_inr_rate'
const RATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6h — market moves during the day, but this app isn't an execution venue

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(RATE_CACHE_KEY) || 'null')
  } catch {
    return null
  }
}

function writeCache(payload) {
  try {
    localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(payload))
  } catch {
    // localStorage unavailable — rate just won't survive a reload
  }
}

// Fetches USD->INR from Frankfurter (free, no key). Falls back to a cached
// rate (marked stale) if the network call fails, so the UI never blocks on it.
export async function getUsdInrRate() {
  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL_MS) {
    return { rate: cached.rate, fetchedAt: cached.fetchedAt, stale: false }
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const rate = json.rates?.INR
    if (!rate) throw new Error('no INR rate in response')
    const payload = { rate, fetchedAt: Date.now() }
    writeCache(payload)
    return { rate, fetchedAt: payload.fetchedAt, stale: false }
  } catch {
    if (cached) return { rate: cached.rate, fetchedAt: cached.fetchedAt, stale: true }
    return null
  }
}

export function formatUsd(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  const sign = amount < 0 ? '-' : ''
  return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatInr(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  const sign = amount < 0 ? '-' : ''
  return `${sign}₹${Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}
