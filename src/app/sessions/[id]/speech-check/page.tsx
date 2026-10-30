import { Suspense } from "react";
import { SpeechCheck } from "@/components/speech/speech-check";
export const metadata = { title: "Microphone check · PERSONA LAB" };
export default async function SpeechCheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p>Opening microphone check…</p>}>
      <SpeechCheck sessionId={(await params).id} />
    </Suspense>
  );
}
