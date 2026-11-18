CREATE TABLE "admin_invitation_alert_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_invitation_alert_outbox_status_check" CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
	CONSTRAINT "admin_invitation_alert_outbox_attempts_check" CHECK (attempts >= 0 AND attempts <= 3)
);
--> statement-breakpoint
ALTER TABLE "admin_invitation_alert_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_invitation_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid,
	"invited_by_user_id" uuid NOT NULL,
	"inviter_email" varchar(255) NOT NULL,
	"invited_email" varchar(255) NOT NULL,
	"role" "role" NOT NULL,
	"client_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_invitation_audit_role_check" CHECK ("admin_invitation_audit"."role"::text IN ('super_admin_editor', 'super_admin_lector'))
);
--> statement-breakpoint
ALTER TABLE "admin_invitation_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_invitation_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invitation_codes_attempts_check" CHECK (attempts >= 0 AND attempts <= 5)
);
--> statement-breakpoint
ALTER TABLE "admin_invitation_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_invitation_alert_outbox" ADD CONSTRAINT "admin_invitation_alert_outbox_audit_id_admin_invitation_audit_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."admin_invitation_audit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitation_audit" ADD CONSTRAINT "admin_invitation_audit_invitation_id_admin_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."admin_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitation_audit" ADD CONSTRAINT "admin_invitation_audit_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitation_codes" ADD CONSTRAINT "admin_invitation_codes_invitation_id_admin_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."admin_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitation_alert_outbox_audit_recipient_uq" ON "admin_invitation_alert_outbox" USING btree ("audit_id","recipient_email");--> statement-breakpoint
CREATE INDEX "admin_invitation_alert_outbox_due_idx" ON "admin_invitation_alert_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "admin_invitation_alert_outbox_expires_at_idx" ON "admin_invitation_alert_outbox" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitation_audit_invitation_uq" ON "admin_invitation_audit" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX "admin_invitation_audit_inviter_created_idx" ON "admin_invitation_audit" USING btree ("invited_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_invitation_audit_expires_at_idx" ON "admin_invitation_audit" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitation_codes_invitation_uq" ON "admin_invitation_codes" USING btree ("invitation_id");