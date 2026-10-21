DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "users"
		GROUP BY lower(btrim("email"))
		HAVING count(*) > 1
	) THEN
		RAISE EXCEPTION 'Cannot normalize users.email: duplicate emails after trim and lowercase';
	END IF;
END
$$;
--> statement-breakpoint
UPDATE "users"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_unique" ON "users" USING btree (lower("email"));
