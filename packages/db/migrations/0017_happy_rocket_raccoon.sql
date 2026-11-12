CREATE TABLE "oauth_start_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"ticket_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_start_tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_start_tickets" ADD CONSTRAINT "oauth_start_tickets_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_start_tickets_ticket_hash_uq" ON "oauth_start_tickets" USING btree ("ticket_hash");