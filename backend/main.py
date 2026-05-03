import os
import time

import httpx
import yfinance as yf
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

APP_PASSWORD = os.getenv("APP_PASSWORD", "changeme")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

app = FastAPI(title="Portfolio Tracker API")

# In-memory store for holdings synced from the frontend
_holdings_store: list[dict] = []
_usd_to_sgd: float = 1.35

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Simple in-memory cache: {key: (data, timestamp)}
_cache: dict[str, tuple] = {}
CACHE_TTL = 60  # seconds


def _cached(key: str, ttl: int = CACHE_TTL):
    entry = _cache.get(key)
    if entry and time.time() - entry[1] < ttl:
        return entry[0]
    return None


def _set_cache(key: str, data):
    _cache[key] = (data, time.time())
    return data


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    if credentials.credentials != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid password")
    return credentials.credentials


# ── Auth ──────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/auth/verify")
def auth_verify(token: str = Depends(verify_token)):
    return {"ok": True}


# ── Stock price & history ─────────────────────────────────────────────────────

@app.get("/price/{ticker}")
def get_price(ticker: str, token: str = Depends(verify_token)):
    key = f"price:{ticker.upper()}"
    cached = _cached(key)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker.upper())
        # Use 2-day history to get current and prev close reliably
        hist = t.history(period="2d")
        if hist.empty or len(hist) < 1:
            raise HTTPException(status_code=404, detail=f"Ticker not found: {ticker}")
        price = float(hist["Close"].iloc[-1])
        prev_close = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else price
        change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0
        data = {
            "ticker": ticker.upper(),
            "price": round(price, 4),
            "change_pct": round(change_pct, 2),
            "prev_close": round(prev_close, 4),
        }
        return _set_cache(key, data)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail=f"Ticker not found: {ticker}")


@app.get("/history/{ticker}")
def get_history(ticker: str, period: str = "3mo", token: str = Depends(verify_token)):
    key = f"history:{ticker.upper()}:{period}"
    cached = _cached(key, ttl=60 if period == "1d" else 300)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker.upper())
        if period == "1d":
            hist = t.history(period="1d", interval="5m")
        else:
            hist = t.history(period=period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No history for {ticker}")
        import datetime as dt
        sgt = dt.timezone(dt.timedelta(hours=8))
        # Intraday: format as datetime string in SGT; daily: date only
        if period == "1d":
            hist.index = hist.index.tz_convert(sgt).strftime("%Y-%m-%dT%H:%M")
        else:
            hist.index = hist.index.strftime("%Y-%m-%d")
        records = []
        for date, row in hist.iterrows():
            records.append({
                "date": date,
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]),
            })
        return _set_cache(key, records)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"History not found: {ticker}")


# ── Stock movers ──────────────────────────────────────────────────────────────

# Fixed watchlist of liquid US stocks — used to compute top movers
WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V",
    "UNH", "XOM", "LLY", "JNJ", "WMT", "MA", "CVX", "HD", "AVGO", "MRK",
    "ABBV", "COST", "PEP", "KO", "ADBE", "NFLX", "AMD", "CRM", "INTC", "QCOM",
    "BAC", "GS", "MS", "C", "WFC", "PYPL", "SQ", "UBER", "LYFT", "ABNB",
    "PLTR", "RIVN", "LCID", "NIO", "SMCI", "ARM", "SNOW", "COIN", "MSTR", "SOFI",
]


@app.get("/movers/stocks")
def get_stock_movers(token: str = Depends(verify_token)):
    key = "movers:stocks"
    cached = _cached(key, ttl=120)
    if cached:
        return cached

    try:
        tickers = yf.Tickers(" ".join(WATCHLIST))
        results = []
        for sym in WATCHLIST:
            try:
                info = tickers.tickers[sym].fast_info
                price = info.last_price
                prev = info.previous_close
                if price and prev:
                    pct = (price - prev) / prev * 100
                    results.append({"ticker": sym, "price": round(price, 2), "change_pct": round(pct, 2)})
            except Exception:
                continue
        results.sort(key=lambda x: abs(x["change_pct"]), reverse=True)
        top = {
            "gainers": [r for r in results if r["change_pct"] > 0][:5],
            "losers": [r for r in results if r["change_pct"] < 0][:5],
        }
        return _set_cache(key, top)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── FX rate ───────────────────────────────────────────────────────────────────

@app.get("/fx/usd-sgd")
async def get_usd_sgd(token: str = Depends(verify_token)):
    key = "fx:usd-sgd"
    cached = _cached(key, ttl=3600)  # refresh once per hour
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "usd-coin", "vs_currencies": "sgd"},
            )
            r.raise_for_status()
            raw = r.json()
            rate = raw.get("usd-coin", {}).get("sgd")
            if not rate:
                raise ValueError("missing rate")
            data = {"usd_to_sgd": round(rate, 4)}
            return _set_cache(key, data)
        except Exception:
            # Fallback: use yfinance SGD=X ticker
            try:
                hist = yf.Ticker("SGD=X").history(period="2d")
                if not hist.empty:
                    rate = float(hist["Close"].iloc[-1])
                    data = {"usd_to_sgd": round(rate, 4)}
                    return _set_cache(key, data)
            except Exception:
                pass
            # Last resort hardcoded fallback
            return {"usd_to_sgd": 1.35}


