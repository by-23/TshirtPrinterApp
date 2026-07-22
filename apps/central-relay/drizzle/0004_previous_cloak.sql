CREATE TYPE "public"."catalog_manual_category" AS ENUM('memes', 'anime_movies', 'games');--> statement-breakpoint
CREATE TYPE "public"."catalog_manual_point_status" AS ENUM('pending', 'applied', 'error');--> statement-breakpoint
CREATE TABLE "catalog_manual_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "catalog_manual_category" NOT NULL,
	"title" text NOT NULL,
	"content_hash" text NOT NULL,
	"storage_path" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "catalog_manual_point_state" (
	"point_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"applied_revision" integer DEFAULT 0 NOT NULL,
	"status" "catalog_manual_point_status" DEFAULT 'pending' NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_manual_point_state_point_id_design_id_pk" PRIMARY KEY("point_id","design_id")
);
--> statement-breakpoint
ALTER TABLE "catalog_manual_point_state" ADD CONSTRAINT "catalog_manual_point_state_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_manual_point_state" ADD CONSTRAINT "catalog_manual_point_state_design_id_catalog_manual_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."catalog_manual_designs"("id") ON DELETE cascade ON UPDATE no action;