import { handle, assertOrigin, owner, jsonBody } from "@/lib/api";
import { saveDraft, deleteDraft } from "@/lib/catalog/service";
import { SaveDraftSchema } from "@/lib/catalog/schema";
import { db } from "@/lib/db";
import { lockDraft, draftDTO } from "@/lib/media/service";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return handle(async () =>
    db.$transaction(async (tx) =>
      draftDTO(await lockDraft(tx, (await context.params).id, await owner())),
    ),
  );
}
export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    assertOrigin(request);
    const { id } = await context.params;
    const input = SaveDraftSchema.parse(await jsonBody(request));
    return saveDraft(id, await owner(), input.revision, input.content);
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    assertOrigin(request);
    return deleteDraft((await context.params).id, await owner());
  });
}
