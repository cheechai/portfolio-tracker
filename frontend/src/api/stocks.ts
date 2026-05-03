import type { Mover, NewsItem, OHLCVBar, PriceData } from "../types";
import { apiFetch } from "./client";

interface RawPrice {
  ticker: string;
  price: number;
  change_pct: number;
}

// In-memory cache
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 60_000;

function cached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < TTL) return entry.data as T;
  return null;
}
function setCache<T>(key: string, data: T): T {
  cache.set(key, { data, ts: Date.now() });
  return data;
}

export async function fetchStockPrice(ticker: string): Promise<PriceData> {
  const key = `price:${ticker}`;
  const hit = cached<PriceData>(key);
  if (hit) return hit;
  const raw = await apiFetch<RawPrice>(`/price/${ticker}`);
  return setCache(key, { ticker: raw.ticker, price: raw.price, changePct: raw.change_pct, lastUpdated: Date.now() });
}

export async function fetchHistory(ticker: string, period = "3mo"): Promise<OHLCVBar[]> {
  const key = `history:${ticker}:${period}`;
  const hit = cached<OHLCVBar[]>(key);
  if (hit) return hit;
  const data = await apiFetch<OHLCVBar[]>(`/history/${ticker}?period=${period}`);
  return setCache(key, data);
}

export async function fetchStockMovers(): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  const key = "movers:stocks";
  const hit = cached<{ gainers: Mover[]; losers: Mover[] }>(key);
  if (hit) return hit;
  const data = await apiFetch<{ gainers: Mover[]; losers: Mover[] }>("/movers/stocks");
  return setCache(key, data);
}

export async function fetchNews(ticker: string): Promise<NewsItem[]> {
  const key = `news:${ticker}`;
  const hit = cached<NewsItem[]>(key);
  if (hit) return hit;
  const data = await apiFetch<NewsItem[]>(`/news/${ticker}`);
  return setCache(key, data);
}

export async function syncHoldings(
  holdings: { ticker: string; type: string; coinId?: string; trades: { quantity: number; purchasePrice: number }[] }[],
  usdToSgd: number,
): Promise<void> {
  await apiFetch("/notify/holdings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings, usdToSgd }),
  });
}

export async function fetchUsdToSgd(): Promise<number> {
  const key = "fx:usd-sgd";
  const hit = cached<{ usd_to_sgd: number }>(key);
  if (hit) return hit.usd_to_sgd;
  const data = await apiFetch<{ usd_to_sgd: number }>("/fx/usd-sgd");
  setCache(key, data);
  return data.usd_to_sgd;
}
