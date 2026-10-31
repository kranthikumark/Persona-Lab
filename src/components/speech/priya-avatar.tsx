"use client";
import { useState, type Ref } from "react";
import { SimliAvatar, type SimliHandle } from "./simli-avatar";
import Image from "next/image";
import { voiceStageLabels, type VoiceStage } from "@/lib/speech/voice-stage";

// The photo is a static fallback until an actual video renderer is connected.
// Playback activity never fabricates facial movement or alters conversation state.
export function PriyaAvatar({
  stage,
  branchId,
  revision,
  locale,
  avatarRef,
  onAvatarReady,
  onVideoMode,
  videoReady,
}: {
  stage: VoiceStage;
  branchId: string;
  revision: number;
  locale: string;
  avatarRef: Ref<SimliHandle>;
  onAvatarReady: (ready: boolean) => void;
  onVideoMode: (enabled: boolean) => void;
  videoReady: boolean;
}) {
  const [portraitFailed, setPortraitFailed] = useState(false);
  return (
    <div
      className="priya-avatar"
      data-stage={stage}
      data-renderer={videoReady ? "simli" : "portrait"}
    >
      <div className="character-photo priya-stage">
        {portraitFailed ? (
          <div
            className="priya-initials"
            role="img"
            aria-label="Priya, fictional conversation partner"
          >
            P
          </div>
        ) : (
          <Image
            src="/images/priya.webp"
            alt="Priya, your fictional conversation partner"
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1200px) 45vw, 550px"
            priority
            onError={() => setPortraitFailed(true)}
          />
        )}
        <SimliAvatar
          ref={avatarRef}
          branchId={branchId}
          revision={revision}
          locale={locale}
          onReady={onAvatarReady}
          onVideoMode={onVideoMode}
        />
        <div className="portrait-shade" />
        <span className="portrait-mode-label">AI PARTNER</span>
        <div className="priya-name">
          <span className="eyebrow">A CONVERSATION WITH</span>
          <h2>Priya</h2>
          <p>Prospective customer</p>
        </div>
      </div>
      <div className="priya-presence">
        <div
          className="priya-status"
          role="status"
          aria-live={stage === "thinking" ? "off" : "polite"}
          aria-atomic="true"
        >
          <span className="priya-signal" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} />
            ))}
          </span>
          <span>{voiceStageLabels[stage]}</span>
        </div>
        <span className="portrait-mode-note">
          {videoReady ? "Live video · Simli" : "Portrait · spoken replies"}
        </span>
      </div>
    </div>
  );
}
