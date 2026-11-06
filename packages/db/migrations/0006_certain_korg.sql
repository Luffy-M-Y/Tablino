ALTER TABLE "programs" ADD COLUMN "status" "status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
UPDATE "programs" SET "status" = 'published';--> statement-breakpoint
ALTER TABLE "levels" DROP COLUMN "order";
