CREATE TABLE "super_admin_editor_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"accepted_user_id" uuid,
	CONSTRAINT "super_admin_editor_invitations_email_normalized_check" CHECK (("super_admin_editor_invitations"."email" = lower(btrim("super_admin_editor_invitations"."email")))),
	CONSTRAINT "super_admin_editor_invitations_token_hash_check" CHECK (("super_admin_editor_invitations"."token_hash" ~ '^[0-9a-f]{64}$')),
	CONSTRAINT "super_admin_editor_invitations_acceptance_check" CHECK (("super_admin_editor_invitations"."accepted_user_id" IS NULL OR "super_admin_editor_invitations"."consumed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "super_admin_editor_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_role_university_scope_check";--> statement-breakpoint
ALTER TABLE "super_admin_editor_invitations" ADD CONSTRAINT "super_admin_editor_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "super_admin_editor_invitations" ADD CONSTRAINT "super_admin_editor_invitations_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "super_admin_editor_invitations_token_hash_uq" ON "super_admin_editor_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "super_admin_editor_invitations_accepted_user_uq" ON "super_admin_editor_invitations" USING btree ("accepted_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "super_admin_editor_invitations_pending_email_uq" ON "super_admin_editor_invitations" USING btree (lower("email")) WHERE "super_admin_editor_invitations"."consumed_at" IS NULL AND "super_admin_editor_invitations"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "super_admin_editor_invitations_expires_at_idx" ON "super_admin_editor_invitations" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_university_scope_check" CHECK (("users"."role"::text IN ('super_admin', 'super_admin_editor') AND "users"."university_id" IS NULL) OR ("users"."role"::text NOT IN ('super_admin', 'super_admin_editor') AND "users"."university_id" IS NOT NULL));