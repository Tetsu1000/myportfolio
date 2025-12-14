"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "@/lib/indicators";
import { sma, bollinger, rsi, macd } from "@/lib/indicators";
import { fetchDailyCandles } from "@/lib/marketdata";

function toTs(dateStr: string): UTCTimestamp {
  // YYYY-MM-DD を UTC timestamp に
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = Date.UTC(y, (m ?? 1) - 1, d ?? 1) / 1000;
  return t as UTCTimestamp;
}

export default function StockChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rsiRef = useRef<HTMLDivElement | null>(null);
  const macdRef = useRef<HTMLDivElement | null>(null);

  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        const data = await fetchDailyCandles(ticker);
        if (!mounted) return;
        setCandles(data);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message ?? String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ticker]);

  const closeArr = useMemo(() => candles.map((c) => c.close), [candles]);

  const ma20 = useMemo(() => sma(closeArr, 20), [closeArr]);
  const ma50 = useMemo(() => sma(closeArr, 50), [closeArr]);
  const bb = useMemo(() => bollinger(closeArr, 20, 2), [closeArr]);
  const rsi14 = useMemo(() => rsi(closeArr, 14), [closeArr]);
  const m = useMemo(() => macd(closeArr, 12, 26, 9), [closeArr]);

  // メイン（ロウソク足 + 出来高 + MA + BB）
  useEffect(() => {
    if (!containerRef.current) return;
    if (candles.length < 30) return;

    const el = containerRef.current;
    el.innerHTML = "";

    const chart = createChart(el, {
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "#0f172a",
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const candleSeries = chart.addCandlestickSeries();
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    const ma20Series = chart.addLineSeries({ lineWidth: 2 });
    const ma50Series = chart.addLineSeries({ lineWidth: 2 });
    const bbU = chart.addLineSeries({ lineWidth: 1 });
    const bbM = chart.addLineSeries({ lineWidth: 1 });
    const bbL = chart.addLineSeries({ lineWidth: 1 });

    const cData = candles.map((c) => ({
      time: toTs(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const vData = candles.map((c) => ({
      time: toTs(c.time),
      value: c.volume,
    }));

    candleSeries.setData(cData);
    volumeSeries.setData(vData);

    ma20Series.setData(
      candles
        .map((c, i) => (ma20[i] == null ? null : { time: toTs(c.time), value: ma20[i] as number }))
        .filter(Boolean) as any
    );
    ma50Series.setData(
      candles
        .map((c, i) => (ma50[i] == null ? null : { time: toTs(c.time), value: ma50[i] as number }))
        .filter(Boolean) as any
    );

    bbU.setData(
      candles
        .map((c, i) => (bb.upper[i] == null ? null : { time: toTs(c.time), value: bb.upper[i] as number }))
        .filter(Boolean) as any
    );
    bbM.setData(
      candles
        .map((c, i) => (bb.mid[i] == null ? null : { time: toTs(c.time), value: bb.mid[i] as number }))
        .filter(Boolean) as any
    );
    bbL.setData(
      candles
        .map((c, i) => (bb.lower[i] == null ? null : { time: toTs(c.time), value: bb.lower[i] as number }))
        .filter(Boolean) as any
    );

    chart.timeScale().fitContent();

    const onResize = () => {
      chart.applyOptions({ width: el.clientWidth });
    };
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [candles, ma20, ma50, bb]);

  // RSIチャート
  useEffect(() => {
    if (!rsiRef.current) return;
    if (candles.length < 30) return;

    const el = rsiRef.current;
    el.innerHTML = "";

    const chart = createChart(el, {
      height: 160,
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "#0f172a",
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });

    const s = chart.addLineSeries({ lineWidth: 2 });
    s.setData(
      candles
        .map((c, i) =>
          rsi14[i] == null ? null : { time: toTs(c.time), value: rsi14[i] as number }
        )
        .filter(Boolean) as any
    );

    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: el.clientWidth });
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [candles, rsi14]);

  // MACDチャート（line & signal & hist）
  useEffect(() => {
    if (!macdRef.current) return;
    if (candles.length < 60) return;

    const el = macdRef.current;
    el.innerHTML = "";

    const chart = createChart(el, {
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "#0f172a",
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    });

    const hist = chart.addHistogramSeries({ priceScaleId: "" });
    const line = chart.addLineSeries({ lineWidth: 2 });
    const sig = chart.addLineSeries({ lineWidth: 2 });

    hist.setData(
      candles
        .map((c, i) =>
          m.hist[i] == null ? null : { time: toTs(c.time), value: m.hist[i] as number }
        )
        .filter(Boolean) as any
    );
    line.setData(
      candles
        .map((c, i) =>
          m.line[i] == null ? null : { time: toTs(c.time), value: m.line[i] as number }
        )
        .filter(Boolean) as any
    );
    sig.setData(
      candles
        .map((c, i) =>
          m.signal[i] == null ? null : { time: toTs(c.time), value: m.signal[i] as number }
        )
        .filter(Boolean) as any
    );

    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: el.clientWidth });
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

      {err ? (
        <div className="muted" style={{ marginTop: 10 }}>
          データ取得エラー: {err}
        </div>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <div ref={containerRef} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>RSI(14)</div>
        <div ref={rsiRef} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>MACD(12,26,9)</div>
        <div ref={macdRef} />
      </div>

      <div className="muted" style={{ marginTop: 8 }}>
        ※ 現在はダミー日足データで表示中（後で本物のデータソースに差し替えます）
      </div>
    </div>
  );
}