# ── Crypto via CoinGecko ──────────────────────────────────────────────────────

@app.get("/crypto/{coin_id}")
async def get_crypto(coin_id: str, token: str = Depends(verify_token)):
    key = f"crypto:{coin_id.lower()}"
    cached = _cached(key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={
                    "ids": coin_id.lower(),
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                    "include_24hr_vol": "true",
                },
            )
            r.raise_for_status()
            raw = r.json()
            if coin_id.lower() not in raw:
                raise HTTPException(status_code=404, detail=f"Coin not found: {coin_id}")
            coin = raw[coin_id.lower()]
            data = {
                "coin_id": coin_id.lower(),
                "price": coin.get("usd"),
                "change_pct": coin.get("usd_24h_change"),
            }
            return _set_cache(key, data)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@app.get("/crypto/movers/top")
async def get_crypto_movers(token: str = Depends(verify_token)):
    key = "crypto:movers"
    cached = _cached(key, ttl=120)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={
                    "vs_currency": "usd",
                    "order": "market_cap_desc",
                    "per_page": 50,
                    "page": 1,
                    "price_change_percentage": "24h",
                },
            )
            r.raise_for_status()
            coins = r.json()
            results = [
                {
                    "coin_id": c["id"],
                    "symbol": c["symbol"].upper(),
                    "name": c["name"],
                    "price": c["current_price"],
                    "change_pct": c.get("price_change_percentage_24h"),
                }
                for c in coins
                if c.get("price_change_percentage_24h") is not None
            ]
            results.sort(key=lambda x: abs(x["change_pct"]), reverse=True)
            top = {
                "gainers": [r for r in results if r["change_pct"] > 0][:5],
                "losers": [r for r in results if r["change_pct"] < 0][:5],
            }
            return _set_cache(key, top)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# ── Crypto history via CoinGecko ─────────────────────────────────────────────

PERIOD_TO_DAYS = {"1d": 1, "1wk": 7, "1mo": 30, "3mo": 90, "1y": 365}

@app.get("/crypto/history/{coin_id}")
async def get_crypto_history(coin_id: str, period: str = "3mo", token: str = Depends(verify_token)):
    import datetime as dt
    sgt = dt.timezone(dt.timedelta(hours=8))
    key = f"crypto:history:{coin_id.lower()}:{period}"
    cached = _cached(key, ttl=60 if period == "1d" else 300)
    if cached:
        return cached

    days = PERIOD_TO_DAYS.get(period, 90)
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            if period == "1d":
                # market_chart gives minute-level prices for days=1
                r = await client.get(
                    f"https://api.coingecko.com/api/v3/coins/{coin_id.lower()}/market_chart",
                    params={"vs_currency": "usd", "days": 1},
                )
                r.raise_for_status()
                prices = r.json().get("prices", [])  # [[timestamp_ms, price], ...]
                records = []
                for ts_ms, price in prices:
                    records.append({
                        "date": dt.datetime.fromtimestamp(ts_ms / 1000, tz=sgt).strftime("%Y-%m-%dT%H:%M"),
                        "open": price,
                        "high": price,
                        "low": price,
                        "close": price,
                        "volume": 0,
                    })
            else:
                r = await client.get(
                    f"https://api.coingecko.com/api/v3/coins/{coin_id.lower()}/ohlc",
                    params={"vs_currency": "usd", "days": days},
                )
                r.raise_for_status()
                raw = r.json()  # [[timestamp_ms, open, high, low, close], ...]
                records = []
                for bar in raw:
                    ts_ms, o, h, l, c = bar
                    records.append({
                        "date": dt.datetime.fromtimestamp(ts_ms / 1000, tz=dt.timezone.utc).strftime("%Y-%m-%d"),
                        "open": o,
                        "high": h,
                        "low": l,
                        "close": c,
                        "volume": 0,
                    })
            return _set_cache(key, records)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# ── News ──────────────────────────────────────────────────────────────────────

