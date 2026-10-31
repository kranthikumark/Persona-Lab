import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { startAvatar, endAvatar } from "@/lib/avatar/simli";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Input = z
  .object({ revision: z.number().int().nonnegative(), leaseId: z.uuid() })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    const input = Input.parse(await jsonBody(request, 128));
    return startAvatar(
      (await context.params).id,
      await owner(),
      input.revision,
      input.leaseId,
      request.signal,
    );
  });
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    const input = z
      .object({ leaseId: z.uuid() })
      .strict()
      .parse(await jsonBody(request, 128));
    return endAvatar((await context.params).id, await owner(), input.leaseId);
  });
}
