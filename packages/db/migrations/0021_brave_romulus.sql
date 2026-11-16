ALTER TABLE "users" DROP CONSTRAINT "users_role_university_scope_check";--> statement-breakpoint
ALTER TYPE "public"."role" RENAME VALUE 'super_admin_editor' TO 'super_admin_lector';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'super_admin_editor' BEFORE 'super_admin_lector';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_university_scope_check" CHECK (("users"."role"::text IN ('super_admin', 'super_admin_editor', 'super_admin_lector') AND "users"."university_id" IS NULL) OR ("users"."role"::text NOT IN ('super_admin', 'super_admin_editor', 'super_admin_lector') AND "users"."university_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "super_admin_editor_invitations" RENAME TO "admin_invitations";--> statement-breakpoint
ALTER TABLE "admin_invitations" DROP CONSTRAINT "super_admin_editor_invitations_email_normalized_check";--> statement-breakpoint
ALTER TABLE "admin_invitations" DROP CONSTRAINT "super_admin_editor_invitations_token_hash_check";--> statement-breakpoint
ALTER TABLE "admin_invitations" DROP CONSTRAINT "super_admin_editor_invitations_acceptance_check";--> statement-breakpoint
ALTER TABLE "admin_invitations" DROP CONSTRAINT "super_admin_editor_invitations_invited_by_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "admin_invitations" DROP CONSTRAINT "super_admin_editor_invitations_accepted_user_id_users_id_fk";--> statement-breakpoint
DROP INDEX "super_admin_editor_invitations_token_hash_uq";--> statement-breakpoint
DROP INDEX "super_admin_editor_invitations_accepted_user_uq";--> statement-breakpoint
DROP INDEX "super_admin_editor_invitations_pending_email_uq";--> statement-breakpoint
DROP INDEX "super_admin_editor_invitations_expires_at_idx";--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_token_hash_uq" ON "admin_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_accepted_user_uq" ON "admin_invitations" USING btree ("accepted_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_invitations_pending_email_uq" ON "admin_invitations" USING btree (lower("email")) WHERE "admin_invitations"."consumed_at" IS NULL AND "admin_invitations"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "admin_invitations_expires_at_idx" ON "admin_invitations" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD COLUMN "role" "public"."role";--> statement-breakpoint
UPDATE "admin_invitations" SET "role" = 'super_admin_lector';--> statement-breakpoint
ALTER TABLE "admin_invitations" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_role_check" CHECK ("admin_invitations"."role"::text IN ('super_admin_editor', 'super_admin_lector'));--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_email_normalized_check" CHECK (("admin_invitations"."email" = lower(btrim("admin_invitations"."email"))));--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_token_hash_check" CHECK (("admin_invitations"."token_hash" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD CONSTRAINT "admin_invitations_acceptance_check" CHECK (("admin_invitations"."accepted_user_id" IS NULL OR "admin_invitations"."consumed_at" IS NOT NULL));--> statement-breakpoint
DO $$
DECLARE
  super_admin_count bigint;
BEGIN
  SELECT count(*) INTO super_admin_count
  FROM public.users
  WHERE role::text = 'super_admin';

  IF super_admin_count > 1 THEN
    RAISE EXCEPTION 'Cannot create users_single_super_admin_uq: found % super_admin rows', super_admin_count;
  END IF;
END
$$;--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_super_admin_uq" ON "users" USING btree ("role") WHERE "users"."role" = 'super_admin';--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.protect_super_admin_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.role::text = 'super_admin'
     AND COALESCE(current_setting('tablino.operator_override', true), '') <> 'on'
  THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete the super_admin account without operator override';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
    THEN
      RAISE EXCEPTION 'Cannot change the super_admin role or revoked_at without operator override';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "users_protect_super_admin_identity"
BEFORE UPDATE OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_super_admin_identity();
