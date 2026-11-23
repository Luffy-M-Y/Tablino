CREATE TYPE "public"."university_visibility" AS ENUM('private', 'public');--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "visibility" "university_visibility" DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "locality" varchar(60);--> statement-breakpoint
ALTER TABLE "universities" ADD CONSTRAINT "universities_locality_not_blank_check" CHECK (locality IS NULL OR length(btrim(locality)) > 0);