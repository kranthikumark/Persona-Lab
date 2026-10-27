import { Suspense } from "react";
import { Studio } from "@/components/studio";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <Suspense
      fallback={<div className="page-loading">Opening the studio…</div>}
    >
      <Studio mode={process.env.AI_PROVIDER ?? "mock"} />
    </Suspense>
  );
}
