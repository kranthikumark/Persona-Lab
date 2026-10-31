import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { nativeReplyAudio } from "@/lib/speech/native-playback";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Input = z
  .object({
    messageId: z.string().min(1).max(100),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const input = Input.parse(await jsonBody(request, 512));
    const audio = await nativeReplyAudio(
      (await context.params).id,
      await owner(),
      input.messageId,
      input.revision,
      request.signal,
    );
    return new Response(Uint8Array.from(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handle(async () => {
      throw error;
    });
  }
}
