import { capabilities } from "@/lib/capabilities/server";
import { Suspense } from "react";
import { Studio } from "@/components/studio";
import type { Metadata } from "next";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}): Promise<Metadata> {
  return {
    title: {
      absolute: `${(await searchParams).view === "history" ? "Practice history" : "Scenario studio"} · PERSONA LAB`,
    },
  };
}
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <Suspense
      fallback={<div className="page-loading">Opening the studio…</div>}
    >
      <Studio
        mode={process.env.AI_PROVIDER ?? "mock"}
        textPracticeAvailable={capabilities().englishText.available}
      />
    </Suspense>
  );
}
