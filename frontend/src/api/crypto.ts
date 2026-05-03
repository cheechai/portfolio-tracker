import type { Mover, PriceData } from "../types";
import { apiFetch } from "./client";

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

export async function fetchCryptoPrice(ticker: string): Promise<PriceData> {
  const key = `crypto:${ticker.toUpperCase()}`;
  const hit = cached<PriceData>(key);
  if (hit) return hit;
  const raw = await apiFetch<{ ticker: string; price: number; change_pct: number }>(`/crypto/${ticker.toUpperCase()}`);
  return setCache(key, {
    ticker: raw.ticker,
    price: raw.price,
    changePct: raw.change_pct ?? 0,
    lastUpdated: Date.now(),
  });
}

export async function fetchCryptoPrices(tickers: string[]): Promise<Record<string, PriceData>> {
  if (!tickers.length) return {};

  const result: Record<string, PriceData> = {};
  const misses: string[] = [];
  for (const t of tickers) {
    const hit = cached<PriceData>(`crypto:${t.toUpperCase()}`);
    if (hit) result[t.toUpperCase()] = hit;
    else misses.push(t.toUpperCase());
  }

  if (misses.length) {
    const raw = await apiFetch<Record<string, { ticker: string; price: number; change_pct: number }>>(
      `/crypto/prices?tickers=${encodeURIComponent(misses.join(","))}`,
    );
    for (const [sym, entry] of Object.entries(raw)) {
      const data: PriceData = {
        ticker: sym,
        price: entry.price,
        changePct: entry.change_pct ?? 0,
        lastUpdated: Date.now(),
      };
      setCache(`crypto:${sym}`, data);
      result[sym] = data;
    }
  }

  return result;
}

export async function fetchCryptoHistory(coinId: string, period: string): Promise<import("../types").OHLCVBar[]> {
  const key = `crypto:history:${coinId}:${period}`;
  const hit = cached<import("../types").OHLCVBar[]>(key);
  if (hit) return hit;
  const data = await apiFetch<import("../types").OHLCVBar[]>(`/crypto/history/${coinId}?period=${period}`);
  return setCache(key, data);
}

export async function fetchCryptoMovers(): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  const key = "crypto:movers";
  const hit = cached<{ gainers: Mover[]; losers: Mover[] }>(key);
  if (hit) return hit;
  const data = await apiFetch<{ gainers: Mover[]; losers: Mover[] }>("/crypto/movers/top");
  return setCache(key, data);
}
