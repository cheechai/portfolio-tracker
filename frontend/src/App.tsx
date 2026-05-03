import { useEffect, useRef, useState } from "react";
import { fetchCryptoPrice } from "./api/crypto";
import { fetchStockPrice, fetchUsdToSgd, loadPortfolio, savePortfolio, syncHoldings } from "./api/stocks";
import { LoginScreen } from "./components/LoginScreen";
import { AddHoldingModal } from "./components/forms/AddHoldingModal";
import { AddWatchlistModal } from "./components/forms/AddWatchlistModal";
import { MoversWidget } from "./components/market/MoversWidget";
import { AllocationChart } from "./components/portfolio/AllocationChart";
import { HoldingsTable } from "./components/portfolio/HoldingsTable";
import { PortfolioSummary } from "./components/portfolio/PortfolioSummary";
import { TickerDrawer } from "./components/ticker/TickerDrawer";
import { WatchlistTable } from "./components/watchlist/WatchlistTable";
import { useAuthStore } from "./store/auth";
import { COINGECKO_IDS, usePortfolioStore } from "./store/portfolio";

import type { Tab } from "./types";

function BottomTabBar({
  tab,
  setTab,
  onAdd,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  onAdd: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-[#0f1117]/95 backdrop-blur border-t border-slate-700/50 md:hidden">
      <div className="flex items-center px-2 pb-safe">
        <button
          onClick={() => setTab("portfolio")}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
            tab === "portfolio" ? "text-indigo-400" : "text-slate-500"
          }`}
        >
          <span className="text-xl">📊</span>
          <span className="text-xs font-medium">Portfolio</span>
        </button>
        <button
          onClick={() => setTab("watchlist")}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
            tab === "watchlist" ? "text-indigo-400" : "text-slate-500"
          }`}
        >
          <span className="text-xl">👁️</span>
          <span className="text-xs font-medium">Watchlist</span>
        </button>
        <button
          onClick={onAdd}
          className="flex flex-col items-center py-2 px-3"
        >
          <span className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl font-light shadow-lg transition-colors">
            +
          </span>
        </button>
        <button
          onClick={() => setTab("market")}
          className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
            tab === "market" ? "text-indigo-400" : "text-slate-500"
          }`}
        >
          <span className="text-xl">🌍</span>
          <span className="text-xs font-medium">Market</span>
        </button>
      </div>
    </div>
  );
}

function TopNav({
  tab,
  setTab,
  onAdd,
  onLogout,
  usdToSgd,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  onAdd: () => void;
  onLogout: () => void;
  usdToSgd: number;
}) {
  return (
    <div className="hidden md:flex sticky top-0 z-20 bg-[#0f1117]/95 backdrop-blur border-b border-slate-700/50 items-center justify-between px-6 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📈</span>
        <span className="font-bold text-white text-lg">Portfolio Tracker</span>
        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
          USD/SGD {usdToSgd.toFixed(4)}
        </span>
      </div>
      <nav className="flex items-center gap-1">
        {(["portfolio", "watchlist", "market"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <button
          onClick={onAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Add
        </button>
        <button
          onClick={onLogout}
          className="text-slate-500 hover:text-white text-sm px-3 py-2 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const clearToken = useAuthStore((s) => s.clearToken);
  const holdings = usePortfolioStore((s) => s.holdings);
  const watchlist = usePortfolioStore((s) => s.watchlist);
  const setPrices = usePortfolioStore((s) => s.setPrices);
  const setUsdToSgd = usePortfolioStore((s) => s.setUsdToSgd);
  const setPortfolio = usePortfolioStore((s) => s.setPortfolio);
  const prices = usePortfolioStore((s) => s.prices);

  const [tab, setTab] = useState<Tab>("portfolio");
  const [showAdd, setShowAdd] = useState(false);
  const [showWatchlistAdd, setShowWatchlistAdd] = useState(false);
  // Gates the save effect so we don't overwrite DB with stale localStorage on first mount
  const dbLoaded = useRef(false);

  // Load portfolio from DB on login — DB is always source of truth
  useEffect(() => {
    if (!token) return;
    dbLoaded.current = false;
    loadPortfolio()
      .then((data) => {
        setPortfolio(data.holdings as never, data.watchlist as never);
      })
      .catch(() => {})
      .finally(() => { dbLoaded.current = true; });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch FX rate once on login
  useEffect(() => {
    if (!token) return;
    fetchUsdToSgd()
      .then(setUsdToSgd)
      .catch(() => {});
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || (holdings.length === 0 && watchlist.length === 0)) return;

    async function refreshPrices() {
      const updates: typeof prices = { ...prices };
      await Promise.allSettled([
        ...holdings.map(async (h) => {
          try {
            if (h.type === "stock") {
              const data = await fetchStockPrice(h.ticker);
              updates[h.ticker] = data;
            } else {
              const id =
                h.coinId ?? COINGECKO_IDS[h.ticker] ?? h.ticker.toLowerCase();
              const data = await fetchCryptoPrice(h.ticker, id);
              updates[id] = data;
            }
          } catch {
            // skip failed fetches silently
          }
        }),
        ...watchlist.map(async (w) => {
          try {
            if (w.type === "stock") {
              const data = await fetchStockPrice(w.ticker);
              updates[w.ticker] = data;
            } else {
              const id =
                w.coinId ?? COINGECKO_IDS[w.ticker] ?? w.ticker.toLowerCase();
              const data = await fetchCryptoPrice(w.ticker, id);
              updates[id] = data;
            }
          } catch {
            // skip failed fetches silently
          }
        }),
      ]);
      setPrices(updates);
    }

    refreshPrices();
    const interval = setInterval(refreshPrices, 15_000);
    return () => clearInterval(interval);
  }, [token, holdings.length, watchlist.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const usdToSgd = usePortfolioStore((s) => s.usdToSgd);

  // Save to DB only after initial DB load — prevents stale localStorage overwriting DB on mount
  useEffect(() => {
    if (!token || !dbLoaded.current) return;
    savePortfolio(holdings, watchlist).catch(() => {});
    if (holdings.length > 0) syncHoldings(holdings, usdToSgd).catch(() => {});
  }, [token, holdings, watchlist]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <LoginScreen />;

  function handleAdd() {
    if (tab === "watchlist") setShowWatchlistAdd(true);
    else setShowAdd(true);
  }

  return (
    <div className="min-h-screen bg-[#0f1117]">
      <TopNav
        tab={tab}
        setTab={setTab}
        onAdd={handleAdd}
        onLogout={clearToken}
        usdToSgd={usdToSgd}
      />

      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">📈</span>
          <span className="font-bold text-white">Portfolio Tracker</span>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
            USD/SGD {usdToSgd.toFixed(4)}
          </span>
        </div>
        <button onClick={clearToken} className="text-slate-500 text-sm">
          Sign out
        </button>
      </div>

      <div className="md:flex md:h-[calc(100svh-57px)]">
        <div className="flex-1 md:overflow-y-auto pb-24 md:pb-0">
          {tab === "portfolio" && (
            <>
              <PortfolioSummary />
              <HoldingsTable onAddClick={() => setShowAdd(true)} />
              <AllocationChart />
            </>
          )}
          {tab === "watchlist" && (
            <WatchlistTable onAddClick={() => setShowWatchlistAdd(true)} />
          )}
          {tab === "market" && <MoversWidget />}
        </div>
      </div>

      <BottomTabBar tab={tab} setTab={setTab} onAdd={handleAdd} />
      <TickerDrawer />
      {showAdd && <AddHoldingModal onClose={() => setShowAdd(false)} />}
      {showWatchlistAdd && (
        <AddWatchlistModal onClose={() => setShowWatchlistAdd(false)} />
      )}
    </div>
  );
}
