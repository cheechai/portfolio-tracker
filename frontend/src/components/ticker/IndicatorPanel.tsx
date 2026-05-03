import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeATR,
  computeMACD,
  computeOBV,
  computeRSI,
  computeSignal,
  computeStochastic,
  type Signal,
} from "../../utils/indicators";
import type { OHLCVBar } from "../../types";

type IndicatorTab = "rsi" | "macd" | "stoch" | "obv" | "atr";

function SignalBadge({ signal }: { signal: Signal }) {
  const bg =
    signal.label === "BUY" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
    : signal.label === "SELL" ? "bg-red-500/20 border-red-500/40 text-red-400"
    : "bg-slate-500/20 border-slate-500/40 text-slate-300";
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs opacity-70 mb-0.5">Signal</p>
          <p className="text-2xl font-black">{signal.label}</p>
          <p className="text-xs opacity-70 mt-0.5">Score: {signal.score > 0 ? "+" : ""}{signal.score} / {signal.maxScore}</p>
        </div>
        <div className="flex-1">
          <p className="text-xs opacity-70 mb-1">Key signals</p>
          <ul className="space-y-0.5">
            {signal.reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs opacity-80">• {r}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs opacity-50 mt-2">Educational only — not financial advice.</p>
    </div>
  );
}

const TABS: { id: IndicatorTab; label: string }[] = [
  { id: "rsi", label: "RSI" },
  { id: "macd", label: "MACD" },
  { id: "stoch", label: "Stoch" },
  { id: "obv", label: "OBV" },
  { id: "atr", label: "ATR" },
];

interface Props {
  bars: OHLCVBar[];
}

export function IndicatorPanel({ bars }: Props) {
  const [tab, setTab] = useState<IndicatorTab>("rsi");

  const closes = useMemo(() => bars.map((b) => b.close), [bars]);
  const highs = useMemo(() => bars.map((b) => b.high), [bars]);
  const lows = useMemo(() => bars.map((b) => b.low), [bars]);
  const volumes = useMemo(() => bars.map((b) => b.volume), [bars]);

  const signal = useMemo(() => computeSignal(closes, highs, lows), [closes, highs, lows]);

  const rsi = useMemo(() => computeRSI(closes), [closes]);
  const macdData = useMemo(() => computeMACD(closes), [closes]);
  const stochData = useMemo(() => computeStochastic(highs, lows, closes), [highs, lows, closes]);
  const obv = useMemo(() => computeOBV(closes, volumes), [closes, volumes]);
  const atr = useMemo(() => computeATR(highs, lows, closes), [highs, lows, closes]);

  const chartData = bars.map((b, i) => ({
    date: b.date,
    rsi: rsi[i],
    macd: macdData.macd[i],
    signal: macdData.signal[i],
    histogram: macdData.histogram[i],
    k: stochData.k[i],
    d: stochData.d[i],
    obv: obv[i],
    atr: atr[i],
  }));

  const tooltipStyle = { background: "#1a1d27", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", fontSize: 11 };

  return (
    <div className="space-y-4">
      <SignalBadge signal={signal} />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1117] rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "rsi" && (
        <div>
          <p className="text-xs text-slate-400 mb-2">RSI (14) — below 30 oversold, above 70 overbought</p>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [(v as number)?.toFixed(1), "RSI"]} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
              <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
              <ReferenceLine y={50} stroke="#334155" strokeWidth={1} />
              <Line type="monotone" dataKey="rsi" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
          {rsi[rsi.length - 1] !== null && (
            <p className="text-xs text-slate-400 mt-1">
              Current: <span className={rsi[rsi.length - 1]! < 30 ? "text-emerald-400" : rsi[rsi.length - 1]! > 70 ? "text-red-400" : "text-white"}>{rsi[rsi.length - 1]!.toFixed(1)}</span>
            </p>
          )}
        </div>
      )}

      {tab === "macd" && (
        <div>
          <p className="text-xs text-slate-400 mb-2">MACD — bullish when MACD crosses above signal</p>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: unknown) => [(v as number)?.toFixed(4), String(name)]} />
              <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
              <Bar dataKey="histogram" fill="#6366f1" opacity={0.6} name="Histogram" />
              <Line type="monotone" dataKey="macd" stroke="#10b981" strokeWidth={1.5} dot={false} name="MACD" connectNulls />
              <Line type="monotone" dataKey="signal" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Signal" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === "stoch" && (
        <div>
          <p className="text-xs text-slate-400 mb-2">Stochastic — %K crosses above %D from &lt;20 is bullish</p>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis domain={[0, 100]} ticks={[0, 20, 50, 80, 100]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, name: unknown) => [(v as number)?.toFixed(1), String(name)]} />
              <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
              <ReferenceLine y={20} stroke="#10b981" strokeDasharray="4 2" strokeWidth={1} />
              <Line type="monotone" dataKey="k" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="%K" connectNulls />
              <Line type="monotone" dataKey="d" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="%D" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === "obv" && (
        <div>
          <p className="text-xs text-slate-400 mb-2">OBV — rising OBV confirms buying pressure</p>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : String(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [(v as number)?.toLocaleString(), "OBV"]} />
              <Area type="monotone" dataKey="obv" stroke="#8b5cf6" fill="#8b5cf620" strokeWidth={1.5} name="OBV" dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === "atr" && (
        <div>
          <p className="text-xs text-slate-400 mb-2">ATR (14) — rising ATR = expanding volatility</p>
          <ResponsiveContainer width="100%" height={130}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(2)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`$${(v as number)?.toFixed(2)}`, "ATR"]} />
              <Line type="monotone" dataKey="atr" stroke="#ec4899" strokeWidth={1.5} dot={false} name="ATR" connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
