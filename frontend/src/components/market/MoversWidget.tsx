import { useEffect, useState } from "react";
import { fetchCryptoMovers } from "../../api/crypto";
import { fetchStockMovers } from "../../api/stocks";
import { AddWatchlistModal } from "../forms/AddWatchlistModal";
import { usePortfolioStore } from "../../store/portfolio";
import type { Mover } from "../../types";

function MoverRow({ item, isCrypto }: { item: Mover; isCrypto: boolean }) {
  const watchlist = usePortfolioStore((s) => s.watchlist);
  const pos = (item.change_pct ?? 0) >= 0;
  const label = isCrypto ? (item.symbol ?? item.coin_id ?? "") : (item.ticker ?? "");
  const sym = label.toUpperCase();
  const isWatched = watchlist.some((w) => w.ticker === sym);

  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between py-2.5 border-b border-slate-700/40 last:border-0">
        <div>
          <p className="font-semibold text-white text-sm">{sym}</p>
          {isCrypto && item.name && <p className="text-xs text-slate-500">{item.name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-slate-300">
              {item.price >= 1000 ? `$${item.price.toFixed(0)}` : item.price >= 1 ? `$${item.price.toFixed(2)}` : `$${item.price.toFixed(4)}`}
            </p>
            <p className={`text-sm font-semibold ${pos ? "text-emerald-400" : "text-red-400"}`}>
              {pos ? "▲" : "▼"} {Math.abs(item.change_pct ?? 0).toFixed(2)}%
            </p>
          </div>
          {isWatched ? (
            <span className="text-xs text-slate-500 px-2 py-1 rounded-lg border border-slate-700">👁️</span>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg border border-indigo-800 hover:border-indigo-600 transition-colors"
            >
              + Watch
            </button>
          )}
        </div>
      </div>
      {showModal && (
        <AddWatchlistModal
          onClose={() => setShowModal(false)}
          prefillTicker={sym}
          prefillType={isCrypto ? "crypto" : "stock"}
        />
      )}
    </>
  );
}

function MoverSection({ title, items, isCrypto }: { title: string; items: Mover[]; isCrypto: boolean }) {
  return (
    <div className="bg-[#1a1d27] rounded-2xl border border-slate-700/50 p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : (
        items.map((item, i) => <MoverRow key={i} item={item} isCrypto={isCrypto} />)
      )}
    </div>
  );
}

export function MoversWidget() {
  const [stockGainers, setStockGainers] = useState<Mover[]>([]);
  const [stockLosers, setStockLosers] = useState<Mover[]>([]);
  const [cryptoGainers, setCryptoGainers] = useState<Mover[]>([]);
  const [cryptoLosers, setCryptoLosers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [stocks, crypto] = await Promise.all([fetchStockMovers(), fetchCryptoMovers()]);
        setStockGainers(stocks.gainers);
        setStockLosers(stocks.losers);
        setCryptoGainers(crypto.gainers);
        setCryptoLosers(crypto.losers);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load movers");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-8 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading market data…</div>
      </div>
    );
  }
  if (error) {
    return <div className="px-4 py-6 text-red-400 text-sm text-center">{error}</div>;
  }

  return (
    <div className="px-4 pb-6 space-y-4">
      <h2 className="text-base font-bold text-white pt-2">Top Movers</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MoverSection title="📈 Stock Gainers" items={stockGainers} isCrypto={false} />
        <MoverSection title="📉 Stock Losers" items={stockLosers} isCrypto={false} />
        <MoverSection title="🚀 Crypto Gainers" items={cryptoGainers} isCrypto={true} />
        <MoverSection title="💸 Crypto Losers" items={cryptoLosers} isCrypto={true} />
      </div>
    </div>
  );
}
