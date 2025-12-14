import type { DatasetRow } from "./dataset";

export type Score = {
  investScore: number;
  label: "売るべき企業" | "様子見企業" | "よい企業" | "すばらしい企業";
  cls: "sell" | "neu" | "good" | "great";
};

const asArr = (v: any) => (Array.isArray(v) ? v : []);
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const stdev = (a: number[]) => {
  const m = mean(a);
  const v = a.length ? a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length : 0;
  return Math.sqrt(v);
};

const linreg = (arr: number[]) => {
  const y = asArr(arr).map((v) => Number(v) || 0);
  const n = y.length;
  if (n < 2) return { slope: 0, se: 0 };
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = x.reduce((s, xi) => s + (xi - mx) * (xi - mx), 0);
  const slope = den === 0 ? 0 : num / den;

  const intercept = my - slope * mx;
  const residuals = y.map((yi, i) => yi - (slope * x[i] + intercept));
  const se = Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / Math.max(1, n - 2));
  return { slope, se };
};

function clamp(x: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, x));
}
function smoothLogistic(z: number, mid: number, half: number, k: number) {
  return mid + half * (2 / (1 + Math.exp(-k * z)) - 1);
}
function median(a: number[]) {
  const b = [...a].sort((x, y) => x - y);
  const n = b.length;
  return n ? (n % 2 ? b[(n - 1) / 2] : 0.5 * (b[n / 2 - 1] + b[n / 2])) : 0;
}
function mad(a: number[]) {
  const m = median(a);
  const d = a.map((x) => Math.abs(x - m));
  return median(d) || 1e-9;
}
function zRobust(x: number, med: number, madVal: number) {
  return (x - med) / (1.4826 * Math.max(1e-9, madVal));
}

/**
 * Step1のランキング用途：投資スコアを計算
 * - 利益推移（OPの成長＆安定性）
 * - 資金創出（FCF>0の年数）
 * - 参入障壁（ROE水準＋ROE成長）
 */
export function scoreRow(row: DatasetRow, datasetAll: DatasetRow[]): Score {
  const slopeDivs = datasetAll.map((r) => {
    const lr = linreg(r.op);
    const mOP = Math.max(1e-9, mean(r.op));
    return lr.slope / mOP;
  });

  const seDivs = datasetAll.map((r) => {
    const lr = linreg(r.op);
    const mOP = Math.max(1e-9, mean(r.op));
    return lr.se / mOP;
  });

  const medSlope = median(slopeDivs);
  const madSlope = mad(slopeDivs);
  const medSe = median(seDivs);
  const madSe = mad(seDivs);

  const lr = linreg(row.op);
  const mOP = Math.max(1e-9, mean(row.op));
  const slopeDiv = lr.slope / mOP;
  const seDiv = lr.se / mOP;

  const zSlope = zRobust(slopeDiv, medSlope, madSlope);
  const zSe = zRobust(seDiv, medSe, madSe);

  const k = 0.5;
  const growthScore = clamp(smoothLogistic(zSlope, 50, 50, k), 0, 100);
  const breScore = clamp(smoothLogistic(-zSe, 50, 50, k), 0, 100);

  const opTrendScore = ((growthScore + breScore) / 2) * 0.05;

  const fundGenScore = asArr(row.fcf).filter((x) => (Number(x) || 0) > 0).length;

  const roeArr = asArr(row.roe).filter((x) => Number.isFinite(x));
  const lastRoe = roeArr.length ? roeArr[roeArr.length - 1] : 0;
  const lastRoeScore = 6 / (1 + Math.exp(-1 * (lastRoe - 12) / 12));

  const roeSlopes = datasetAll
    .map((r) => asArr(r.roe).filter((x) => Number.isFinite(x)))
    .filter((a) => a.length >= 2)
    .map((a) => linreg(a).slope);

  const roeMu = roeSlopes.length ? mean(roeSlopes) : 0;
  const roeSd = Math.max(1e-9, stdev(roeSlopes));
  const roeSlope = roeArr.length >= 2 ? linreg(roeArr).slope : 0;
  const z = (roeSlope - roeMu) / roeSd;
  const roeGrowthScore = Math.tanh(z);

  const barrierScore = lastRoeScore + roeGrowthScore;

  const investScore = opTrendScore + fundGenScore + barrierScore;

  let label: Score["label"];
  let cls: Score["cls"];
  if (investScore < 8) {
    label = "売るべき企業";
    cls = "sell";
  } else if (investScore < 10) {
    label = "様子見企業";
    cls = "neu";
  } else if (investScore < 12) {
    label = "よい企業";
    cls = "good";
  } else {
    label = "すばらしい企業";
    cls = "great";
  }

  return { investScore, label, cls };
}
