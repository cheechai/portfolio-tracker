export interface Trade {
  id: string;
  date: string;
  quantity: number;
  purchasePrice: number;
  // currency is implicit: stocks are always purchased in USD, crypto always in SGD
}

export interface Holding {
  ticker: string;
  type: "stock" | "crypto";
  coinId?: string; // CoinGecko ID for crypto, e.g. "bitcoin"
  trades: Trade[];
}

export interface PriceData {
  ticker: string;
  price: number;
  changePct: number;
  lastUpdated: number;
}

export interface HoldingRow {
  ticker: string;
  type: "stock" | "crypto";
  coinId?: string;
  totalShares: number;
  avgCostBasis: number;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  changePct: number;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Mover {
  ticker?: string;
  coin_id?: string;
  symbol?: string;
  name?: string;
  price: number;
  change_pct: number;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  published_at: string | number;
}

export interface WatchlistItem {
  ticker: string;
  type: "stock" | "crypto";
  coinId?: string;
  addedAt: string; // ISO date
}

export type Tab = "portfolio" | "watchlist" | "market";
