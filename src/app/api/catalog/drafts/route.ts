import { handle, assertOrigin, owner, ApiError, jsonBody } from "@/lib/api";
import { listDrafts, createDraft } from "@/lib/catalog/service";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => ({ drafts: await listDrafts(await owner()) }));
}
export async function POST(request: Request) {
  return handle(async () => {
    assertOrigin(request);
    z.object({})
      .strict()
      .parse(await jsonBody(request));
    const identity = await owner(true);
    if (!identity) throw new ApiError(403, "Browser ownership required.");
    return createDraft(identity);
  });
}
