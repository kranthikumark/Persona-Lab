import { assertOrigin, handle, owner } from "@/lib/api";
import { requireSession, sessionView } from "@/lib/simulation/service";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () =>
    sessionView(
      (await context.params).id,
      await owner(),
      new URL(request.url).searchParams.get("branch") ?? undefined,
    ),
  );
}
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    const { id } = await context.params;
    await requireSession(id, await owner());
    // Remove self-references first so branch and snapshot cascades can delete the aggregate.
    await db.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { sessionId: id },
        data: { forkSnapshotId: null, parentBranchId: null },
      });
      await tx.simulationSession.delete({ where: { id } });
    });
    return { deleted: true };
  });
}
