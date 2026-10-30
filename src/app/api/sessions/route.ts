import { SessionStartSchema } from "@/lib/practice/metadata";
import { assertOrigin, handle, owner, jsonBody } from "@/lib/api";
import { listSessions, startSession } from "@/lib/simulation/service";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => ({ sessions: await listSessions(await owner()) }));
}
export async function POST(request: Request) {
  return handle(async () => {
    assertOrigin(request);
    const input = SessionStartSchema.parse(
      request.body ? await jsonBody(request) : {},
    );
    return startSession((await owner(true))!, input);
  });
}
