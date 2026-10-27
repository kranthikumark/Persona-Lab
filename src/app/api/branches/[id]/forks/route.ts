import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { forkBranch } from "@/lib/simulation/service";
const schema = z
  .object({
    snapshotId: z.string().min(1).max(64),
    name: z.string().trim().min(1).max(60),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    const input = schema.parse(await jsonBody(request));
    return forkBranch(
      (await context.params).id,
      await owner(),
      input.snapshotId,
      input.name,
    );
  });
}
