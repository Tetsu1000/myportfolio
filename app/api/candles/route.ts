import { NextResponse } from "next/server";

function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ダミーのランダムウォーク日足（約1年分）
function generateDummy() {
  const out: any[] = [];
  const today = new Date();
  let price = 1000 + Math.random() * 2000;

  for (let i = 260; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    const drift = (Math.random() - 0.5) * 30;
    const open = price;
    const close = Math.max(10, open + drift);
    const high = Math.max(open, close) + Math.random() * 20;
    const low = Math.min(open, close) - Math.random() * 20;
    const vol = Math.floor(100000 + Math.random() * 400000);

    out.push({
      time: iso(d),
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
      volume: vol,
    });

    price = close;
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker") ?? "UNKNOWN";

  // まずはダミーで返す（後で ticker で本物を返すように差し替え）
  const candles = generateDummy();

  return NextResponse.json(candles, {
    headers: { "x-note": `dummy candles for ${ticker}` },
  });
}
