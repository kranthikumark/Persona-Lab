-- Normalize older local counters without resetting usage counts.
UPDATE "RateLimitBucket"
SET "expiresAt" = LEAST("expiresAt", timezone('UTC', NOW()) + INTERVAL '60 seconds')
WHERE "key" = 'creation:global';

UPDATE "RateLimitBucket"
SET "expiresAt" = LEAST("expiresAt", timezone('UTC', NOW()) + INTERVAL '1 hour')
WHERE "key" LIKE '%:generation:%';
