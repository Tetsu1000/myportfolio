import * as XLSX from "xlsx";

export type DatasetRow = {
  id: number;
  name: string;
  ticker: string;
  industry: string;
  market: string;
  op: number[]; // 5年分
  fcf: number[]; // 5年分
  roe: number[]; // 5年分(%)
  sharesOku: number;
  price: number | null;
  opNowEst: number;
  opNextEst: number;
  per: number | null;
  pbr: number | null;
};

// あなたの既存構成（GitHub上のdataset.xlsx）に合わせたデフォルト
const GH_OWNER = "Tetsu1000";
const GH_REPO = "stock_ev";
const GH_BRANCH = "main";

const URL_JSDELIVR = `https://cdn.jsdelivr.net/gh/${GH_OWNER}/${GH_REPO}@${GH_BRANCH}/dataset.xlsx`;
const URL_RAW = `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/dataset.xlsx`;

const YEARS = [2021, 2022, 2023, 2024, 2025] as const;

const toNum = (v: any) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[, \u3000]/g, "");
  const m = s.match(/^([-+]?\d+(\.\d+)?)/);
  return m ? Number(m[1]) : 0;
};

const parsePercentCell = (v: any) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Math.abs(v) <= 1 ? v * 100 : v;
  const s = String(v).trim();
  if (s.endsWith("%")) return toNum(s.replace("%", ""));
  const n = toNum(s);
  return Math.abs(n) <= 1 ? n * 100 : n;
};

const buster = (u: string) => `${u}${u.includes("?") ? "&" : "?"}_=${Date.now()}`;

async function fetchArrayBufferWithFallback(urls: string[]) {
  let lastErr: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      return await res.arrayBuffer();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

function parseWorkbookToRows(buf: ArrayBuffer): DatasetRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const wsName = wb.SheetNames.includes("information") ? "information" : wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: null });

  const rows = (Array.isArray(json) ? json : [])
    .map((r, idx) => {
      const get = (k: string, ...alts: string[]) => {
        if (r[k] != null) return r[k];
        for (const a of alts) {
          if (r[a] != null) return r[a];
        }
        return null;
      };

      const industry = (get("industry", "Industry", "業種") || "").toString();
      const market = (get("market", "Market", "市場区分", "市場") || "").toString();

      const shareOku = toNum(get("share", "Shares_Oku", "share_oku"));
      const opNow = toNum(get("Op_2026", "OP_2026", "OP_now", "今期OP予想"));
      const opNext = toNum(get("Op_2027", "OP_2027", "OP_next", "来期OP予想"));

      const perVal = toNum(get("PER", "per"));
      const pbrVal = toNum(get("PBR", "pbr"));

      const name = (get("company", "Company") || "").toString();
      const ticker = (get("ticker", "Ticker") || "").toString();

      const op = YEARS.map((y) => toNum(get(`Op_${y}`, `OP_${y}`)));
      const fcf = YEARS.map((y) => toNum(get(`FCF_${y}`)));
      const roe = YEARS.map((y) => parsePercentCell(get(`ROE_${y}`)));

      return {
        id: idx + 1,
        name,
        ticker,
        industry,
        market,
        op,
        fcf,
        roe,
        sharesOku: Number(shareOku) || 0,
        price: Number(toNum(get("price", "Price"))) || null,
        opNowEst: opNow || 0,
        opNextEst: opNext || 0,
        per: Number.isFinite(perVal) ? perVal : null,
        pbr: Number.isFinite(pbrVal) ? pbrVal : null,
      } satisfies DatasetRow;
    })
    .filter((r) => (r.name || "").trim() !== "");

  return rows;
}

export async function loadDatasetRows(overrideUrl: string | null): Promise<DatasetRow[]> {
  const custom = overrideUrl && overrideUrl.trim();
  const urls = custom ? [buster(custom)] : [buster(URL_JSDELIVR), buster(URL_RAW)];
  const buf = await fetchArrayBufferWithFallback(urls);
  return parseWorkbookToRows(buf);
}
