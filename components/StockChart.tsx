"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";

type Candle = {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ===== 指標計算（依存を減らすためこのファイル内に同梱） =====
function sma(values: number[], period: number) {
  const out: (number | null)[] = Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function std(values: number[], period: number, ma: (number | null)[]) {
  const out: (number | null)[] = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const m = ma[i];
    if (m == null) continue;
    let v = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - m;
      v += d * d;
    }
    out[i] = Math.sqrt(v / period);
  }
  return out;
}

function bollinger(values: number[], period = 20, k = 2) {
  const mid = sma(values, period);
  const sd = std(values, period, mid);
  const upper = mid.map((m, i) => (m == null || sd[i] == null ? null : m + k * (sd[i] as number)));
  const lower = mid.map((m, i) => (m == null || sd[i] == null ? null : m - k * (sd[i] as number)));
  return { upper, mid, lower };
}

// Wilder's RSI
function rsi(values: number[], period = 14) {
  const out: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period + 1) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
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
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out[i] = seed;
      continue;
    }
    prev = prev == null ? v : v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast);
  const es = ema(values, slow);
  const line: (number | null)[] = values.map((_, i) =>
    ef[i] == null || es[i] == null ? null : (ef[i] as number) - (es[i] as number)
  );
  const lineNum = line.map((x) => (x == null ? 0 : x));
  const sig = ema(lineNum, signal);
  const hist: (number | null)[] = line.map((m, i) =>
    m == null || sig[i] == null ? null : (m as number) - (sig[i] as number)
  );
  return { line, signal: sig, hist };
}

// ===== コンポーネント =====
export default function StockChart({ ticker }: { ticker: string }) {
  const mainRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        const res = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `candles api error: ${res.status}`);
        if (mounted) setCandles(data as Candle[]);
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? String(e));
      }
    })();
    return () => { mounted = false; };
  }, [ticker]);

  const closes = useMemo(() => candles.map((c) => c.close), [candles]);
  const bb = useMemo(() => bollinger(closes, 20, 2), [closes]);
  const r = useMemo(() => rsi(closes, 14), [closes]);
  const m = useMemo(() => macd(closes, 12, 26, 9), [closes]);

  // Main: Candle + Volume + BB
  useEffect(() => {
    if (!mainRef.current) return;
    if (candles.length < 30) return;

    const el = mainRef.current;
    el.innerHTML = "";

    const chart: any = createChart(el, {
      width: el.clientWidth || 980,
      height: 420,
      layout: { background: { type: ColorType.Solid, color: "white" }, textColor: "#0f172a" },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });

    const candleSeries: any = chart.addSeries(CandlestickSeries, {});
    const volumeSeries: any = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    const bbU: any = chart.addSeries(LineSeries, { lineWidth: 1 });
    const bbM: any = chart.addSeries(LineSeries, { lineWidth: 1 });
    const bbL: any = chart.addSeries(LineSeries, { lineWidth: 1 });

    candleSeries.setData(candles.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
    volumeSeries.setData(candles.map((c) => ({ time: c.time, value: c.volume })));

    bbU.setData(candles.map((c, i) => (bb.upper[i] == null ? null : { time: c.time, value: bb.upper[i] as number })).filter(Boolean));
    bbM.setData(candles.map((c, i) => (bb.mid[i] == null ? null : { time: c.time, value: bb.mid[i] as number })).filter(Boolean));
    bbL.setData(candles.map((c, i) => (bb.lower[i] == null ? null : { time: c.time, value: bb.lower[i] as number })).filter(Boolean));

    chart.timeScale().fitContent();

    const onResize = () => chart.applyOptions({ width: el.clientWidth || 980 });
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [candles, bb]);

  // RSI
  useEffect(() => {
    if (!rsiRef.current) return;
    if (candles.length < 30) return;

    const el = rsiRef.current;
    el.innerHTML = "";

    const chart: any = createChart(el, {
      width: el.clientWidth || 980,
      height: 160,
      layout: { background: { type: ColorType.Solid, color: "white" }, textColor: "#0f172a" },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });

    const s: any = chart.addSeries(LineSeries, { lineWidth: 2 });
    s.setData(candles.map((c, i) => (r[i] == null ? null : { time: c.time, value: r[i] as number })).filter(Boolean));

    // 30/70ライン
    if (typeof s.createPriceLine === "function") {
      s.createPriceLine({ price: 70 });
      s.createPriceLine({ price: 30 });
    }

    chart.timeScale().fitContent();

    const onResize = () => chart.applyOptions({ width: el.clientWidth || 980 });
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [candles, r]);

  // MACD
  useEffect(() => {
    if (!macdRef.current) return;
    if (candles.length < 60) return;

    const el = macdRef.current;
    el.innerHTML = "";

    const chart: any = createChart(el, {
      width: el.clientWidth || 980,
      height: 200,
      layout: { background: { type: ColorType.Solid, color: "white" }, textColor: "#0f172a" },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });

    const hist: any = chart.addSeries(HistogramSeries, { priceScaleId: "" });
    const line: any = chart.addSeries(LineSeries, { lineWidth: 2 });
    const sig: any = chart.addSeries(LineSeries, { lineWidth: 2 });

    hist.setData(candles.map((c, i) => (m.hist[i] == null ? null : { time: c.time, value: m.hist[i] as number })).filter(Boolean));
    line.setData(candles.map((c, i) => (m.line[i] == null ? null : { time: c.time, value: m.line[i] as number })).filter(Boolean));
    sig.setData(candles.map((c, i) => (m.signal[i] == null ? null : { time: c.time, value: m.signal[i] as number })).filter(Boolean));

    chart.timeScale().fitContent();

    const onResize = () => chart.applyOptions({ width: el.clientWidth || 980 });
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [candles, m]);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>チャート（日足）</div>
        <div className="muted">ticker: {ticker}</div>
      </div>

      <div className="muted" style={{ marginTop: 6 }}>candles: {candles.length}件</div>
      {err ? <div className="muted" style={{ marginTop: 10 }}>エラー: {err}</div> : null}

      <div style={{ marginTop: 10 }}><div ref={mainRef} style={{ minHeight: 420 }} /></div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>RSI(14)</div>
        <div ref={rsiRef} style={{ minHeight: 160 }} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>MACD(12,26,9)</div>
        <div ref={macdRef} style={{ minHeight: 200 }} />
      </div>
    </div>
  );
}
