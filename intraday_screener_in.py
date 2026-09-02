"""
Intraday Screener & Backtester — Nifty 100 (India) watchlist
--------------------------------------------------------------
The India counterpart to `intraday_screener.py`. Same daily-bar tiered
breakout/pullback/fade engine (shared via `screener_core.py`), applied to
the Nifty 100 index constituents instead of the US mega-cap watchlist.

Ticker list sourced from Wikipedia's NIFTY_50 and NIFTY_Next_50 pages
(2026-09-02) and verified against real yfinance (.NS) data before being
trusted — a first-pass scrape from a secondary aggregator site had visibly
wrong/duplicate ticker symbols (e.g. Bajaj Finance mapped to Bajaj
Finserv's own symbol), so nothing here was taken on faith. 100/100
candidates returned real daily data; a sample of 8 also had usable 5-minute
intraday history spanning full NSE sessions (09:15-15:30 IST) — see
CLAUDE.md's India-module section for the verification details.

No FX conversion needed here (unlike the US script's usd_inr_rate) since
prices are already in INR — this is real Indian-market data (NSE, .NS
suffix), tradeable via a normal Indian demat account, NOT the US watchlist's
LRS-constrained situation.

Run:
    python intraday_screener_in.py --period 6mo --json-out results_in.json

This is an educational / research tool for PAPER trading only, not a trading
bot. It does not place real orders. Review any signal yourself before acting
on it — see CLAUDE.md's known-limitations section for what this backtest
does and doesn't account for (daily bars, no slippage/costs, no holiday
calendar awareness).
"""

import argparse
import json
import sys
from dataclasses import asdict
from datetime import datetime, timezone

from screener_core import DEFAULT_TIER_RULES, analyze

# Nifty 50 + Nifty Next 50 = Nifty 100, deduplicated. Each symbol verified
# against live yfinance (.NS) data on 2026-09-02 before being added here.
NIFTY_50 = [
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
    "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BHARTIARTL",
    "CIPLA", "COALINDIA", "DRREDDY", "EICHERMOT", "ETERNAL",
    "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE", "HINDALCO",
    "HINDUNILVR", "ICICIBANK", "INDIGO", "INFY", "ITC",
    "JIOFIN", "JSWSTEEL", "KOTAKBANK", "LT", "M&M",
    "MARUTI", "MAXHEALTH", "NESTLEIND", "NTPC", "ONGC",
    "POWERGRID", "RELIANCE", "SBILIFE", "SHRIRAMFIN", "SBIN",
    "SUNPHARMA", "TCS", "TATACONSUM", "TMPV", "TATASTEEL",
    "TECHM", "TITAN", "TRENT", "ULTRACEMCO", "WIPRO",
]

NIFTY_NEXT_50 = [
    "ABB", "ADANIENSOL", "ADANIGREEN", "ADANIPOWER", "AMBUJACEM",
    "BAJAJHLDNG", "BANKBARODA", "BPCL", "BRITANNIA", "BOSCHLTD",
    "CANBK", "CGPOWER", "CHOLAFIN", "CUMMINSIND", "DIVISLAB",
    "DLF", "DMART", "GAIL", "GODREJCP", "HDFCAMC",
    "HAL", "HINDZINC", "HYUNDAI", "INDHOTEL", "IOC",
    "IRFC", "JINDALSTEL", "LODHA", "LTM", "MAZDOCK",
    "MUTHOOTFIN", "PIDILITIND", "PFC", "PNB", "RECLTD",
    "MOTHERSON", "SHREECEM", "SIEMENS", "ENRIN", "SOLARINDS",
    "TATACAP", "TMCV", "TATAPOWER", "TORNTPHARM", "TVSMOTOR",
    "UNIONBANK", "UNITDSPR", "VBL", "VEDL", "ZYDUSLIFE",
]

# .NS = NSE listing (yfinance suffix convention), sorted + deduped.
WATCHLIST = sorted(f"{sym}.NS" for sym in set(NIFTY_50 + NIFTY_NEXT_50))

# Same tier definitions as the US watchlist to start with — these have NOT
# been re-tuned for Indian-stock volatility/behavior yet. The Discover-style
# out-of-sample search (see web/src/lib/strategySearch.js) is what actually
# re-tunes stop_frac/target_mult per market; treat this as a v1 default, not
# a validated Indian-market strategy.
TIER_RULES = DEFAULT_TIER_RULES


def main():
    parser = argparse.ArgumentParser(description="Nifty 100 intraday screener & backtester")
    parser.add_argument("--period", default="6mo", help="yfinance period, e.g. '2wk', '1mo', '6mo'")
    parser.add_argument("--tickers", nargs="*", default=WATCHLIST, help="Override the default watchlist")
    parser.add_argument("--json-out", default=None, help="Path to write a results_in.json file for the web dashboard")
    args = parser.parse_args()

    print(f"\nScreening {len(args.tickers)} Nifty 100 tickers over period={args.period}\n")
    print(f"{'Ticker':<14}{'Tier':<10}{'AvgRange%':<11}{'LastClose':<12}{'Chg%':<8}{'Trades':<8}{'WinRate%':<10}{'BacktestRet%':<14}")
    print("-" * 90)

    results = []
    for t in args.tickers:
        try:
            r = analyze(t, args.period, TIER_RULES)
            results.append(r)
            print(f"{r.ticker:<14}{r.tier:<10}{r.avg_range_pct:<11.2f}{r.last_close:<12.2f}"
                  f"{r.last_change_pct:<8.2f}{r.trades:<8}{r.win_rate:<10.1f}{r.total_return_pct:<14.2f}")
        except Exception as e:
            print(f"{t:<14} ERROR: {e}")

    print("\nToday's watchlist by strategy:\n")
    for tier_key, tier_info in TIER_RULES.items():
        names = [r.ticker for r in results if r.tier == tier_key]
        if names:
            print(f"  {tier_info['label']}: {', '.join(names)}")

    print(f"\n{len(results)}/{len(args.tickers)} tickers analyzed successfully.\n")

    if args.json_out:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": args.period,
            "market": "NSE",
            "currency": "INR",
            "tickers": [asdict(r) for r in results],
        }
        with open(args.json_out, "w") as f:
            json.dump(payload, f, indent=2, allow_nan=False)
        print(f"Wrote {args.json_out}")


if __name__ == "__main__":
    main()
