CREATE TABLE "ScenarioDraft" (
 "id" TEXT NOT NULL PRIMARY KEY, "ownerHash" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'draft',
 "content" JSONB NOT NULL, "review" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ScenarioDraft_ownerHash_expiresAt_idx" ON "ScenarioDraft"("ownerHash", "expiresAt");
CREATE TABLE "ScenarioPublication" (
 "id" TEXT NOT NULL PRIMARY KEY, "scenarioId" TEXT NOT NULL,
 "draftId" TEXT NOT NULL, "draftRevision" INTEGER NOT NULL, "contentHash" TEXT NOT NULL,
 "review" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ScenarioPublication_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "ScenarioPublication_scenarioId_key" ON "ScenarioPublication"("scenarioId");
CREATE UNIQUE INDEX "ScenarioPublication_draftId_draftRevision_key" ON "ScenarioPublication"("draftId", "draftRevision");
CREATE FUNCTION protect_scenario_publication() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Published scenario versions and review records are immutable'; END; $$;
CREATE TRIGGER immutable_scenario_publication BEFORE UPDATE OR DELETE ON "ScenarioPublication" FOR EACH ROW EXECUTE FUNCTION protect_scenario_publication();
CREATE FUNCTION protect_published_scenario() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "ScenarioPublication" WHERE "scenarioId" = OLD."id") THEN
  RAISE EXCEPTION 'Published scenario versions are immutable';
 END IF;
 RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER immutable_published_scenario BEFORE UPDATE OR DELETE ON "Scenario" FOR EACH ROW EXECUTE FUNCTION protect_published_scenario();
