"""
Intraday Screener & Backtester — Top 10 US mega-caps
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
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

import numpy as np
import pandas as pd

try:
    import yfinance as yf
except ImportError:
    print("Missing dependency. Run: pip install yfinance pandas numpy")
    sys.exit(1)

WATCHLIST = [
    "NVDA", "TSLA", "AMZN", "META", "AVGO", "AMD", "MSFT", "GOOGL", "AAPL", "JPM",
    "NFLX", "INTC", "ORCL", "CRM", "DIS", "BAC", "PLTR", "INFY",
]

TIER_RULES = {
    "high": {
        "label": "High volatility — Opening Range Breakout",
        "stop_frac": 0.35,   # fraction of avg daily range used as stop distance
        "target_mult": 1.8,  # reward multiple of risk
    },
    "medium": {
        "label": "Medium volatility — VWAP Trend Pullback",
        "stop_frac": 0.30,
        "target_mult": 1.6,
    },
    "low": {
        "label": "Low volatility — Range Fade / Mean Reversion",
        "stop_frac": 0.25,
        "target_mult": 1.3,
    },
}


@dataclass
class TickerResult:
    ticker: str
    avg_range_pct: float
    tier: str
    last_close: float
    last_change_pct: float
    trades: int
    win_rate: float
    total_return_pct: float
    history: list


def classify_tier(avg_range_pct: float) -> str:
    if avg_range_pct >= 3.5:
        return "high"
    elif avg_range_pct >= 2.5:
        return "medium"
    else:
        return "low"


def fetch_history(ticker: str, period: str) -> pd.DataFrame:
    """Daily OHLCV bars for the given period ('2wk', '1mo', etc.)."""
    df = yf.Ticker(ticker).history(period=period, interval="1d")
    if df.empty:
        raise ValueError(f"No data returned for {ticker}")
    # yfinance can include a trailing row for the current session before it has
    # OHLC data (e.g. queried before/around market open) — drop any NaN rows so
    # they don't propagate into last_close/backtest results and break JSON output.
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    if df.empty:
        raise ValueError(f"No usable (non-NaN) data returned for {ticker}")
    return df


def backtest_daily_breakout(df: pd.DataFrame, tier: str) -> tuple[int, float, float]:
    """
    Simplified daily-bar approximation of the strategy:
    - High tier: enter long if today's close breaks above yesterday's high, stop/target from rules.
    - Medium tier: enter long if today's close > 20-day SMA and pulled back to it intraday (low <= SMA <= close).
    - Low tier: enter long if today's low undercuts the 10-day low but closes back above it (fade).
    Returns (num_trades, win_rate_pct, total_return_pct).
    Note: this operates on DAILY bars as a stand-in for a true intraday backtest —
    swap in `interval="5m"` history for a real intraday version (yfinance keeps ~60 days of that).
    """
    rules = TIER_RULES[tier]
    df = df.copy()
    df["sma20"] = df["Close"].rolling(20, min_periods=5).mean()
    df["range_pct"] = (df["High"] - df["Low"]) / df["Close"] * 100

    trades = []
    for i in range(1, len(df)):
        row = df.iloc[i]
        prev = df.iloc[i - 1]
        entry = stop = target = None

        if tier == "high":
            if row["Close"] > prev["High"]:
                entry = row["Close"]
                risk = prev["High"] - prev["Low"]
                stop = entry - risk * rules["stop_frac"]
                target = entry + (entry - stop) * rules["target_mult"]

        elif tier == "medium":
            if not np.isnan(row["sma20"]) and row["Close"] > row["sma20"] and row["Low"] <= row["sma20"]:
                entry = row["Close"]
                risk = entry - row["Low"]
                stop = row["Low"]
                target = entry + risk * rules["target_mult"]

        elif tier == "low":
            ten_day_low = df["Low"].iloc[max(0, i - 10):i].min()
            if row["Low"] < ten_day_low and row["Close"] > ten_day_low:
                entry = row["Close"]
                risk = entry - row["Low"]
                stop = row["Low"]
                target = entry + risk * rules["target_mult"]

        if entry is None:
            continue

        # Look ahead up to 5 bars to see if target or stop hit first (very rough)
        outcome = 0.0
        for j in range(i + 1, min(i + 6, len(df))):
            fwd = df.iloc[j]
            if fwd["Low"] <= stop:
                outcome = (stop - entry) / entry * 100
                break
            if fwd["High"] >= target:
                outcome = (target - entry) / entry * 100
                break
        else:
            # Neither hit — mark to close 5 bars later (or last available)
            end_idx = min(i + 5, len(df) - 1)
            outcome = (df.iloc[end_idx]["Close"] - entry) / entry * 100

        trades.append(outcome)

    if not trades:
        return 0, 0.0, 0.0

    wins = sum(1 for t in trades if t > 0)
    win_rate = wins / len(trades) * 100
    total_return = sum(trades)
    return len(trades), win_rate, total_return


def analyze(ticker: str, period: str) -> TickerResult:
    df = fetch_history(ticker, period)
    df["range_pct"] = (df["High"] - df["Low"]) / df["Close"] * 100
    avg_range_pct = df["range_pct"].mean()
    tier = classify_tier(avg_range_pct)

    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last
    last_change_pct = (last["Close"] - prev["Close"]) / prev["Close"] * 100

    trades, win_rate, total_return = backtest_daily_breakout(df, tier)

    # Reuse the already-fetched bars for client-side charting/experimentation in
    # the dashboard, instead of a second round-trip to a price API in the browser.
    history = [
        {
            "date": idx.strftime("%Y-%m-%d"),
            "open": round(float(row["Open"]), 4),
            "high": round(float(row["High"]), 4),
            "low": round(float(row["Low"]), 4),
            "close": round(float(row["Close"]), 4),
        }
        for idx, row in df.iterrows()
    ]

    return TickerResult(
        ticker=ticker,
        avg_range_pct=avg_range_pct,
        tier=tier,
        last_close=last["Close"],
        last_change_pct=last_change_pct,
        trades=trades,
        win_rate=win_rate,
        total_return_pct=total_return,
        history=history,
    )


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
            r = analyze(t, args.period)
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
            "tickers": [asdict(r) for r in results],
        }
        with open(args.json_out, "w") as f:
            json.dump(payload, f, indent=2, allow_nan=False)
        print(f"Wrote {args.json_out}")


if __name__ == "__main__":
    main()