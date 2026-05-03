import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Holding, HoldingRow, PriceData, Trade, WatchlistItem } from "../types";

// Common CoinGecko IDs for popular crypto
export const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  DOGE: "dogecoin",
  XRP: "ripple",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ALGO: "algorand",
  VET: "vechain",
  FTM: "fantom",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  INJ: "injective-protocol",
  SUI: "sui",
  TRX: "tron",
  TON: "the-open-network",
};

interface PortfolioState {
  holdings: Holding[];
  watchlist: WatchlistItem[];
  prices: Record<string, PriceData>;
  usdToSgd: number;
  selectedTicker: string | null;
  addHolding: (holding: Omit<Holding, "trades">) => void;
  addTrade: (ticker: string, trade: Omit<Trade, "id">) => void;
  removeHolding: (ticker: string) => void;
  addToWatchlist: (item: Omit<WatchlistItem, "addedAt">) => void;
  removeFromWatchlist: (ticker: string) => void;
  setPrices: (prices: Record<string, PriceData>) => void;
  setUsdToSgd: (rate: number) => void;
  setSelectedTicker: (ticker: string | null) => void;
  setPortfolio: (holdings: Holding[], watchlist: WatchlistItem[]) => void;
}

const storeDefinition = (set: Parameters<Parameters<typeof create<PortfolioState>>[0]>[0]) => ({
  holdings: [] as Holding[],
  watchlist: [] as WatchlistItem[],
  prices: {} as Record<string, PriceData>,
  usdToSgd: 1.35,
  selectedTicker: null as string | null,

  addHolding: (holding: Omit<Holding, "trades">) =>
    set((state) => {
      if (state.holdings.find((h) => h.ticker === holding.ticker)) return state;
      return { holdings: [...state.holdings, { ...holding, trades: [] }] };
    }),

  addTrade: (ticker: string, trade: Omit<Trade, "id">) =>
    set((state) => ({
      holdings: state.holdings.map((h) =>
        h.ticker === ticker
          ? { ...h, trades: [...h.trades, { ...trade, id: crypto.randomUUID() }] }
          : h
      ),
    })),

  removeHolding: (ticker: string) =>
    set((state) => ({
      holdings: state.holdings.filter((h) => h.ticker !== ticker),
      selectedTicker: state.selectedTicker === ticker ? null : state.selectedTicker,
    })),

  addToWatchlist: (item: Omit<WatchlistItem, "addedAt">) =>
    set((state) => {
      if (state.watchlist.find((w) => w.ticker === item.ticker)) return state;
      return { watchlist: [...state.watchlist, { ...item, addedAt: new Date().toISOString() }] };
    }),

  removeFromWatchlist: (ticker: string) =>
    set((state) => ({ watchlist: state.watchlist.filter((w) => w.ticker !== ticker) })),

  setPrices: (prices: Record<string, PriceData>) => set({ prices }),

  setUsdToSgd: (rate: number) => set({ usdToSgd: rate }),

  setSelectedTicker: (ticker: string | null) => set({ selectedTicker: ticker }),

  setPortfolio: (holdings: Holding[], watchlist: WatchlistItem[]) => set({ holdings, watchlist }),
});

// In production: plain store, no localStorage at all — DB is the only source of truth.
// In dev: persist to localStorage so data survives hot-reloads without a running backend.
export const usePortfolioStore = import.meta.env.PROD
  ? create<PortfolioState>()(storeDefinition)
  : create<PortfolioState>()(
      persist(storeDefinition, {
        name: "portfolio-storage",
        partialize: (state) => ({ holdings: state.holdings, watchlist: state.watchlist }),
      })
    );

// Standalone derived-data functions — call these inside useMemo, not directly as Zustand selectors
// All monetary values in the returned rows are in SGD.
export function computeHoldingRows(
  holdings: Holding[],
  prices: Record<string, PriceData>,
  usdToSgd: number,
): HoldingRow[] {
  return holdings
    .map((h): HoldingRow | null => {
      const priceKey = h.type === "crypto" ? (h.coinId ?? h.ticker) : h.ticker;
      const priceData = prices[priceKey];
      if (!h.trades.length || !priceData) return null;

      const totalShares = h.trades.reduce((s, t) => s + t.quantity, 0);
      // Stocks are purchased in USD → convert to SGD. Crypto is purchased in SGD → keep as-is.
      const totalCostSgd = h.trades.reduce((s, t) => {
        const costSgd = h.type === "stock"
          ? t.quantity * t.purchasePrice * usdToSgd
          : t.quantity * t.purchasePrice;
        return s + costSgd;
      }, 0);
      const avgCostBasisSgd = totalCostSgd / totalShares;
      // Live prices from API are always in USD — convert to SGD
      const currentPriceSgd = priceData.price * usdToSgd;
      const currentValueSgd = totalShares * currentPriceSgd;
      const unrealizedPnL = currentValueSgd - totalCostSgd;
      const unrealizedPnLPct = (unrealizedPnL / totalCostSgd) * 100;

      return {
        ticker: h.ticker,
        type: h.type,
        coinId: h.coinId,
        totalShares,
        avgCostBasis: avgCostBasisSgd,
        currentPrice: currentPriceSgd,
        totalCost: totalCostSgd,
        currentValue: currentValueSgd,
        unrealizedPnL,
        unrealizedPnLPct,
        changePct: priceData.changePct,
      };
    })
    .filter((r): r is HoldingRow => r !== null);
}

export function computeTotals(rows: HoldingRow[]) {
  const totalValue = rows.reduce((s, r) => s + r.currentValue, 0);
  const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const dayChange = rows.reduce((s, r) => s + (r.currentValue * r.changePct) / 100, 0);
  return { totalValue, totalCost, totalPnL, totalPnLPct, dayChange };
}
