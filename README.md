# Portfolio Tracker

A personal stock & crypto portfolio tracker with live P&L, technical analysis indicators, market movers, and latest news. Mobile-responsive, password-protected, and deployable to Railway.

## Features

- **Dashboard** — Total portfolio value, cost basis, unrealised P&L, and day change
- **Holdings** — Per-ticker cards with live prices, P&L, and buy/sell/hold signals
- **Add positions** — Add new stocks or crypto with purchase date, quantity, and price
- **Ticker detail** — Slide-up chart panel with:
  - Price chart (1W / 1M / 3M / 1Y) with overlay toggles: SMA20, SMA50, EMA50, Bollinger Bands
  - Technical indicators: RSI, MACD, Stochastic, OBV, ATR
  - Multi-indicator BUY / SELL / HOLD signal with score breakdown
  - Latest news headlines
- **Market movers** — Top 5 stock gainers/losers and top 5 crypto gainers/losers
- **Allocation chart** — Donut chart showing portfolio breakdown by holding

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Charts | Recharts |
| State | Zustand + localStorage (no database needed) |
| Backend | FastAPI (Python) |
| Stock data | yfinance (free, no API key) |
| Crypto data | CoinGecko (free, no API key) |
| Hosting | Railway |

---

## Running Locally

### 1. Backend

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate        # Mac/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
# Edit .env and set your password:
#   APP_PASSWORD=your_password_here

# Start the API server
uvicorn main:app --reload --port 8000
```

The backend runs at `http://localhost:8000`. Test it:
```bash
curl -H "Authorization: Bearer your_password_here" http://localhost:8000/auth/verify
# → {"ok": true}
```

### 2. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create your .env file
cp .env.example .env
# .env already points to http://localhost:8000 — no changes needed for local dev

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser. Enter the password you set in `backend/.env`.

---

## Adding Stocks & Crypto

1. Click **+ Add** (desktop) or the **+** button in the bottom tab bar (mobile)
2. Select **stock** or **crypto**
3. Enter the ticker symbol (e.g. `AAPL`, `NVDA` for stocks; `BTC`, `ETH`, `SOL` for crypto)
4. Enter quantity, purchase price, and date
5. Click **Add Trade**

Common crypto tickers are auto-mapped to CoinGecko IDs. For unlisted coins, enter the CoinGecko ID manually (find it at coingecko.com — e.g. `bitcoin`, `ethereum`).

Holdings persist in your browser's `localStorage` — they survive page refreshes.

---

## Deploying to Railway

### Prerequisites
- A [Railway](https://railway.app) account
- This repo pushed to GitHub

### Steps

1. **Create a new Railway project** and connect your GitHub repo

2. **Add the backend service:**
   - Set root directory to `backend`
   - Add environment variables in the Variables tab:
     ```
     APP_PASSWORD=your_secure_password
     FRONTEND_URL=https://your-frontend.up.railway.app
     ```

3. **Add the frontend service:**
   - Set root directory to `frontend`
   - Add environment variable:
     ```
     VITE_API_URL=https://your-backend.up.railway.app
     ```
   - Set the build command: `npm run build`
   - Set the start command: `npx serve dist -p $PORT`

4. Deploy both services. Railway will give each a public URL.

5. Visit your frontend URL from any browser or phone. Done.

---

## Technical Indicators Reference

| Indicator | Signal |
|---|---|
| RSI < 30 | Oversold — potential buy |
| RSI > 70 | Overbought — potential sell |
| MACD crossover above signal line | Bullish |
| Stochastic %K crosses %D from <20 | Oversold crossover |
| Price below lower Bollinger Band | Mean-reversion buy signal |
| Golden cross (SMA50 > SMA200) | Long-term bullish |
| OBV rising while price flat | Accumulation |

Signal score: sum of individual signals. **+2 or more = BUY**, **-2 or less = SELL**, otherwise **HOLD**.

> For educational purposes only — not financial advice.
