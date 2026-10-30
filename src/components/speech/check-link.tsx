"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Mic } from "lucide-react";
export function SpeechCheckLink({
  sessionId,
  branchId,
  originalRoute = false,
}: {
  sessionId: string;
  branchId: string;
  originalRoute?: boolean;
}) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    api<{ speech: { checkAvailable: boolean } }>("/api/capabilities")
      .then((r) => {
        if (active) setAvailable(r.speech.checkAvailable);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  // Full document navigation is required for the route's Permissions-Policy.
  return available ? (
    <a
      className="button button-secondary"
      href={`/sessions/${sessionId}/speech-check?branch=${branchId}${originalRoute ? "&return=original" : ""}`}
    >
      <Mic size={16} aria-hidden="true" /> Microphone check
    </a>
  ) : null;
}
