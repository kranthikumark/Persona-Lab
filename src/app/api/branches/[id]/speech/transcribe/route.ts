import { assertOrigin, handle, owner } from "@/lib/api";
import { transcribeForBranch } from "@/lib/speech/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    return transcribeForBranch(
      (await context.params).id,
      await owner(),
      request,
    );
  });
}
