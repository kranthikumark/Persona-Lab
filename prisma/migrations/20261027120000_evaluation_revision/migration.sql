-- One immutable report per branch revision and rubric version.
CREATE UNIQUE INDEX "Evaluation_branchId_branchRevision_rubricVersion_key" ON "Evaluation"("branchId", "branchRevision", "rubricVersion");
