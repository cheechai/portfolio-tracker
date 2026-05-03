import { useState } from "react";
import { fetchCryptoPrice } from "../../api/crypto";
import { fetchStockPrice } from "../../api/stocks";
import { usePortfolioStore } from "../../store/portfolio";

interface Props {
  onClose: () => void;
  prefillTicker?: string;
  prefillType?: "stock" | "crypto";
  prefillCoinId?: string;
}

export function AddWatchlistModal({
  onClose,
  prefillTicker,
  prefillType,
}: // prefillCoinId,
Props) {
  const addToWatchlist = usePortfolioStore((s) => s.addToWatchlist);
  const setPrices = usePortfolioStore((s) => s.setPrices);
  const prices = usePortfolioStore((s) => s.prices);

  const [ticker, setTicker] = useState(prefillTicker ?? "");
  const [type, setType] = useState<"stock" | "crypto">(prefillType ?? "stock");
  // const [coinId, setCoinId] = useState(prefillCoinId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If prefill is provided, skip validation — ticker is already known good
  const hasPreFill = !!prefillTicker;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker) return;
    setError("");
    setLoading(true);
    const sym = ticker.toUpperCase();

    try {
      if (type === "stock") {
        const data = await fetchStockPrice(sym);
        setPrices({ ...prices, [sym]: data });
        addToWatchlist({ ticker: sym, type: "stock" });
      } else {
        const data = await fetchCryptoPrice(sym);
        setPrices({ ...prices, [sym]: data });
        addToWatchlist({ ticker: sym, type: "crypto" });
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ticker not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-[#1a1d27] border border-slate-700/50 rounded-t-3xl sm:rounded-2xl p-6 slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5 sm:hidden" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Add to Watchlist</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!hasPreFill && (
            <>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Type
                </label>
                <div className="flex rounded-xl overflow-hidden border border-slate-700">
                  {(["stock", "crypto"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${
                        type === t
                          ? "bg-indigo-600 text-white"
                          : "bg-transparent text-slate-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  Ticker Symbol
                </label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder={type === "stock" ? "e.g. AAPL" : "e.g. BTC"}
                  autoFocus
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </>
          )}

          {hasPreFill && (
            <div className="bg-[#0f1117] rounded-xl px-4 py-3 text-sm flex items-center gap-3">
              <span className="text-white font-semibold">{prefillTicker}</span>
              <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded-full capitalize">
                {prefillType}
              </span>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || !ticker}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
          >
            {loading ? "Verifying…" : "Add to Watchlist 👁️"}
          </button>
        </form>
      </div>
    </div>
  );
}
