// Simli accepts raw little-endian PCM16 at 16 kHz, not a WAV container.
export function wavToSimliPcm(bytes: Uint8Array): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(...bytes.slice(o, o + 4));
  if (
    bytes.length < 44 ||
    bytes.length > 90 * 48000 + 8192 ||
    tag(0) !== "RIFF" ||
    tag(8) !== "WAVE"
  )
    throw new Error("Invalid reply audio");
  let rate = 0,
    offset = 0,
    count = 0;
  for (let p = 12; p + 8 <= bytes.length;) {
    const length = view.getUint32(p + 4, true);
    if (p + 8 + length > bytes.length) throw new Error("Invalid audio chunk");
    if (tag(p) === "fmt ") {
      if (
        length < 16 ||
        view.getUint16(p + 8, true) !== 1 ||
        view.getUint16(p + 10, true) !== 1 ||
        view.getUint16(p + 22, true) !== 16
      )
        throw new Error("Use mono PCM16 audio");
      rate = view.getUint32(p + 12, true);
    }
    if (tag(p) === "data") {
      offset = p + 8;
      count = length / 2;
    }
    p += 8 + length + (length % 2);
  }
  if (
    ![16000, 24000].includes(rate) ||
    !offset ||
    !Number.isInteger(count) ||
    count < 1 ||
    count / rate > 90
  )
    throw new Error("Unsupported audio");
  const n = Math.floor((count * 16000) / rate),
    out = new Uint8Array(n * 2),
    target = new DataView(out.buffer);
  for (let i = 0; i < n; i++) {
    const start = Math.floor((i * rate) / 16000),
      end = Math.min(
        count,
        Math.max(start + 1, Math.floor(((i + 1) * rate) / 16000)),
      );
    let value = 0;
    for (let j = start; j < end; j++)
      value += view.getInt16(offset + j * 2, true);
    target.setInt16(i * 2, Math.round(value / (end - start)), true);
  }
  return out;
}
