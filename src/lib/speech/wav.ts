import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, SAMPLE_RATE } from "./contracts";
// Shared encoder/validator: PCM WAV only. No codecs, file parsing binaries or
// unbounded media uploads run on the application server.
export function encodeWav(
  samples: Float32Array,
  inputRate: number,
): Uint8Array {
  if (
    !Number.isFinite(inputRate) ||
    inputRate < 16000 ||
    inputRate > 192000 ||
    samples.length / inputRate > MAX_AUDIO_SECONDS + 0.1
  )
    throw new Error("Unsupported recording duration or sample rate.");
  const count = Math.floor((samples.length * SAMPLE_RATE) / inputRate);
  const bytes = new Uint8Array(44 + count * 2),
    view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++)
      view.setUint8(offset + i, value.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const start = Math.floor((i * inputRate) / SAMPLE_RATE),
      end = Math.min(
        samples.length,
        Math.max(start + 1, Math.floor(((i + 1) * inputRate) / SAMPLE_RATE)),
      );
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    const value = Math.max(-1, Math.min(1, sum / (end - start)));
    view.setInt16(
      44 + i * 2,
      Math.round(value * (value < 0 ? 32768 : 32767)),
      true,
    );
  }
  return bytes;
}
export function validateWav(bytes: Uint8Array) {
  if (bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES)
    throw new Error("Record between 0.25 and 60 seconds of audio.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, n: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + n));
  if (
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WAVE" ||
    view.getUint32(4, true) !== bytes.length - 8
  )
    throw new Error("Use a supported PCM WAV recording.");
  let position = 12,
    format = false,
    dataBytes = 0,
    rate = 0;
  while (position + 8 <= bytes.length) {
    const kind = text(position, 4),
      size = view.getUint32(position + 4, true),
      start = position + 8;
    if (size > bytes.length - start) throw new Error("Invalid WAV chunk.");
    if (kind === "fmt ") {
      if (
        format ||
        size < 16 ||
        view.getUint16(start, true) !== 1 ||
        view.getUint16(start + 2, true) !== 1 ||
        view.getUint16(start + 14, true) !== 16
      )
        throw new Error("Use mono, 16-bit PCM WAV audio.");
      rate = view.getUint32(start + 4, true);
      if (
        ![16000, 24000].includes(rate) ||
        view.getUint32(start + 8, true) !== rate * 2 ||
        view.getUint16(start + 12, true) !== 2
      )
        throw new Error("Use 16 or 24 kHz PCM audio.");
      format = true;
    } else if (kind === "data") {
      if (dataBytes || size % 2) throw new Error("Invalid WAV audio data.");
      dataBytes = size;
    } else if (!["JUNK", "LIST"].includes(kind))
      throw new Error("Unsupported WAV metadata.");
    position = start + size + (size % 2);
  }
  const durationMs = (dataBytes / (rate * 2)) * 1000;
  if (
    !format ||
    position !== bytes.length ||
    !dataBytes ||
    !Number.isFinite(durationMs) ||
    durationMs < 250 ||
    durationMs > MAX_AUDIO_SECONDS * 1000
  )
    throw new Error("Record between 0.25 and 60 seconds of audio.");
  return { durationMs, sampleRate: rate };
}
