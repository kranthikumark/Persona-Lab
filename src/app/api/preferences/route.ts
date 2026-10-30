import { assertOrigin, handle, jsonBody, owner } from "@/lib/api";
import { StartPracticeSchema } from "@/lib/practice/metadata";
import {
  preferenceView,
  clearPreferences,
  savePreferences,
} from "@/lib/practice/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => preferenceView(await owner()));
}
export async function PUT(request: Request) {
  return handle(async () => {
    assertOrigin(request);
    const input = StartPracticeSchema.parse(await jsonBody(request));
    return {
      preferences: await savePreferences((await owner(true))!, input),
      saved: true,
    };
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    assertOrigin(request);
    return clearPreferences(await owner());
  });
}
