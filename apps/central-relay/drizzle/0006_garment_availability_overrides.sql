CREATE TABLE "point_garment_availability_overrides" (
	"point_id" uuid PRIMARY KEY NOT NULL,
	"availability" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "point_garment_availability_overrides" ADD CONSTRAINT "point_garment_availability_overrides_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;
