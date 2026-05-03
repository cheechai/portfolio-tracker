import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { computeBollingerBands, computeEMA, computeSMA } from "../../utils/indicators";
import type { OHLCVBar } from "../../types";

type Overlay = "sma20" | "sma50" | "ema50" | "bb";
const PERIODS = ["1d", "1wk", "1mo", "3mo", "1y"] as const;
type Period = (typeof PERIODS)[number];

function fmtDate(d: string, period: Period) {
  const dt = new Date(d);
  if (period === "1d") return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Props {
  bars: OHLCVBar[];
  period: Period;
  onPeriodChange: (p: Period) => void;
}

export function PriceChart({ bars, period, onPeriodChange }: Props) {
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(["sma20"]));

  function toggleOverlay(o: Overlay) {
    setOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });
  }

  const closes = useMemo(() => bars.map((b) => b.close), [bars]);

  const sma20 = useMemo(() => computeSMA(closes, 20), [closes]);
  const sma50 = useMemo(() => computeSMA(closes, 50), [closes]);
  const ema50 = useMemo(() => computeEMA(closes, 50), [closes]);
  const bb = useMemo(() => computeBollingerBands(closes), [closes]);

  const data = bars.map((bar, i) => ({
    date: bar.date,
    close: bar.close,
    volume: bar.volume,
    sma20: overlays.has("sma20") ? sma20[i] : undefined,
    sma50: overlays.has("sma50") ? sma50[i] : undefined,
    ema50: overlays.has("ema50") ? ema50[i] : undefined,
    bbUpper: overlays.has("bb") ? bb.upper[i] : undefined,
    bbLower: overlays.has("bb") ? bb.lower[i] : undefined,
    bbMid: overlays.has("bb") ? bb.middle[i] : undefined,
  }));

  const minClose = Math.min(...closes) * 0.98;
  const maxClose = Math.max(...closes) * 1.02;
  const isUp = closes.length > 1 && closes[closes.length - 1] >= closes[0];

  const yTickFormatter = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    if (v >= 1) return v.toFixed(2);
    return v.toFixed(4);
  };

  return (
    <div>
      {/* Period selector */}
      <div className="flex items-center gap-1 mb-3">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${period === p ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main price chart */}
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.2} />
              <stop offset="95%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, period)} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis domain={[minClose, maxClose]} tickFormatter={yTickFormatter} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            contentStyle={{ background: "#1a1d27", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }}
            labelFormatter={(l) => {
              const dt = new Date(l);
              return period === "1d"
                ? dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            }}
            formatter={(v: unknown, name: unknown) => { const n = v as number; return [`$${n.toFixed(n >= 1000 ? 0 : 2)}`, String(name)]; }}
          />
          <Area type="monotone" dataKey="close" stroke={isUp ? "#10b981" : "#ef4444"} strokeWidth={2} fill="url(#priceGrad)" dot={false} name="Price" connectNulls />
          {overlays.has("sma20") && <Line type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="SMA20" connectNulls />}
          {overlays.has("sma50") && <Line type="monotone" dataKey="sma50" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="SMA50" connectNulls />}
          {overlays.has("ema50") && <Line type="monotone" dataKey="ema50" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="EMA50" connectNulls />}
          {overlays.has("bb") && <Line type="monotone" dataKey="bbUpper" stroke="#64748b" strokeWidth={1} strokeDasharray="4 2" dot={false} name="BB Upper" connectNulls />}
          {overlays.has("bb") && <Line type="monotone" dataKey="bbLower" stroke="#64748b" strokeWidth={1} strokeDasharray="4 2" dot={false} name="BB Lower" connectNulls />}
          {overlays.has("bb") && <Line type="monotone" dataKey="bbMid" stroke="#64748b" strokeWidth={1} strokeDasharray="2 4" dot={false} name="BB Mid" connectNulls />}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume chart */}
      <ResponsiveContainer width="100%" height={50}>
        <ComposedChart data={data} margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
          <Bar dataKey="volume" fill="#334155" opacity={0.6} name="Volume" />
          <YAxis hide />
          <XAxis hide dataKey="date" />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Overlay toggles */}
      <div className="flex flex-wrap gap-2 mt-3">
        {([["sma20", "SMA20", "#f59e0b"], ["sma50", "SMA50", "#8b5cf6"], ["ema50", "EMA50", "#06b6d4"], ["bb", "Bollinger", "#64748b"]] as [Overlay, string, string][]).map(([key, label, color]) => (
          <button
            key={key}
            onClick={() => toggleOverlay(key)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${overlays.has(key) ? "border-transparent text-white" : "border-slate-700 text-slate-400 hover:text-white"}`}
            style={overlays.has(key) ? { background: color + "33", borderColor: color, color } : {}}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
