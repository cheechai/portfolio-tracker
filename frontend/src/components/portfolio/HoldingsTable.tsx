import { useMemo } from "react";
import { computeHoldingRows, usePortfolioStore } from "../../store/portfolio";
import type { HoldingRow } from "../../types";

function fmt(n: number, dec = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(n);
}
function fmtSGD(n: number) {
  if (Math.abs(n) >= 1_000_000) return `S$${fmt(n / 1_000_000)}M`;
  if (Math.abs(n) >= 1_000) return `S$${fmt(n / 1_000)}K`;
  return `S$${fmt(n)}`;
}
function fmtPriceSGD(n: number) {
  if (n >= 1000) return `S$${fmt(n, 0)}`;
  if (n >= 1) return `S$${fmt(n, 2)}`;
  return `S$${fmt(n, 4)}`;
}


interface HoldingCardProps {
  row: HoldingRow;
  onClick: () => void;
}

function HoldingCard({ row, onClick }: HoldingCardProps) {
  const pnlPos = row.unrealizedPnL >= 0;
  const dayPos = row.changePct >= 0;
  return (
    <button
      onClick={onClick}
      className="w-full bg-[#1a1d27] hover:bg-[#21253a] border border-slate-700/50 rounded-2xl p-4 text-left transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{row.ticker}</span>
            <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-0.5 rounded-full">
              {row.type}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {fmt(row.totalShares, row.totalShares < 1 ? 6 : 4)} @{" "}
            {fmtPriceSGD(row.avgCostBasis)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-white">{fmtSGD(row.currentValue)}</p>
          <p
            className={`text-xs ${
              pnlPos ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {pnlPos ? "+" : ""}
            {fmtSGD(row.unrealizedPnL)} ({pnlPos ? "+" : ""}
            {fmt(row.unrealizedPnLPct)}%)
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-slate-400">
          Price:{" "}
          <span className="text-white">{fmtPriceSGD(row.currentPrice)}</span>
        </div>
        <div
          className={`text-xs font-medium ${
            dayPos ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {dayPos ? "▲" : "▼"} {Math.abs(row.changePct).toFixed(2)}%
          <span className="ml-1 opacity-80">
            ({dayPos ? "+" : ""}
            {fmtSGD((row.currentValue * row.changePct) / 100)})
          </span>
        </div>
      </div>
    </button>
  );
}

export function HoldingsTable({ onAddClick }: { onAddClick: () => void }) {
  const holdings = usePortfolioStore((s) => s.holdings);
  const prices = usePortfolioStore((s) => s.prices);
  const usdToSgd = usePortfolioStore((s) => s.usdToSgd);
  const setSelectedTicker = usePortfolioStore((s) => s.setSelectedTicker);
  const rows = useMemo(
    () => computeHoldingRows(holdings, prices, usdToSgd),
    [holdings, prices, usdToSgd]
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-lg font-semibold text-white mb-2">
          No holdings yet
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          Add your first stock or crypto to start tracking
        </p>
        <button
          onClick={onAddClick}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          + Add Holding
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {rows.map((row) => (
        <HoldingCard
          key={row.ticker}
          row={row}
          onClick={() => setSelectedTicker(row.ticker)}
        />
      ))}
    </div>
  );
}
