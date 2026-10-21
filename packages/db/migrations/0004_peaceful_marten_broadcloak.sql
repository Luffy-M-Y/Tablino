ALTER TABLE "verification_tokens" DROP CONSTRAINT "verification_tokens_token_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text USING "role"::text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('super_admin', 'university_admin', 'student');--> statement-breakpoint
UPDATE "users"
SET "role" = CASE "role"
  WHEN 'admin' THEN 'university_admin'
  WHEN 'scanner' THEN 'student'
  ELSE "role"
END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING "role"::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'student'::"public"."role";--> statement-breakpoint
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_pk" PRIMARY KEY("identifier","token");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_provider_provider_account_id_uq" UNIQUE("provider","provider_account_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_university_scope_check" CHECK (("users"."role" = 'super_admin' AND "users"."university_id" IS NULL) OR ("users"."role" <> 'super_admin' AND "users"."university_id" IS NOT NULL));
