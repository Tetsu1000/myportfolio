import { Suspense } from "react";
import RankingPage from "@/components/RankingPage";

export default function Home() {
  return (
    <Suspense fallback={<div className="card">読み込み中…</div>}>
      <RankingPage />
    </Suspense>
  );
}
