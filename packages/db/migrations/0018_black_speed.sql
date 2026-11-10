CREATE TABLE "oauth_transfer_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_transfer_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_transfer_codes" ADD CONSTRAINT "oauth_transfer_codes_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_transfer_codes" ADD CONSTRAINT "oauth_transfer_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_transfer_codes_code_hash_uq" ON "oauth_transfer_codes" USING btree ("code_hash");