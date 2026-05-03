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

export function AddHoldingModal({ onClose, prefillTicker, prefillType, prefillCoinId }: Props) {
  const addHolding = usePortfolioStore((s) => s.addHolding);
  const addTrade = usePortfolioStore((s) => s.addTrade);
  const holdings = usePortfolioStore((s) => s.holdings);
  const setPrices = usePortfolioStore((s) => s.setPrices);
  const prices = usePortfolioStore((s) => s.prices);

  const [ticker, setTicker] = useState(prefillTicker ?? "");
  const [type, setType] = useState<"stock" | "crypto">(prefillType ?? "stock");
  const [coinId] = useState(prefillCoinId ?? ""); // only used for chart history (CoinGecko ID)
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"ticker" | "trade">(prefillTicker ? "trade" : "ticker");
  const [resolvedPrice, setResolvedPrice] = useState<number | null>(null);

  const isAddingTrade = !!prefillTicker || holdings.find((h) => h.ticker === ticker.toUpperCase());

  async function handleTickerNext() {
    if (!ticker) return;
    setError("");
    setLoading(true);
    const sym = ticker.toUpperCase();
    try {
      if (type === "stock") {
        const data = await fetchStockPrice(sym);
        setResolvedPrice(data.price);
        setPrices({ ...prices, [sym]: data });
      } else {
        const data = await fetchCryptoPrice(sym);
        setResolvedPrice(data.price);
        setPrices({ ...prices, [sym]: data });
      }
      setStep("trade");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ticker not found");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quantity || !price) return;
    const sym = ticker.toUpperCase();
    if (!isAddingTrade) {
      addHolding({ ticker: sym, type, coinId: (type === "crypto" && coinId) ? coinId : undefined });
    }
    addTrade(sym, { date, quantity: parseFloat(quantity), purchasePrice: parseFloat(price) });
    onClose();
  }

  const priceCurrency = type === "stock" ? "USD" : "SGD";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-[#1a1d27] border border-slate-700/50 rounded-t-3xl sm:rounded-2xl p-6 slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar for mobile */}
        <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-5 sm:hidden" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">
            {isAddingTrade && prefillTicker ? `Buy More ${prefillTicker}` : "Add Holding"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>

        {step === "ticker" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <div className="flex rounded-xl overflow-hidden border border-slate-700">
                {(["stock", "crypto"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${type === t ? "bg-indigo-600 text-white" : "bg-transparent text-slate-400 hover:text-white"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Ticker Symbol</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder={type === "stock" ? "e.g. AAPL" : "e.g. BTC"}
                className="w-full bg-[#0f1117] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleTickerNext}
              disabled={loading || !ticker}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? "Verifying…" : "Continue →"}
            </button>
          </div>
        )}

        {step === "trade" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {resolvedPrice && (
              <div className="bg-[#0f1117] rounded-xl px-4 py-3 text-sm flex items-center justify-between">
                <span className="text-slate-400">Current price (USD)</span>
                <span className="text-white font-semibold">
                  ${resolvedPrice >= 1000 ? resolvedPrice.toFixed(0) : resolvedPrice >= 1 ? resolvedPrice.toFixed(2) : resolvedPrice.toFixed(4)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Quantity</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Purchase Price ({priceCurrency})</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-[#0f1117] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Purchase Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#0f1117] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {quantity && price && (
              <div className="bg-[#0f1117] rounded-xl px-4 py-3 text-xs text-slate-400 flex justify-between">
                <span>Total cost ({priceCurrency})</span>
                <span className="text-white font-medium">
                  {priceCurrency === "SGD" ? "S$" : "$"}{(parseFloat(quantity) * parseFloat(price)).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex gap-3">
              {!prefillTicker && (
                <button type="button" onClick={() => setStep("ticker")} className="flex-1 border border-slate-700 text-slate-300 font-medium py-3 rounded-xl hover:bg-slate-700/30 transition-colors">
                  ← Back
                </button>
              )}
              <button
                type="submit"
                disabled={!quantity || !price}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
              >
                Add Trade
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
