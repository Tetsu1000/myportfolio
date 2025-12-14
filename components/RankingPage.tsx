"use client";

import Link from "next/link";
import { useMemo, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadDatasetRows, type DatasetRow } from "@/lib/dataset";
import { scoreRow, type Score } from "@/lib/scoring";

type RankedRow = DatasetRow & { _s: Score };

export default function RankingPage() {
  const sp = useSearchParams();
  const overrideDataUrl = sp.get("data"); // ?data= で dataset.xlsx URL差し替え

  const [dataset, setDataset] = useState<DatasetRow[]>([]);
  const [status, setStatus] = useState<string>("loading...");

  const [fIndustry, setFIndustry] = useState("");
  const [fMarket, setFMarket] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setStatus("データ読み込み中…");
        const rows = await loadDatasetRows(overrideDataUrl);
        if (!mounted) return;
        setDataset(rows);
        setStatus(`OK（${rows.length}件）`);
      } catch (e: any) {
        if (!mounted) return;
        setStatus(`初期ロード失敗: ${e?.message ?? String(e)}`);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [overrideDataUrl]);

  const industryOpts = useMemo(() => {
    const s = new Set(dataset.map((r) => r.industry).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
  }, [dataset]);

  const marketOpts = useMemo(() => {
    const s = new Set(dataset.map((r) => r.market).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "ja"));
  }, [dataset]);

  const ranked: RankedRow[] = useMemo(() => {
    const base = dataset.map((r) => ({ ...r, _s: scoreRow(r, dataset) }));
    base.sort((a, b) => b._s.investScore - a._s.investScore);
    return base;
  }, [dataset]);

  const filtered = useMemo(() => {
    return ranked.filter(
      (r) =>
        (fIndustry ? r.industry === fIndustry : true) &&
        (fMarket ? r.market === fMarket : true)
    );
  }, [ranked, fIndustry, fMarket]);

  const counts = useMemo(() => {
    let great = 0;
    let good = 0;
    for (const r of filtered) {
      if (r._s.label === "すばらしい企業") great++;
      else if (r._s.label === "よい企業") good++;
    }
    return { great, good };
  }, [filtered]);

  return (
    <>
      <h1 className="h1">企業評価ランキング</h1>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="statusrow">
          <div className="muted">データ: {status}</div>
          {overrideDataUrl ? (
            <div className="small">override: {overrideDataUrl}</div>
          ) : (
            <div className="small">
              （必要なら ?data= で dataset.xlsx URL を差し替え可能）
            </div>
          )}
        </div>

        <div className="filterbar">
          <div>
            <div className="label">業種で絞り込み</div>
            <select value={fIndustry} onChange={(e) => setFIndustry(e.target.value)}>
              <option value="">全業種</option>
              {industryOpts.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">市場区分で絞り込み</div>
            <select value={fMarket} onChange={(e) => setFMarket(e.target.value)}>
              <option value="">全市場</option>
              {marketOpts.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label"> </div>
            <button
              className="clearbtn"
              onClick={() => {
                setFIndustry("");
                setFMarket("");
              }}
            >
              条件クリア
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <div style={{ fontWeight: 700 }}>投資スコア順・{filtered.length}件</div>
          <div>
            <span className="tag">すばらしい: {counts.great}</span>{" "}
            <span className="tag">よい: {counts.good}</span>
          </div>
        </div>

        <div className="hdr">
          <div>会社名</div>
          <div>ティッカー</div>
          <div>投資スコア</div>
          <div>評価</div>
        </div>

        <div className="list">
          {filtered.map((r) => (
            <Link
              key={r.id}
              className="rowitem"
              href={`/stock/${encodeURIComponent(r.ticker || "")}`}
              title={`クリックで個別株式評価へ（ticker=${r.ticker}）`}
            >
              <div>
                <div>{r.name || "-"}</div>
                <div className="muted">
                  {(r.industry || "") + (r.market ? `・${r.market}` : "")}
                </div>
              </div>
              <div>{r.ticker || "-"}</div>
              <div>{r._s.investScore.toFixed(2)}</div>
              <div>
                <span className={`pill ${r._s.cls}`}>{r._s.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
