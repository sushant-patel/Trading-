"""
Lightweight live-price bridge for the India (Nifty 100) module.

Why this exists: results_in.json only refreshes once a day (before NSE
open, via daily_screener_in.yml), so a same-day "hourly during market
hours" paper-trading check would see the identical stale price at every
check if it only read results_in.json. Cloud routines (Claude Code
scheduled routines) run in a network-restricted sandbox that has already
been confirmed unable to reach yfinance/Yahoo endpoints directly -- so they
can't fetch a live price themselves either.

GitHub Actions runners have full, unrestricted internet access (already
proven by daily_screener.yml/daily_screener_in.yml). So this script runs
there instead, on a tight schedule during NSE hours, fetches ONE current
price for whichever ticker portfolio_in.json's 'discovered_in' strategy
currently holds (if any), and publishes it to live_price_in.json --
mirroring the same "fetch where network isn't restricted, publish for the
restricted routine to read via raw.githubusercontent.com" pattern already
used for results.json's usd_inr_rate field.

If no position is currently open, this writes ticker: null and the hourly
routine falls back to results_in.json's last daily close.
"""

import json
import sys
from datetime import datetime, timezone

try:
    import yfinance as yf
except ImportError:
    print("Missing dependency. Run: pip install yfinance")
    sys.exit(1)


def main():
    with open("portfolio_in.json") as f:
        portfolio = json.load(f)

    open_positions = [
        p for p in portfolio["strategies"]["discovered_in"]["positions"]
        if p["status"] == "open"
    ]

    if not open_positions:
        payload = {
            "ticker": None,
            "price": None,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "note": "No open position in discovered_in -- nothing to fetch.",
        }
    else:
        ticker = open_positions[0]["ticker"]
        df = yf.Ticker(ticker).history(period="1d", interval="1m")
        df = df.dropna(subset=["Close"])
        if df.empty:
            # Market may not have printed a bar yet (e.g. right at open) --
            # fall back to the most recent daily close rather than fail loudly.
            df = yf.Ticker(ticker).history(period="5d", interval="1d").dropna(subset=["Close"])
        if df.empty:
            raise ValueError(f"No live or recent price available for {ticker}")
        price = round(float(df["Close"].iloc[-1]), 4)
        payload = {
            "ticker": ticker,
            "price": price,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    with open("live_price_in.json", "w") as f:
        json.dump(payload, f, indent=2, allow_nan=False)
    print(f"Wrote live_price_in.json: {payload}")


if __name__ == "__main__":
    main()
