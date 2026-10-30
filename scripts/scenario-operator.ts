import { loadEnvFile } from "node:process";
import { db } from "../src/lib/db";
import { reviewDraft, publishDraft } from "../src/lib/catalog/service";
loadEnvFile(".env");
// Execution is authorized by access to this server's OS account. This command
// is deliberately absent from HTTP routes; never expose it as a web shell.
try {
  const [action, id, revisionText, ...args] = process.argv.slice(2);
  const revision = Number(revisionText);
  if (!id || !Number.isInteger(revision) || revision < 1)
    throw new Error(
      "Usage: npm run scenario:operator -- inspect|review|publish ID REVISION [--reviewer NAME --approve]",
    );
  if (action === "inspect") {
    const row = await db.scenarioDraft.findFirstOrThrow({
      where: { id, revision, expiresAt: { gt: new Date() } },
    });
    console.log(
      JSON.stringify(
        {
          id,
          revision,
          status: row.status,
          content: row.content,
          review: row.review,
        },
        null,
        2,
      ),
    );
  } else if (action === "review") {
    if (
      args[0] !== "--reviewer" ||
      !args[1] ||
      args[2] !== "--approve" ||
      args.length !== 3
    )
      throw new Error(
        "Inspect the complete content first; then provide --reviewer NAME --approve to attest review of this exact revision.",
      );
    console.log(
      JSON.stringify(await reviewDraft(id, revision, args[1]), null, 2),
    );
  } else if (action === "publish") {
    if (args.length) throw new Error("Unexpected arguments.");
    console.log(JSON.stringify(await publishDraft(id, revision)));
  } else throw new Error("Unknown action.");
} finally {
  await db.$disconnect();
}
