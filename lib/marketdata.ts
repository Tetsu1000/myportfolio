import type { Candle } from "./indicators";

export async function fetchDailyCandles(ticker: string): Promise<Candle[]> {
  const res = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`candles api failed: ${res.status}`);
  return (await res.json()) as Candle[];
}
