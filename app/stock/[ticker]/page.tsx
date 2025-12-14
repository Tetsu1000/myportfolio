import StockChart from "@/components/StockChart";

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;

  return (
    <>
      <h1 className="h1">個別株式評価</h1>
      <StockChart ticker={ticker} />
    </>
  );
}
