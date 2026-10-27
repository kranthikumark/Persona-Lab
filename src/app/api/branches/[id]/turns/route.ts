import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { sendTurn } from "@/lib/simulation/service";
const schema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    key: z.uuid(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    return sendTurn(
      (await context.params).id,
      await owner(),
      schema.parse(await jsonBody(request)),
    );
  });
}
