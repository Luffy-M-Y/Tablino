CREATE TABLE "university_logos" (
	"university_id" uuid PRIMARY KEY NOT NULL,
	"image" "bytea" NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "university_logos_image_size_check" CHECK (octet_length(image) BETWEEN 1 AND 262144)
);
--> statement-breakpoint
ALTER TABLE "university_logos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "university_logos" ADD CONSTRAINT "university_logos_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;