CREATE TABLE "access_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"max_uses" integer NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "access_codes_uses_check" CHECK (max_uses > 0 AND uses_count >= 0 AND uses_count <= max_uses)
);
--> statement-breakpoint
ALTER TABLE "access_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_code_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_codes_code_hash_uq" ON "access_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "access_codes_university_idx" ON "access_codes" USING btree ("university_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_access_code_id_access_codes_id_fk" FOREIGN KEY ("access_code_id") REFERENCES "public"."access_codes"("id") ON DELETE no action ON UPDATE no action;