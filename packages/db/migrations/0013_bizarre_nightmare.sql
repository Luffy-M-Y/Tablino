ALTER TYPE "public"."university_status" ADD VALUE 'approved' BEFORE 'active';--> statement-breakpoint
CREATE TABLE "university_payout_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"mobile_money_operator" text NOT NULL,
	"mobile_money_holder_name" text NOT NULL,
	"mobile_money_number_encrypted" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "university_payout_details_university_id_uq" UNIQUE("university_id")
);
--> statement-breakpoint
ALTER TABLE "university_payout_details" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "acronym" varchar(20);--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "university_payout_details" ADD CONSTRAINT "university_payout_details_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;