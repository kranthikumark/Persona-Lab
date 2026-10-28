import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { exportData } from "@/lib/reports/data";
export const runtime = "nodejs";
const input = z
  .object({
    format: z.enum(["pdf", "docx"]),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const { format, revision } = input.parse(await jsonBody(request));
    const { id } = await context.params;
    const data = await exportData(id, await owner(), revision);
    const bytes =
      format === "pdf"
        ? await (await import("@/lib/reports/pdf")).reportPDF(data)
        : await (await import("@/lib/reports/docx")).reportDOCX(data);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="persona-lab-report-r${revision}.${format}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handle(async () => {
      throw error;
    });
  }
}
