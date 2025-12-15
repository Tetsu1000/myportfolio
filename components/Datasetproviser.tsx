import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type AnyRow = Record<string, any>;

const cache = new Map<string, Promise<AnyRow[]>>();

async function loadDatasetFromUrl(url: string): Promise<AnyRow[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`dataset fetch failed: ${res.status}`);

  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<AnyRow>(sheet, { defval: null });

  return json;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // 既存の設計（?data=...）に合わせて URL を受け取れるようにする
  // 何も無ければ GitHub raw をデフォルトに（あなたのrepoに合わせて必要なら変更）
  const dataUrl =
    url.searchParams.get("data") ??
    "https://raw.githubusercontent.com/Tetsu1000/myportfolio/main/dataset.xlsx";

  try {
    if (!cache.has(dataUrl)) {
      cache.set(dataUrl, loadDatasetFromUrl(dataUrl));
    }
    const rows = await cache.get(dataUrl)!;
    return NextResponse.json({ ok: true, rows, source: dataUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
