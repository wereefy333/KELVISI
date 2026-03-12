ALTER TABLE "Master" ADD COLUMN "userId" TEXT;

UPDATE "Master" AS m
SET "userId" = u."id"
FROM "User" AS u
WHERE u."role" = 'MASTER'
  AND u."name" = m."name"
  AND m."userId" IS NULL;

CREATE UNIQUE INDEX "Master_userId_key" ON "Master"("userId");

ALTER TABLE "Master"
ADD CONSTRAINT "Master_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
