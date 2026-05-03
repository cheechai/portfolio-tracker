import { useState } from "react";
import { COINGECKO_IDS, usePortfolioStore } from "../../store/portfolio";
import type { WatchlistItem } from "../../types";
import { AddHoldingModal } from "../forms/AddHoldingModal";

function fmtPriceSGD(usd: number, rate: number) {
  const sgd = usd * rate;
  if (sgd >= 1000) return `S$${sgd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (sgd >= 1) return `S$${sgd.toFixed(3)}`;
  return `S$${sgd.toFixed(4)}`;
}

interface WatchlistRowProps {
  item: WatchlistItem;
  onViewChart: () => void;
  onBuy: () => void;
  onRemove: () => void;
  usdToSgd: number;
}

function WatchlistRow({ item, onViewChart, onBuy, onRemove, usdToSgd }: WatchlistRowProps) {
  const prices = usePortfolioStore((s) => s.prices);
  const priceKey = item.type === "crypto"
    ? (item.coinId ?? COINGECKO_IDS[item.ticker] ?? item.ticker.toLowerCase())
    : item.ticker;
  const priceData = prices[priceKey];
  const pos = (priceData?.changePct ?? 0) >= 0;

  return (
    <div className="flex items-center justify-between py-2.5 px-3 border-b border-slate-700/40 last:border-0 hover:bg-slate-800/30 transition-colors group">
      {/* Ticker + type */}
      <button onClick={onViewChart} className="flex items-center gap-2 min-w-0 flex-1 text-left">
        <div className="min-w-0">
          <span className="font-semibold text-white text-sm">{item.ticker}</span>
          <span className="ml-1.5 text-xs text-slate-500">{item.type}</span>
        </div>
      </button>

      {/* Price + change */}
      <div className="text-right mx-3 shrink-0">
        {priceData ? (
          <>
            <p className="text-sm font-medium text-white">{fmtPriceSGD(priceData.price, usdToSgd)}</p>
            <p className={`text-xs ${pos ? "text-emerald-400" : "text-red-400"}`}>
              {pos ? "▲" : "▼"} {Math.abs(priceData.changePct).toFixed(2)}%
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-500">—</p>
        )}
      </div>

      {/* Actions — always visible on mobile, fade in on desktop hover */}
      <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onBuy}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg transition-colors font-medium"
        >
          Buy
        </button>
        <button
          onClick={onRemove}
          className="text-slate-600 hover:text-red-400 px-1.5 py-1 transition-colors text-sm"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function WatchlistTable({ onAddClick }: { onAddClick: () => void }) {
  const watchlist = usePortfolioStore((s) => s.watchlist);
  const removeFromWatchlist = usePortfolioStore((s) => s.removeFromWatchlist);
  const setSelectedTicker = usePortfolioStore((s) => s.setSelectedTicker);
  const usdToSgd = usePortfolioStore((s) => s.usdToSgd);
  const [buyTicker, setBuyTicker] = useState<WatchlistItem | null>(null);

  if (watchlist.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-5xl mb-4">👁️</div>
        <h2 className="text-lg font-semibold text-white mb-2">Watchlist is empty</h2>
        <p className="text-slate-400 text-sm mb-6">
          Track tickers you're interested in without adding a position
        </p>
        <button
          onClick={onAddClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          + Add to Watchlist
        </button>
      </div>
    );
  }

  // Split into two columns for compact grid on wider screens
  const mid = Math.ceil(watchlist.length / 2);
  const col1 = watchlist.slice(0, mid);
  const col2 = watchlist.slice(mid);

  function renderRows(items: WatchlistItem[]) {
    return items.map((item) => (
      <WatchlistRow
        key={item.ticker}
        item={item}
        usdToSgd={usdToSgd}
        onViewChart={() => setSelectedTicker(item.ticker)}
        onBuy={() => setBuyTicker(item)}
        onRemove={() => removeFromWatchlist(item.ticker)}
      />
    ));
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between py-3">
        <p className="text-sm text-slate-400">{watchlist.length} ticker{watchlist.length !== 1 ? "s" : ""} watched</p>
        <button
          onClick={onAddClick}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
        >
          + Add ticker
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <div className="bg-[#1a1d27] border border-slate-700/50 rounded-2xl overflow-hidden">
          {renderRows(col1)}
        </div>
        {col2.length > 0 && (
          <div className="bg-[#1a1d27] border border-slate-700/50 rounded-2xl overflow-hidden mt-4 sm:mt-0">
            {renderRows(col2)}
          </div>
        )}
      </div>

      {buyTicker && (
        <AddHoldingModal
          onClose={() => setBuyTicker(null)}
          prefillTicker={buyTicker.ticker}
          prefillType={buyTicker.type}
          prefillCoinId={buyTicker.coinId}
        />
      )}
    </div>
  );
}
