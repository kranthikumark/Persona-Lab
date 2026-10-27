import { z } from "zod";
import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { createEvaluation, latestEvaluation } from "@/lib/evaluation/service";
const input = z.object({ revision: z.number().int().nonnegative() }).strict();
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () =>
    latestEvaluation((await context.params).id, await owner()),
  );
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    assertOrigin(request);
    const { revision } = input.parse(await jsonBody(request));
    return createEvaluation((await context.params).id, await owner(), revision);
  });
}
