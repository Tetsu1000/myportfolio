import StockChart from "@/components/StockChart";

export default function StockPage({ params }: { params: { ticker: string } }) {
  const { ticker } = params;

  return (
    <>
      <h1 className="h1">個別株式評価</h1>
      <StockChart ticker={ticker} />
    </>
  );
}
