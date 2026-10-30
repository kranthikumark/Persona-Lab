// This stores permission preferences only, never recordings or transcripts.
// Increment the version if provider, purpose or retention changes.
export const VOICE_CHOICE_KEY = "persona-voice-choice-v1";
export const VOICE_CHOICE_VALUE = "allow-meta-transcription-no-audio-retention";
let memoryAllowed = false;
export function voiceAllowed() {
  try {
    const stored = window.localStorage.getItem(VOICE_CHOICE_KEY);
    if (stored === VOICE_CHOICE_VALUE) memoryAllowed = true;
    return stored === VOICE_CHOICE_VALUE || (stored === null && memoryAllowed);
  } catch {
    return memoryAllowed;
  }
}
export function rememberVoiceChoice(allowed: boolean) {
  memoryAllowed = allowed;
  try {
    if (allowed)
      window.localStorage.setItem(VOICE_CHOICE_KEY, VOICE_CHOICE_VALUE);
    else window.localStorage.removeItem(VOICE_CHOICE_KEY);
  } catch {
    /* Keep the choice for this tab when browser storage is blocked. */
  }
  window.dispatchEvent(new Event("persona-voice-choice"));
}
export function receiveVoiceChoice(value: string | null) {
  memoryAllowed = value === VOICE_CHOICE_VALUE;
}
