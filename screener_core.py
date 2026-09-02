"""
Shared analysis engine for the daily-bar tiered breakout/pullback/fade
strategy, used by both `intraday_screener.py` (US watchlist, USD) and
`intraday_screener_in.py` (Nifty 100 watchlist, INR). Extracted so the two
markets share one tested implementation instead of drifting apart — keep
this file the single source of truth for the backtest math; each market's
runner script should only differ in watchlist, currency, and TIER_RULES
tuning, never in the underlying logic.

This is a daily-bar approximation of intraday behavior, not a true
tick-by-tick backtest — see each runner script's own docstring.
"""

import sys
from dataclasses import dataclass

import numpy as np
import pandas as pd

try:
    import yfinance as yf
except ImportError:
    print("Missing dependency. Run: pip install yfinance pandas numpy")
    sys.exit(1)

DEFAULT_TIER_RULES = {
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


def backtest_daily_breakout(df: pd.DataFrame, tier: str, tier_rules: dict = DEFAULT_TIER_RULES) -> tuple[int, float, float]:
    """
    Simplified daily-bar approximation of the strategy:
    - High tier: enter long if today's close breaks above yesterday's high, stop/target from rules.
    - Medium tier: enter long if today's close > 20-day SMA and pulled back to it intraday (low <= SMA <= close).
    - Low tier: enter long if today's low undercuts the 10-day low but closes back above it (fade).
    Returns (num_trades, win_rate_pct, total_return_pct).
    Note: this operates on DAILY bars as a stand-in for a true intraday backtest —
    swap in `interval="5m"` history for a real intraday version (yfinance keeps ~60 days of that).
    """
    rules = tier_rules[tier]
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


def analyze(ticker: str, period: str, tier_rules: dict = DEFAULT_TIER_RULES) -> TickerResult:
    df = fetch_history(ticker, period)
    df["range_pct"] = (df["High"] - df["Low"]) / df["Close"] * 100
    avg_range_pct = df["range_pct"].mean()
    tier = classify_tier(avg_range_pct)

    last = df.iloc[-1]
    prev = df.iloc[-2] if len(df) > 1 else last
    last_change_pct = (last["Close"] - prev["Close"]) / prev["Close"] * 100

    trades, win_rate, total_return = backtest_daily_breakout(df, tier, tier_rules)

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
