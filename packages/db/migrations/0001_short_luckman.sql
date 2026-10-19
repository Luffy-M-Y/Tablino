-- Étape 1 : ajouter la colonne nullable
ALTER TABLE "levels" ADD COLUMN "slug" varchar(100);
--> statement-breakpoint

-- Étape 2 : remplir depuis name (minuscules, espaces → tirets)
UPDATE "levels" SET "slug" = lower(regexp_replace("name", '\s+', '-', 'g'));
--> statement-breakpoint

-- Étape 3 : passer NOT NULL
ALTER TABLE "levels" ALTER COLUMN "slug" SET NOT NULL;
--> statement-breakpoint

-- Étape 4 : unicité (program_id, slug)
ALTER TABLE "levels" ADD CONSTRAINT "levels_program_slug_uq" UNIQUE("program_id","slug");
