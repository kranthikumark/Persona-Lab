import { assertOrigin, handle, owner } from "@/lib/api";
import { listSessions, startSession } from "@/lib/simulation/service";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => ({ sessions: await listSessions(await owner()) }));
}
export async function POST(request: Request) {
  return handle(async () => {
    assertOrigin(request);
    return startSession((await owner(true))!);
  });
}
