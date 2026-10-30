import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { sendTurn } from "@/lib/simulation/service";
const schema = z
  .object({
    inputModality: z.enum(["text", "voice"]).optional(),
    speechReceipt: z.string().min(1).max(16000).optional(),
    text: z.string().max(2000),
    key: z.uuid(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if ((input.inputModality === "voice") !== !!input.speechReceipt)
      ctx.addIssue({
        code: "custom",
        message: "Voice input requires a verified transcription receipt.",
      });
  });
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    return sendTurn(
      (await context.params).id,
      await owner(),
      schema.parse(await jsonBody(request, 32768)),
    );
  });
}
