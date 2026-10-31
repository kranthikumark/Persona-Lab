import { assertOrigin, handle, owner, ApiError } from "@/lib/api";
import { sourceList, uploadSource } from "@/lib/media/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return handle(async () =>
    sourceList((await context.params).id, await owner()),
  );
}
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    assertOrigin(request);
    const header = request.headers.get("x-source-meta");
    if (!header || header.length > 2048)
      throw new ApiError(400, "Upload metadata is missing or too large.");
    let metadata: unknown;
    try {
      metadata = JSON.parse(decodeURIComponent(header));
    } catch {
      throw new ApiError(400, "Send valid source metadata.");
    }
    return uploadSource(
      (await context.params).id,
      await owner(),
      metadata,
      request.headers.get("content-type") ?? "",
      request,
    );
  });
}
