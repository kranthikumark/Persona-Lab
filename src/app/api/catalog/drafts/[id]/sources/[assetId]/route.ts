import { assertOrigin, handle, owner, jsonBody } from "@/lib/api";
import {
  transcribeSource,
  reviewSource,
  deleteSource,
} from "@/lib/media/service";
import { DeleteInput } from "@/lib/media/contracts";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; assetId: string }> };
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    assertOrigin(request);
    const { id, assetId } = await context.params;
    z.uuid().parse(assetId);
    const data = await jsonBody(request, 100000);
    const action = z.enum(["transcribe", "review"]).parse(data?.action);
    const input = { ...data };
    delete input.action;
    if (action === "transcribe")
      return transcribeSource(
        id,
        assetId,
        await owner(),
        input,
        request.signal,
      );
    return reviewSource(id, assetId, await owner(), input);
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    assertOrigin(request);
    const { id, assetId } = await context.params;
    z.uuid().parse(assetId);
    const input = DeleteInput.parse(await jsonBody(request, 1000));
    return deleteSource(
      id,
      assetId,
      await owner(),
      input.revision,
      input.draftRevision,
    );
  });
}
