import { handle, owner } from "@/lib/api";
import { sourceHistory } from "@/lib/media/service";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; assetId: string }> },
) {
  return handle(async () => {
    const { id, assetId } = await context.params;
    z.uuid().parse(assetId);
    return sourceHistory(id, assetId, await owner());
  });
}
