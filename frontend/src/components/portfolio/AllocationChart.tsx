import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { computeHoldingRows, usePortfolioStore } from "../../store/portfolio";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#14b8a6"];

function fmtSGD(n: number) {
  if (n >= 1_000_000) return `S$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `S$${(n / 1_000).toFixed(2)}K`;
  return `S$${n.toFixed(2)}`;
}

export function AllocationChart() {
  const holdings = usePortfolioStore((s) => s.holdings);
  const prices = usePortfolioStore((s) => s.prices);
  const usdToSgd = usePortfolioStore((s) => s.usdToSgd);
  const rows = useMemo(() => computeHoldingRows(holdings, prices, usdToSgd), [holdings, prices, usdToSgd]);
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + r.currentValue, 0);
  const data = rows.map((r, i) => ({
    name: r.ticker,
    value: r.currentValue,
    pct: (r.currentValue / total) * 100,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div className="px-4 pb-6">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Allocation</h3>
      <div className="bg-[#1a1d27] rounded-2xl border border-slate-700/50 p-4">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={180} className="max-w-[180px] shrink-0">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: unknown) => [fmtSGD(v as number), "Value (SGD)"]}
                contentStyle={{ background: "#1a1d27", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2 w-full">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-slate-300">{d.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-xs">{fmtSGD(d.value)}</span>
                  <span className="text-white font-medium w-12 text-right">{d.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
