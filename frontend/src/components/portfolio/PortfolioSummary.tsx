import { useMemo } from "react";
import { computeHoldingRows, computeTotals, usePortfolioStore } from "../../store/portfolio";

function fmt(n: number, dec = 2) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
}
function fmtSGD(n: number) {
  if (Math.abs(n) >= 1_000_000) return `S$${fmt(n / 1_000_000, 2)}M`;
  if (Math.abs(n) >= 1_000) return `S$${fmt(n / 1_000, 2)}K`;
  return `S$${fmt(n)}`;
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
  negative?: boolean;
}

function Card({ label, value, sub, positive, negative }: CardProps) {
  const valueColor = positive ? "text-emerald-400" : negative ? "text-red-400" : "text-white";
  return (
    <div className="bg-[#1a1d27] rounded-2xl p-4 border border-slate-700/50">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${valueColor} leading-tight`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${positive ? "text-emerald-400" : negative ? "text-red-400" : "text-slate-400"}`}>{sub}</p>}
    </div>
  );
}

export function PortfolioSummary() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const prices = usePortfolioStore((s) => s.prices);
  const usdToSgd = usePortfolioStore((s) => s.usdToSgd);
  const rows = useMemo(() => computeHoldingRows(holdings, prices, usdToSgd), [holdings, prices, usdToSgd]);
  const { totalValue, totalCost, totalPnL, totalPnLPct, dayChange } = useMemo(() => computeTotals(rows), [rows]);

  const pnlPos = totalPnL >= 0;
  const dayPos = dayChange >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
      <Card label="Total Value (SGD)" value={fmtSGD(totalValue)} />
      <Card label="Total Cost (SGD)" value={fmtSGD(totalCost)} />
      <Card
        label="Total P&L"
        value={`${pnlPos ? "+" : ""}${fmtSGD(totalPnL)}`}
        sub={`${pnlPos ? "+" : ""}${fmt(totalPnLPct)}%`}
        positive={pnlPos && totalPnL !== 0}
        negative={!pnlPos}
      />
      <Card
        label="Today"
        value={`${dayPos ? "+" : ""}${fmtSGD(dayChange)}`}
        positive={dayPos && dayChange !== 0}
        negative={!dayPos}
      />
    </div>
  );
}
