export default function StockPage({ params }: { params: { ticker: string } }) {
  const { ticker } = params;

  return (
    <div className="card">
      <h1 className="h1">個別株式評価（準備中）</h1>
      <div className="muted">ticker: {ticker}</div>
      <div className="muted">Step2で日足チャート＋MA/BB/RSI/MACDを実装します。</div>
    </div>
  );
}
