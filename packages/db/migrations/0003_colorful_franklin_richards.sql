CREATE TABLE "cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"short_code" varchar(10) NOT NULL,
	"years_count" integer NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cycles_id_university_uq" UNIQUE("id","university_id"),
	CONSTRAINT "cycles_university_short_code_uq" UNIQUE("university_id","short_code"),
	CONSTRAINT "cycles_years_count_range" CHECK ("cycles"."years_count" >= 1 AND "cycles"."years_count" <= 10),
	CONSTRAINT "cycles_short_code_letters" CHECK ("cycles"."short_code" ~ '^[A-Za-z]+$')
);
--> statement-breakpoint
ALTER TABLE "cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "program_cycles" (
	"program_id" uuid NOT NULL,
	"university_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	CONSTRAINT "program_cycles_pk" PRIMARY KEY("program_id","cycle_id")
);
--> statement-breakpoint
ALTER TABLE "program_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "levels" ADD COLUMN "cycle_id" uuid;--> statement-breakpoint
ALTER TABLE "levels" ADD COLUMN "year_number" integer;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_cycles" ADD CONSTRAINT "program_cycles_program_fk" FOREIGN KEY ("program_id","university_id") REFERENCES "public"."programs"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_cycles" ADD CONSTRAINT "program_cycles_cycle_fk" FOREIGN KEY ("cycle_id","university_id") REFERENCES "public"."cycles"("id","university_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cycles_university_idx" ON "cycles" USING btree ("university_id");--> statement-breakpoint
CREATE INDEX "program_cycles_university_idx" ON "program_cycles" USING btree ("university_id");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_cycle_university_fk" FOREIGN KEY ("cycle_id","university_id") REFERENCES "public"."cycles"("id","university_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_program_cycle_fk" FOREIGN KEY ("program_id","cycle_id") REFERENCES "public"."program_cycles"("program_id","cycle_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "levels_cycle_idx" ON "levels" USING btree ("cycle_id");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_program_cycle_year_uq" UNIQUE("program_id","cycle_id","year_number");--> statement-breakpoint
ALTER TABLE "levels" ADD CONSTRAINT "levels_year_number_min" CHECK ("levels"."year_number" >= 1);

-- Remplissage générique : un cycle par université (basé sur les levels existants)
INSERT INTO "cycles" ("university_id", "name", "short_code", "years_count", "order")
SELECT DISTINCT "university_id", 'Licence', 'L', GREATEST(3, MAX("order") OVER (PARTITION BY "university_id")), 1
FROM "levels"
ON CONFLICT ("university_id", "short_code") DO NOTHING;--> statement-breakpoint

-- Associer chaque programme à son cycle
INSERT INTO "program_cycles" ("program_id", "university_id", "cycle_id")
SELECT DISTINCT l."program_id", l."university_id", c."id"
FROM "levels" l
JOIN "cycles" c ON c."university_id" = l."university_id" AND c."short_code" = 'L'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Remplir cycle_id et year_number depuis order
UPDATE "levels" l
SET
  "cycle_id"    = c."id",
  "year_number" = l."order"
FROM "cycles" c
WHERE c."university_id" = l."university_id" AND c."short_code" = 'L';--> statement-breakpoint

-- Passer les colonnes NOT NULL
ALTER TABLE "levels" ALTER COLUMN "cycle_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "levels" ALTER COLUMN "year_number" SET NOT NULL;