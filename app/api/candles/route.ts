import { NextResponse } from "next/server";

type Candle = {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

function toStooqSymbol(ticker: string) {
  // 例: 7203.T -> 7203.jp
  const t = ticker.trim();
  if (t.endsWith(".T")) return t.replace(/\.T$/, ".jp").toLowerCase();
  return t.toLowerCase();
}

function parseCSV(csv: string): Candle[] {
  const lines = csv.trim().split(/\r?\n/);
  // Date,Open,High,Low,Close,Volume
  const out: Candle[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 6) continue;
    const [date, o, h, l, c, v] = cols;
    const open = Number(o), high = Number(h), low = Number(l), close = Number(c), volume = Number(v);
    if (!date || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) continue;
    out.push({ time: date, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 });
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ticker = url.searchParams.get("ticker") ?? "";
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  const sym = toStooqSymbol(ticker);
  const stooq = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&i=d`;

  const res = await fetch(stooq, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: `stooq fetch failed: ${res.status}` }, { status: 502 });
  }
  const csv = await res.text();
  const data = parseCSV(csv);

  // データが取れない場合は分かりやすく返す
  if (!data.length) {
    return NextResponse.json({ error: "no candles returned (check ticker mapping)" }, { status: 404 });
  }

  return NextResponse.json(data);
}
