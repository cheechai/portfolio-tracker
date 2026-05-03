export function computeSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function computeEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let prev: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) continue;
    if (prev === null) {
      // Seed with SMA of first `period` values
      prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
      result[i] = prev;
    } else {
      prev = closes[i] * k + prev * (1 - k);
      result[i] = prev;
    }
  }
  return result;
}

export interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
}

export function computeMACD(closes: number[]): MACDResult {
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macd: (number | null)[] = closes.map((_, i) => {
    const a = ema12[i];
    const b = ema26[i];
    return a !== null && b !== null ? a - b : null;
  });

  // Signal = EMA9 of MACD values
  const macdValues = macd.filter((v): v is number => v !== null);
  const rawSignal = computeEMA(macdValues, 9);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  let rawIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macd[i] !== null) {
      signal[i] = rawSignal[rawIdx++] ?? null;
    }
  }

  const histogram: (number | null)[] = macd.map((m, i) => {
    const s = signal[i];
    return m !== null && s !== null ? m - s : null;
  });

  return { macd, signal, histogram };
}

export function computeRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi_rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rsi_rs);
  }
  return result;
}

export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

export function computeStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod = 14,
  dPeriod = 3
): StochasticResult {
  const k: (number | null)[] = closes.map((c, i) => {
    if (i < kPeriod - 1) return null;
    const highSlice = highs.slice(i - kPeriod + 1, i + 1);
    const lowSlice = lows.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...highSlice);
    const ll = Math.min(...lowSlice);
    return hh === ll ? 50 : ((c - ll) / (hh - ll)) * 100;
  });

  // %D = SMA(3) of %K
  const d: (number | null)[] = k.map((_, i) => {
    const slice = k.slice(Math.max(0, i - dPeriod + 1), i + 1).filter((v): v is number => v !== null);
    if (slice.length < dPeriod) return null;
    return slice.reduce((a, b) => a + b, 0) / dPeriod;
  });

  return { k, d };
}

export function computeOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const prev = obv[i - 1];
    if (closes[i] > closes[i - 1]) obv.push(prev + volumes[i]);
    else if (closes[i] < closes[i - 1]) obv.push(prev - volumes[i]);
    else obv.push(prev);
  }
  return obv;
}

export interface BollingerBands {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function computeBollingerBands(closes: number[], period = 20, stdMult = 2): BollingerBands {
  const middle = computeSMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    const mid = middle[i];
    if (mid === null || i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const variance = slice.reduce((s, v) => s + (v - mid) ** 2, 0) / period;
      const sd = Math.sqrt(variance);
      upper.push(mid + stdMult * sd);
      lower.push(mid - stdMult * sd);
    }
  }
  return { upper, middle, lower };
}

export function computeATR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const tr: number[] = closes.map((_c, i) => {
    if (i === 0) return highs[0] - lows[0];
    const prevClose = closes[i - 1];
    return Math.max(highs[i] - lows[i], Math.abs(highs[i] - prevClose), Math.abs(lows[i] - prevClose));
  });

  const result: (number | null)[] = new Array(closes.length).fill(null);
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = atr;
  for (let i = period; i < closes.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
    result[i] = atr;
  }
  return result;
}

export interface Signal {
  label: "BUY" | "SELL" | "HOLD";
  score: number;
  maxScore: number;
  reasons: string[];
}

export function computeSignal(
  closes: number[],
  highs: number[],
  lows: number[]
): Signal {
  if (closes.length < 30) return { label: "HOLD", score: 0, maxScore: 6, reasons: ["Not enough data"] };

  const reasons: string[] = [];
  let score = 0;
  const last = closes.length - 1;

  // RSI
  const rsi = computeRSI(closes);
  const lastRSI = rsi[last];
  if (lastRSI !== null) {
    if (lastRSI < 30) { score += 1; reasons.push(`RSI ${lastRSI.toFixed(0)} — oversold`); }
    else if (lastRSI > 70) { score -= 1; reasons.push(`RSI ${lastRSI.toFixed(0)} — overbought`); }
  }

  // MACD crossover
  const { macd, signal: sig } = computeMACD(closes);
  const m = macd[last]; const s = sig[last];
  const mPrev = macd[last - 1]; const sPrev = sig[last - 1];
  if (m !== null && s !== null && mPrev !== null && sPrev !== null) {
    if (m > s && mPrev <= sPrev) { score += 1; reasons.push("MACD bullish crossover"); }
    else if (m < s && mPrev >= sPrev) { score -= 1; reasons.push("MACD bearish crossover"); }
    else if (m > s) { score += 0.5; }
    else { score -= 0.5; }
  }

  // Stochastic
  const { k, d } = computeStochastic(highs, lows, closes);
  const kv = k[last]; const dv = d[last];
  const kPrev = k[last - 1]; const dPrev = d[last - 1];
  if (kv !== null && dv !== null && kPrev !== null && dPrev !== null) {
    if (kv > dv && kPrev <= dPrev && kv < 30) { score += 1; reasons.push("Stochastic: oversold crossover"); }
    else if (kv < dv && kPrev >= dPrev && kv > 70) { score -= 1; reasons.push("Stochastic: overbought crossover"); }
  }

  // Bollinger Bands
  const bb = computeBollingerBands(closes);
  const bbLower = bb.lower[last]; const bbUpper = bb.upper[last];
  const price = closes[last];
  if (bbLower !== null && price < bbLower) { score += 1; reasons.push("Below lower Bollinger Band"); }
  else if (bbUpper !== null && price > bbUpper) { score -= 1; reasons.push("Above upper Bollinger Band"); }

  // Golden/Death cross (SMA50 vs SMA200) — only if enough data
  if (closes.length >= 200) {
    const sma50 = computeSMA(closes, 50);
    const sma200 = computeSMA(closes, 200);
    const s50 = sma50[last]; const s200 = sma200[last];
    const s50Prev = sma50[last - 1]; const s200Prev = sma200[last - 1];
    if (s50 !== null && s200 !== null) {
      if (s50 > s200 && s50Prev !== null && s200Prev !== null && s50Prev <= s200Prev) {
        score += 1; reasons.push("Golden cross (SMA50 > SMA200)");
      } else if (s50 < s200 && s50Prev !== null && s200Prev !== null && s50Prev >= s200Prev) {
        score -= 1; reasons.push("Death cross (SMA50 < SMA200)");
      }
    }
  }

  // OBV trend
  const obvArr = computeOBV(closes, new Array<number>(closes.length).fill(1));
  const obvSlice = obvArr.slice(-5);
  const obvRising = obvSlice[obvSlice.length - 1] > obvSlice[0];
  if (obvRising && closes[last] <= closes[last - 5]) { score += 1; reasons.push("OBV divergence: accumulation"); }

  const totalScore = Math.round(score);
  const label: Signal["label"] = totalScore >= 2 ? "BUY" : totalScore <= -2 ? "SELL" : "HOLD";
  return { label, score: totalScore, maxScore: 6, reasons };
}
