// Only installed voices; never fall back to another language or remote speech.
export function selectLocalVoice<
  T extends { lang: string; localService: boolean },
>(voices: T[], locale: string): T | undefined {
  const language = locale.split("-")[0].toLowerCase();
  const matching = voices.filter(
    (v) =>
      v.localService &&
      v.lang.replaceAll("_", "-").toLowerCase().split("-")[0] === language,
  );
  return (
    matching.find(
      (v) => v.lang.replaceAll("_", "-").toLowerCase() === locale.toLowerCase(),
    ) ?? matching[0]
  );
}
