"use client";

import { useParams } from "next/navigation";
import StockChart from "@/components/StockChart";

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();

  return (
    <>
      <h1 className="h1">個別株式評価</h1>
      <StockChart ticker={ticker} />
    </>
  );
}
