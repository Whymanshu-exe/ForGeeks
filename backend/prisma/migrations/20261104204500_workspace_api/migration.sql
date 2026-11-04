-- Expand ticket lifecycle states while preserving existing records.
ALTER TYPE "TicketStatus" ADD VALUE 'TRIAGED';
ALTER TYPE "TicketStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "TicketStatus" ADD VALUE 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';

UPDATE "Ticket" SET "status" = 'RESOLVED' WHERE "status" = 'DONE';

ALTER TABLE "Project" ADD COLUMN "nextTicketNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Ticket" ADD COLUMN "ticketKey" TEXT;
ALTER TABLE "Ticket" ADD COLUMN "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Ticket" ADD COLUMN "githubUrl" TEXT;

WITH numbered_tickets AS (
  SELECT
    ticket."id",
    project."key" || '-' || ROW_NUMBER() OVER (
      PARTITION BY ticket."projectId"
      ORDER BY ticket."createdAt", ticket."id"
    ) AS ticket_key
  FROM "Ticket" AS ticket
  JOIN "Project" AS project ON project."id" = ticket."projectId"
)
UPDATE "Ticket" AS ticket
SET "ticketKey" = numbered_tickets.ticket_key
FROM numbered_tickets
WHERE ticket."id" = numbered_tickets."id";

UPDATE "Project" AS project
SET "nextTicketNumber" = counts.ticket_count + 1
FROM (
  SELECT "projectId", COUNT(*)::INTEGER AS ticket_count
  FROM "Ticket"
  GROUP BY "projectId"
) AS counts
WHERE project."id" = counts."projectId";

ALTER TABLE "Ticket" ALTER COLUMN "ticketKey" SET NOT NULL;
CREATE UNIQUE INDEX "Ticket_projectId_ticketKey_key" ON "Ticket"("projectId", "ticketKey");

CREATE TABLE "Activity" (
  "id" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "ticketId" UUID,
  "action" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Activity_workspaceId_createdAt_idx" ON "Activity"("workspaceId", "createdAt");
CREATE INDEX "Activity_ticketId_createdAt_idx" ON "Activity"("ticketId", "createdAt");
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
