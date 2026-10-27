import { Suspense } from "react";
import { Compare } from "@/components/compare";
export default async function ComparePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={<div className="page-loading">Comparing possibilities…</div>}
    >
      <Compare sessionId={id} />
    </Suspense>
  );
}
