import { handle, owner } from "@/lib/api";
import { sourceFile } from "@/lib/media/service";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; assetId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { id, assetId } = await context.params;
    z.uuid().parse(assetId);
    const { file, contentType, name } = await sourceFile(
      id,
      assetId,
      await owner(),
      request.headers.get("range"),
    );
    const filename = encodeURIComponent(name).replace(
      /['()*]/g,
      (v) => `%${v.charCodeAt(0).toString(16)}`,
    );
    return new Response(file.data, {
      status: file.partial ? 206 : 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(file.data.byteLength),
        "Accept-Ranges": "bytes",
        ...(file.partial
          ? { "Content-Range": `bytes ${file.start}-${file.end}/${file.size}` }
          : {}),
        "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return handle(async () => {
      throw error;
    });
  }
}
