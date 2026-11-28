CREATE TABLE "admin_totp" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_encrypted" text NOT NULL,
	"enabled_at" timestamp,
	"last_used_step" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_totp" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_totp_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_totp_recovery_codes_user_hash_uq" UNIQUE("user_id","code_hash")
);
--> statement-breakpoint
ALTER TABLE "admin_totp_recovery_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_totp" ADD CONSTRAINT "admin_totp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_totp_recovery_codes" ADD CONSTRAINT "admin_totp_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;