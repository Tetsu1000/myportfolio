"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";

type Candle = {
  time: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export default function StockChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [err, setErr] = useState("");

  // 日足データ取得（/api/candles を叩く）
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        const res = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`candles API error: ${res.status}`);
        const data = (await res.json()) as Candle[];
        if (mounted) setCandles(data);
      } catch (e: any) {
        if (mounted) setErr(e?.message ?? String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ticker]);

  // チャート描画
  useEffect(() => {
    if (!containerRef.current) return;
    if (candles.length < 5) return;

    const el = containerRef.current;
    el.innerHTML = "";

    const chart: any = createChart(el, {
      width: el.clientWidth || 900,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "white" },
        textColor: "#0f172a",
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    // ✅ v5: addSeries を使う（これが正解）
    const candleSeries: any = chart.addSeries(CandlestickSeries, {});
    const volumeSeries: any = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.75, bottom: 0 },
    });

    candleSeries.setData(
      candles.map((c) => ({
        time: c.time, // 文字列でOK
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
      }))
    );

    chart.timeScale().fitContent();

    const onResize = () => chart.applyOptions({ width: el.clientWidth || 900 });
    window.addEventListener("resize", onResize);
    onResize();

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
    };
  }, [candles]);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 800, fontSize: 18 }}>チャート（日足）</div>
        <div className="muted">ticker: {ticker}</div>
      </div>

      <div className="muted" style={{ marginTop: 6 }}>
        candles: {candles.length}件
      </div>

      {err ? (
        <div className="muted" style={{ marginTop: 10 }}>
          データ取得エラー: {err}
        </div>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <div ref={containerRef} style={{ minHeight: 420 }} />
      </div>
    </div>
  );
}
