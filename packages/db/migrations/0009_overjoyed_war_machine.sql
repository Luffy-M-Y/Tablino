CREATE TYPE "public"."plan" AS ENUM('premium_pro', 'premium_pro_max');--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "plan" "plan";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "university_id" uuid;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "share_bps" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "university_amount" integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "platform_amount" integer;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "revenue_share_bps" integer DEFAULT 3000 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_plan" "plan";--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_university_idx" ON "subscriptions" USING btree ("university_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_split_check" CHECK ((plan IS NULL AND university_id IS NULL AND share_bps IS NULL AND university_amount IS NULL AND platform_amount IS NULL) OR (plan IS NOT NULL AND university_id IS NOT NULL AND share_bps IS NOT NULL AND university_amount IS NOT NULL AND platform_amount IS NOT NULL AND share_bps >= 0 AND share_bps <= 10000 AND university_amount >= 0 AND platform_amount >= 0 AND university_amount + platform_amount = amount));--> statement-breakpoint
ALTER TABLE "universities" ADD CONSTRAINT "universities_revenue_share_check" CHECK (revenue_share_bps >= 0 AND revenue_share_bps <= 10000);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_trial_pair_check" CHECK ((trial_started_at IS NULL) = (trial_ends_at IS NULL));