ALTER TABLE "program_cycles" ADD COLUMN "years_count" integer;
--> statement-breakpoint
UPDATE "program_cycles" AS pc
SET "years_count" = c."years_count"
FROM "cycles" AS c
WHERE c."id" = pc."cycle_id"
  AND c."university_id" = pc."university_id";
--> statement-breakpoint
ALTER TABLE "program_cycles" ALTER COLUMN "years_count" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "program_cycles" ADD CONSTRAINT "program_cycles_years_count_range" CHECK ("years_count" >= 1 AND "years_count" <= 10);
--> statement-breakpoint
ALTER TABLE "cycles" ALTER COLUMN "years_count" DROP NOT NULL;
