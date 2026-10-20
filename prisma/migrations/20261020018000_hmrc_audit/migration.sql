-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "action" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AuditLog" ADD COLUMN "resourceType" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "resourceId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "beforeData" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "afterData" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "prevHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entryHash" TEXT;

UPDATE "AuditLog" SET "action" = "actionType" WHERE "action" = '';

CREATE INDEX "AuditLog_resourceType_resourceId_idx" ON "AuditLog"("resourceType", "resourceId");
CREATE INDEX "AuditLog_actionType_createdAt_idx" ON "AuditLog"("actionType", "createdAt");

CREATE OR REPLACE FUNCTION forbid_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON "AuditLog";
DROP TRIGGER IF EXISTS audit_log_no_delete ON "AuditLog";

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();
