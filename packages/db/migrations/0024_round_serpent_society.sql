CREATE TABLE "admin_revocation_alert_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_revocation_alert_outbox_status_check" CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
	CONSTRAINT "admin_revocation_alert_outbox_attempts_check" CHECK (attempts >= 0 AND attempts <= 3)
);
--> statement-breakpoint
ALTER TABLE "admin_revocation_alert_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_revocation_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"revoked_user_id" uuid,
	"revoked_by_user_id" uuid,
	"revoked_email" varchar(255) NOT NULL,
	"revoker_email" varchar(255) NOT NULL,
	"revoked_role" "role" NOT NULL,
	"revoker_role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_revocation_audit_revoked_role_check" CHECK ("admin_revocation_audit"."revoked_role"::text IN ('super_admin_editor', 'super_admin_lector')),
	CONSTRAINT "admin_revocation_audit_revoker_role_check" CHECK ("admin_revocation_audit"."revoker_role"::text IN ('super_admin', 'super_admin_editor'))
);
--> statement-breakpoint
ALTER TABLE "admin_revocation_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_revocation_alert_outbox" ADD CONSTRAINT "admin_revocation_alert_outbox_audit_id_admin_revocation_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."admin_revocation_audit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_revocation_audit" ADD CONSTRAINT "admin_revocation_audit_revoked_user_id_users_id_fk" FOREIGN KEY ("revoked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_revocation_audit" ADD CONSTRAINT "admin_revocation_audit_revoked_by_user_id_users_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_revocation_alert_outbox_audit_recipient_uq" ON "admin_revocation_alert_outbox" USING btree ("audit_id","recipient_email");--> statement-breakpoint
CREATE INDEX "admin_revocation_alert_outbox_due_idx" ON "admin_revocation_alert_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "admin_revocation_alert_outbox_expires_at_idx" ON "admin_revocation_alert_outbox" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "admin_revocation_audit_revoker_created_idx" ON "admin_revocation_audit" USING btree ("revoked_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_revocation_audit_expires_at_idx" ON "admin_revocation_audit" USING btree ("expires_at");