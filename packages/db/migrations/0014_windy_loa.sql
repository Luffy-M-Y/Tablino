ALTER TABLE "university_payout_details" ADD COLUMN "contract_version" text NOT NULL;--> statement-breakpoint
ALTER TABLE "university_payout_details" ADD COLUMN "contract_accepted_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "university_payout_details" ADD COLUMN "accepted_share_bps" integer NOT NULL;