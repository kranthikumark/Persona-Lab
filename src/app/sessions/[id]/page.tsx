import { Suspense } from "react";
import { Practice } from "@/components/practice";
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={<div className="page-loading">Loading your conversation…</div>}
    >
      <Practice sessionId={id} />
    </Suspense>
  );
}