@app.get("/news/{ticker}")
def get_news(ticker: str, token: str = Depends(verify_token)):
    key = f"news:{ticker.upper()}"
    cached = _cached(key, ttl=300)
    if cached:
        return cached

    try:
        t = yf.Ticker(ticker.upper())
        news = t.news or []
        items = []
        for n in news[:10]:
            content = n.get("content", {})
            items.append({
                "title": content.get("title", n.get("title", "")),
                "url": content.get("canonicalUrl", {}).get("url", n.get("link", "")),
                "source": content.get("provider", {}).get("displayName", n.get("publisher", "")),
                "published_at": content.get("pubDate", n.get("providerPublishTime", "")),
            })
        return _set_cache(key, items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Holdings sync (frontend pushes on change) ─────────────────────────────────

from pydantic import BaseModel

class HoldingTrade(BaseModel):
    quantity: float
    purchasePrice: float

class HoldingItem(BaseModel):
    ticker: str
    type: str
    coinId: str | None = None
    trades: list[HoldingTrade]

class HoldingsPayload(BaseModel):
    holdings: list[HoldingItem]
    usdToSgd: float = 1.35

@app.post("/notify/holdings")
def sync_holdings(payload: HoldingsPayload, token: str = Depends(verify_token)):
    global _holdings_store, _usd_to_sgd
    _holdings_store = [h.model_dump() for h in payload.holdings]
    _usd_to_sgd = payload.usdToSgd
    return {"ok": True}


# ── Telegram daily summary ────────────────────────────────────────────────────

async def _send_telegram(text: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(url, json={
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "HTML",
        })


async def send_daily_summary():
    if not _holdings_store:
        return

    lines = []
    total_cost_sgd = 0.0
    total_value_sgd = 0.0
    total_day_sgd = 0.0

    for h in _holdings_store:
        ticker = h["ticker"]
        htype = h["type"]
        coin_id = h.get("coinId")
        trades = h.get("trades", [])
        if not trades:
            continue

        try:
            if htype == "stock":
                t = yf.Ticker(ticker)
                hist = t.history(period="2d")
                if hist.empty or len(hist) < 2:
                    continue
                price_usd = float(hist["Close"].iloc[-1])
                prev_usd = float(hist["Close"].iloc[-2])
                change_pct = (price_usd - prev_usd) / prev_usd * 100
                price_sgd = price_usd * _usd_to_sgd
                cost_sgd = sum(t["quantity"] * t["purchasePrice"] * _usd_to_sgd for t in trades)
            else:
                cid = coin_id or ticker.lower()
                async with httpx.AsyncClient(timeout=10) as client:
                    r = await client.get(
                        "https://api.coingecko.com/api/v3/simple/price",
                        params={"ids": cid, "vs_currencies": "usd", "include_24hr_change": "true"},
                    )
                    data = r.json().get(cid, {})
                price_usd = data.get("usd", 0)
                change_pct = data.get("usd_24h_change", 0)
                price_sgd = price_usd * _usd_to_sgd
                cost_sgd = sum(t["quantity"] * t["purchasePrice"] for t in trades)

            total_shares = sum(t["quantity"] for t in trades)
            value_sgd = total_shares * price_sgd
            day_sgd = value_sgd * change_pct / 100
            pnl_sgd = value_sgd - cost_sgd
            pnl_pct = pnl_sgd / cost_sgd * 100 if cost_sgd else 0

            total_cost_sgd += cost_sgd
            total_value_sgd += value_sgd
            total_day_sgd += day_sgd

            day_sign = "▲" if change_pct >= 0 else "▼"
            pnl_sign = "+" if pnl_sgd >= 0 else ""
            lines.append(
                f"<b>{ticker}</b>  S${value_sgd:,.2f}\n"
                f"  Day: {day_sign} {abs(change_pct):.2f}%  (S${day_sgd:+,.2f})\n"
                f"  P&amp;L: {pnl_sign}S${pnl_sgd:,.2f} ({pnl_sign}{pnl_pct:.2f}%)"
            )
        except Exception:
            continue

    if not lines:
        return

    total_pnl = total_value_sgd - total_cost_sgd
    total_pnl_pct = total_pnl / total_cost_sgd * 100 if total_cost_sgd else 0
    day_sign = "▲" if total_day_sgd >= 0 else "▼"
    pnl_sign = "+" if total_pnl >= 0 else ""

    import datetime as dt
    sgt = dt.timezone(dt.timedelta(hours=8))
    date_str = dt.datetime.now(tz=sgt).strftime("%d %b %Y")

    msg = (
        f"🗓 <b>Pocketfolio Daily — {date_str}</b>\n\n"
        + "\n\n".join(lines)
        + f"\n\n{'─'*28}\n"
        f"<b>Total Value:</b>  S${total_value_sgd:,.2f}\n"
        f"<b>Today:</b>  {day_sign} S${abs(total_day_sgd):,.2f}\n"
        f"<b>Total P&amp;L:</b>  {pnl_sign}S${total_pnl:,.2f} ({pnl_sign}{total_pnl_pct:.2f}%)"
    )
    await _send_telegram(msg)


# ── Scheduler startup ─────────────────────────────────────────────────────────

@app.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone="Asia/Singapore")
    scheduler.add_job(send_daily_summary, CronTrigger(hour=8, minute=0, timezone="Asia/Singapore"))
    scheduler.start()
