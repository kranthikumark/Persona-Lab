-- CreateTable
CREATE TABLE "ScenarioSourceAsset" (
    "id" TEXT NOT NULL,
    "ownerHash" TEXT NOT NULL,
    "draftId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "originalName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT,
    "durationMs" INTEGER,
    "locale" TEXT NOT NULL,
    "consent" JSONB NOT NULL,
    "failureReason" TEXT,
    "processingUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScenarioSourceAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceTranscript" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "translation" TEXT,
    "locale" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "basedOnVersion" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScenarioSourceAsset_ownerHash_draftId_idx" ON "ScenarioSourceAsset"("ownerHash", "draftId");

-- CreateIndex
CREATE INDEX "ScenarioSourceAsset_expiresAt_status_idx" ON "ScenarioSourceAsset"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SourceTranscript_assetId_version_key" ON "SourceTranscript"("assetId", "version");

-- AddForeignKey
ALTER TABLE "ScenarioSourceAsset" ADD CONSTRAINT "ScenarioSourceAsset_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ScenarioDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceTranscript" ADD CONSTRAINT "SourceTranscript_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ScenarioSourceAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transcript edits create a new version. Erasure still deletes every version.
CREATE FUNCTION reject_source_transcript_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Source transcripts are versioned; create a new version';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER source_transcript_immutable
BEFORE UPDATE ON "SourceTranscript"
FOR EACH ROW EXECUTE FUNCTION reject_source_transcript_update();
