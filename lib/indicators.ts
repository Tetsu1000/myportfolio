export type Candle = {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function sma(values: number[], period: number) {
  const out: (number | null)[] = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function bollinger(values: number[], period = 20, k = 2) {
  const mid = sma(values, period);
  const upper: (number | null)[] = Array(values.length).fill(null);
  const lower: (number | null)[] = Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) continue;
    const slice = values.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const v = slice.reduce((s, x) => s + (x - m) ** 2, 0) / period;
    const sd = Math.sqrt(v);
    upper[i] = m + k * sd;
    lower[i] = m - k * sd;
  }
  return { mid, upper, lower };
}

export function rsi(values: number[], period = 14) {
  const out: (number | null)[] = Array(values.length).fill(null);
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;

    if (i <= period) {
      gain += g;
      loss += l;
      if (i === period) {
        const rs = loss === 0 ? 999 : gain / loss;
        out[i] = 100 - 100 / (1 + rs);
      }
      continue;
    }

    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    const rs = loss === 0 ? 999 : gain / loss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

function ema(values: number[], period: number) {
  const out: (number | null)[] = Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i < period - 1) continue;
    if (i === period - 1) {
      const seed = values.slice(0, period).reduce((s, x) => s + x, 0) / period;
      prev = seed;
      out[i] = seed;
      continue;
    }
    prev = prev == null ? v : v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const eFast = ema(values, fast);
  const eSlow = ema(values, slow);
  const line: (number | null)[] = Array(values.length).fill(null);

  for (let i = 0; i < values.length; i++) {
    if (eFast[i] == null || eSlow[i] == null) continue;
    line[i] = (eFast[i] as number) - (eSlow[i] as number);
  }

  const signalLine = ema(line.map((x) => x ?? 0), signal);
  const hist: (number | null)[] = Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    if (line[i] == null || signalLine[i] == null) continue;
    hist[i] = (line[i] as number) - (signalLine[i] as number);
  }
  return { line, signal: signalLine, hist };
}
