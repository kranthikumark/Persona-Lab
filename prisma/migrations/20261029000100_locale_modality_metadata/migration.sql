BEGIN;
ALTER TABLE "Scenario" ADD COLUMN "catalogMetadata" JSONB;
ALTER TABLE "SimulationSession" ADD COLUMN "settings" JSONB;
ALTER TABLE "Branch" ADD COLUMN "settings" JSONB;
ALTER TABLE "Message" ADD COLUMN "sourceMetadata" JSONB;
ALTER TABLE "Evaluation" ADD COLUMN "localeMetadata" JSONB;
CREATE TABLE "ScenarioLocalization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scenarioId" TEXT NOT NULL REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "locale" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'baseline',
  "content" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ScenarioLocalization_scenarioId_locale_version_key" ON "ScenarioLocalization"("scenarioId", "locale", "version");
CREATE TABLE "PracticePreference" (
  "ownerHash" TEXT NOT NULL PRIMARY KEY,
  "settings" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "PracticePreference_expiresAt_idx" ON "PracticePreference"("expiresAt");
-- Add baseline localization without touching any historical scenario payload.
INSERT INTO "ScenarioLocalization" ("id", "scenarioId", "locale", "version", "content")
SELECT 'baseline-en-' || "id", "id", 'en-IN', 1,
 jsonb_build_object('title', "definition"->'title', 'instructions', "definition"->'objectives',
 'persona', "definition"#>'{character,persona}', 'approvedFacts', "definition"->'approvedFacts',
 'constraints', "definition"->'constraints')
FROM "Scenario" WHERE "slug" = 'the-trust-conversation' AND "version" = 1;
CREATE FUNCTION persona_localization_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Localization revisions are immutable; create a new version.' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "ScenarioLocalization_immutable" BEFORE UPDATE OR DELETE ON "ScenarioLocalization"
 FOR EACH ROW EXECUTE FUNCTION persona_localization_immutable();
COMMIT;
