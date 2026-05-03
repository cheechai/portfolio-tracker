import { useEffect, useState } from "react";
import { fetchCryptoHistory } from "../../api/crypto";
import { fetchHistory } from "../../api/stocks";
import { usePortfolioStore } from "../../store/portfolio";
import type { OHLCVBar } from "../../types";
import { AddHoldingModal } from "../forms/AddHoldingModal";
import { IndicatorPanel } from "./IndicatorPanel";
import { NewsPanel } from "./NewsPanel";
import { PriceChart } from "./PriceChart";

type Period = "1d" | "1wk" | "1mo" | "3mo" | "1y";

function fmtPrice(n: number) {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function TickerDrawer() {
  const selectedTicker = usePortfolioStore((s) => s.selectedTicker);
  const setSelectedTicker = usePortfolioStore((s) => s.setSelectedTicker);
  const holdings = usePortfolioStore((s) => s.holdings);
  const prices = usePortfolioStore((s) => s.prices);
  const removeHolding = usePortfolioStore((s) => s.removeHolding);

  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [period, setPeriod] = useState<Period>("3mo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const watchlist = usePortfolioStore((s) => s.watchlist);
  const holding = holdings.find((h) => h.ticker === selectedTicker);
  const watchlistItem = watchlist.find((w) => w.ticker === selectedTicker);
  const item = holding ?? watchlistItem;
  const isCrypto = item?.type === "crypto";
  // coinId is the CoinGecko ID used only for chart history — falls back to lowercase ticker
  const coinId = item?.type === "crypto"
    ? (item.coinId ?? item.ticker.toLowerCase())
    : null;
  const priceData = selectedTicker ? prices[selectedTicker] : null;

  useEffect(() => {
    if (!selectedTicker) return;
    setLoading(true);
    setError("");
    const fetch = isCrypto && coinId
      ? fetchCryptoHistory(coinId, period)
      : fetchHistory(selectedTicker, period);
    fetch
      .then(setBars)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedTicker, period, isCrypto, coinId]);

  if (!selectedTicker) return null;

  const isOpen = !!selectedTicker;
  const changePct = priceData?.changePct ?? 0;
  const changePos = changePct >= 0;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setSelectedTicker(null)}
      />

      {/* Drawer — slides up on mobile, fixed right panel on desktop */}
      <div
        className={`
          fixed z-40 bg-[#0f1117] border-slate-700/50 overflow-y-auto
          bottom-0 left-0 right-0 max-h-[90svh] rounded-t-3xl border-t border-x slide-up
          md:top-0 md:right-0 md:bottom-0 md:left-auto md:w-[420px] md:max-h-none md:rounded-none md:border-l md:border-t-0 md:border-x-0
          transition-transform duration-300
          ${isOpen ? "translate-y-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}
        `}
      >
        {/* Handle (mobile) */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-3 mb-1 md:hidden" />

        {/* Header */}
        <div className="sticky top-0 bg-[#0f1117] border-b border-slate-700/50 px-4 py-3 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedTicker(null)} className="text-slate-400 hover:text-white text-xl md:hidden">←</button>
              <button onClick={() => setSelectedTicker(null)} className="hidden md:block text-slate-400 hover:text-white">✕</button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">{selectedTicker}</h2>
                  {priceData && (
                    <>
                      <span className="text-white font-semibold">{fmtPrice(priceData.price)}</span>
                      <span className={`text-sm font-medium ${changePos ? "text-emerald-400" : "text-red-400"}`}>
                        {changePos ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAdd(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Buy More
              </button>
              <button
                onClick={() => { if (confirm(`Remove ${selectedTicker} from portfolio?`)) { removeHolding(selectedTicker); } }}
                className="text-slate-500 hover:text-red-400 text-sm px-2 py-1.5 transition-colors"
                title="Remove holding"
              >
                🗑
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-6 pb-24 md:pb-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-400 text-sm">Loading chart…</div>
            </div>
          )}
          {error && <div className="text-red-400 text-sm py-4">{error}</div>}
          {!loading && !error && bars.length > 0 && (
            <>
              <section>
                <PriceChart bars={bars} period={period} onPeriodChange={setPeriod} />
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Technical Analysis</h3>
                <IndicatorPanel bars={bars} />
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Latest News</h3>
                <NewsPanel ticker={selectedTicker} />
              </section>
            </>
          )}
        </div>
      </div>

      {showAdd && <AddHoldingModal onClose={() => setShowAdd(false)} prefillTicker={selectedTicker} />}
    </>
  );
}
