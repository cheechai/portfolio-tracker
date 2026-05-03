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

export async function fetchCryptoPrice(ticker: string, coinId: string): Promise<PriceData> {
  const key = `crypto:${coinId}`;
  const hit = cached<PriceData>(key);
  if (hit) return hit;
  const raw = await apiFetch<{ coin_id: string; price: number; change_pct: number }>(`/crypto/${coinId}`);
  return setCache(key, {
    ticker,
    price: raw.price,
    changePct: raw.change_pct ?? 0,
    lastUpdated: Date.now(),
  });
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
