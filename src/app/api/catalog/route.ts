import { handle } from "@/lib/api";
import { catalogEntries } from "@/lib/catalog/service";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => ({ scenarios: await catalogEntries() }));
}
