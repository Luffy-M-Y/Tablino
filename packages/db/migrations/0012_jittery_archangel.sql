CREATE TYPE "public"."university_status" AS ENUM('pending', 'active');--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "status" "university_status" DEFAULT 'active' NOT NULL;