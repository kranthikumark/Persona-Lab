export type CapturePhase = "idle" | "permission" | "recording" | "transcribing";
export type PlaybackPhase = "idle" | "preparing" | "speaking";
export type VoiceStage =
  | "ready"
  | "permission"
  | "listening"
  | "transcribing"
  | "thinking"
  | "preparing"
  | "speaking";
export const voiceStageLabels: Record<VoiceStage, string> = {
  ready: "Ready to practice",
  permission: "Waiting for microphone",
  listening: "Listening to you",
  transcribing: "Transcribing your response",
  thinking: "Priya is thinking",
  preparing: "Preparing Priya’s voice",
  speaking: "Priya is speaking",
};
export function voiceStage(
  capture: CapturePhase,
  processing: boolean,
  playback: PlaybackPhase,
): VoiceStage {
  if (capture === "permission") return "permission";
  if (capture === "recording") return "listening";
  if (capture === "transcribing") return "transcribing";
  if (processing) return "thinking";
  if (playback !== "idle") return playback;
  return "ready";
}
