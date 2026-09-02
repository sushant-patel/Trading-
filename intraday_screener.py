"""
Intraday Screener & Backtester — US mega-cap watchlist
------------------------------------------------------
What this does:
  1. Pulls the last 2 weeks / 1 month of daily bars (and optionally intraday bars)
     for a watchlist of tickers using yfinance.
  2. Classifies each stock into a volatility tier (High / Medium / Low) based on
     its average daily range as a % of price.
  3. Applies a simple rule-based signal per tier (breakout / pullback / fade),
     matching the framework discussed in chat.
  4. Backtests that signal against the historical window and reports win rate,
     average risk-reward, and total return — so you can judge the edge before
     risking real money.
  5. Prints a daily "what to watch" summary you can wire into a scheduled job
     (cron / Task Scheduler) to run every morning before market open.

The actual analysis/backtest engine lives in `screener_core.py`, shared with
`intraday_screener_in.py` (the Nifty 100 / India counterpart) so both markets
run through one tested implementation.

Setup:
    pip install yfinance pandas numpy

Run:
    python intraday_screener.py --period 1mo
    python intraday_screener.py --period 2wk   (yfinance accepts "14d" too)

This is an educational / research tool, not a trading bot. It does not place
orders. Review any signal yourself before acting on it.
"""

import argparse
import json
import sys
from dataclasses import asdict
from datetime import datetime, timezone

try:
    import yfinance as yf
except ImportError:
    print("Missing dependency. Run: pip install yfinance pandas numpy")
    sys.exit(1)

from screener_core import DEFAULT_TIER_RULES, analyze

WATCHLIST = [
    "NVDA", "TSLA", "AMZN", "META", "AVGO", "AMD", "MSFT", "GOOGL", "AAPL", "JPM",
    "NFLX", "INTC", "ORCL", "CRM", "DIS", "BAC", "PLTR", "INFY",
]

TIER_RULES = DEFAULT_TIER_RULES


def fetch_usd_inr_rate() -> float:
    """USD->INR rate via yfinance's FX ticker. Included in results.json so
    anything reading that file (the dashboard, or a cloud routine with no
    general internet access — only GitHub itself is reachable there) has a
    same-day FX rate without needing a separate live API call of its own."""
    df = yf.Ticker("USDINR=X").history(period="5d", interval="1d")
    df = df.dropna(subset=["Close"])
    if df.empty:
        raise ValueError("No USD/INR rate returned")
    return round(float(df.iloc[-1]["Close"]), 4)


def main():
    parser = argparse.ArgumentParser(description="Intraday screener & backtester")
    parser.add_argument("--period", default="1mo", help="yfinance period, e.g. '2wk', '1mo', '3mo'")
    parser.add_argument("--tickers", nargs="*", default=WATCHLIST, help="Override the default watchlist")
    parser.add_argument("--json-out", default=None, help="Path to write a results.json file for the web dashboard")
    args = parser.parse_args()

    print(f"\nScreening {len(args.tickers)} tickers over period={args.period}\n")
    print(f"{'Ticker':<7}{'Tier':<10}{'AvgRange%':<11}{'LastClose':<11}{'Chg%':<8}{'Trades':<8}{'WinRate%':<10}{'BacktestRet%':<14}")
    print("-" * 80)

    results = []
    for t in args.tickers:
        try:
            r = analyze(t, args.period, TIER_RULES)
            results.append(r)
            print(f"{r.ticker:<7}{r.tier:<10}{r.avg_range_pct:<11.2f}{r.last_close:<11.2f}"
                  f"{r.last_change_pct:<8.2f}{r.trades:<8}{r.win_rate:<10.1f}{r.total_return_pct:<14.2f}")
        except Exception as e:
            print(f"{t:<7} ERROR: {e}")

    print("\nToday's watchlist by strategy:\n")
    for tier_key, tier_info in TIER_RULES.items():
        names = [r.ticker for r in results if r.tier == tier_key]
        if names:
            print(f"  {tier_info['label']}: {', '.join(names)}")

    print("\nNote: this is a daily-bar approximation for speed. For a true intraday\n"
          "backtest, refetch with interval='5m' (yfinance keeps ~60 days of that)\n"
          "and adapt backtest_daily_breakout() to work on intraday bars instead.\n")

    if args.json_out:
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period": args.period,
            "usd_inr_rate": fetch_usd_inr_rate(),
            "tickers": [asdict(r) for r in results],
        }
        with open(args.json_out, "w") as f:
            json.dump(payload, f, indent=2, allow_nan=False)
        print(f"Wrote {args.json_out}")


if __name__ == "__main__":
    main()
