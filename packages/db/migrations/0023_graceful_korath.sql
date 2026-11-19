CREATE TABLE "admin_google_auth_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"surface" varchar(16) NOT NULL,
	"email" varchar(255) NOT NULL,
	"university_id" uuid,
	"at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_google_auth_contexts_surface_check" CHECK (surface IN ('admin', 'web'))
);
--> statement-breakpoint
ALTER TABLE "admin_google_auth_contexts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_invitation_oauth_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" uuid NOT NULL,
	"start_ticket_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"start_consumed_at" timestamp with time zone,
	"pending_user_id" uuid,
	"transfer_code_hash" varchar(64),
	"transfer_expires_at" timestamp with time zone,
	"transfer_consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_invitation_oauth_start_ticket_hash_check" CHECK ("admin_invitation_oauth_transactions"."start_ticket_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_invitation_oauth_transfer_code_hash_check" CHECK ("admin_invitation_oauth_transactions"."transfer_code_hash" IS NULL OR "admin_invitation_oauth_transactions"."transfer_code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_invitation_oauth_transfer_state_check" CHECK (("admin_invitation_oauth_transactions"."transfer_code_hash" IS NULL AND "admin_invitation_oauth_transactions"."transfer_expires_at" IS NULL AND "admin_invitation_oauth_transactions"."transfer_consumed_at" IS NULL) OR ("admin_invitation_oauth_transactions"."transfer_code_hash" IS NOT NULL AND "admin_invitation_oauth_transactions"."transfer_expires_at" IS NOT NULL AND "admin_invitation_oauth_transactions"."pending_user_id" IS NOT NULL)),
	CONSTRAINT "admin_invitation_oauth_pending_user_state_check" CHECK ("admin_invitation_oauth_transactions"."pending_user_id" IS NULL OR "admin_invitation_oauth_transactions"."start_consumed_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "admin_invitation_oauth_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_super_login_oauth_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_ticket_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"start_consumed_at" timestamp with time zone,
	"user_id" uuid,
	"transfer_code_hash" varchar(64),
	"transfer_expires_at" timestamp with time zone,
	"transfer_consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_super_login_oauth_start_ticket_hash_check" CHECK ("admin_super_login_oauth_transactions"."start_ticket_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_super_login_oauth_transfer_code_hash_check" CHECK ("admin_super_login_oauth_transactions"."transfer_code_hash" IS NULL OR "admin_super_login_oauth_transactions"."transfer_code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "admin_super_login_oauth_transfer_state_check" CHECK (("admin_super_login_oauth_transactions"."transfer_code_hash" IS NULL AND "admin_super_login_oauth_transactions"."transfer_expires_at" IS NULL AND "admin_super_login_oauth_transactions"."transfer_consumed_at" IS NULL) OR ("admin_super_login_oauth_transactions"."transfer_code_hash" IS NOT NULL AND "admin_super_login_oauth_transactions"."transfer_expires_at" IS NOT NULL AND "admin_super_login_oauth_transactions"."user_id" IS NOT NULL)),
	CONSTRAINT "admin_super_login_oauth_user_state_check" CHECK ("admin_super_login_oauth_transactions"."user_id" IS NULL OR "admin_super_login_oauth_transactions"."start_consumed_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "admin_super_login_oauth_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_google_auth_contexts" ADD CONSTRAINT "admin_google_auth_contexts_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitation_oauth_transactions" ADD CONSTRAINT "admin_invitation_oauth_transactions_invitation_id_admin_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."admin_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitation_oauth_transactions" ADD CONSTRAINT "admin_invitation_oauth_transactions_pending_user_id_users_id_fk" FOREIGN KEY ("pending_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_super_login_oauth_transactions" ADD CONSTRAINT "admin_super_login_oauth_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_google_auth_contexts_account_surface_uq" ON "admin_google_auth_contexts" USING btree ("provider_account_id","surface");--> statement-breakpoint
CREATE INDEX "admin_google_auth_contexts_expires_at_idx" ON "admin_google_auth_contexts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitation_oauth_start_ticket_hash_uq" ON "admin_invitation_oauth_transactions" USING btree ("start_ticket_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitation_oauth_transfer_code_hash_uq" ON "admin_invitation_oauth_transactions" USING btree ("transfer_code_hash") WHERE "admin_invitation_oauth_transactions"."transfer_code_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_invitation_oauth_invitation_expires_idx" ON "admin_invitation_oauth_transactions" USING btree ("invitation_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_super_login_oauth_start_ticket_hash_uq" ON "admin_super_login_oauth_transactions" USING btree ("start_ticket_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_super_login_oauth_transfer_code_hash_uq" ON "admin_super_login_oauth_transactions" USING btree ("transfer_code_hash") WHERE "admin_super_login_oauth_transactions"."transfer_code_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_super_login_oauth_expires_at_idx" ON "admin_super_login_oauth_transactions" USING btree ("expires_at");