CREATE TYPE "public"."design_category" AS ENUM('memes', 'anime_movies', 'games', 'text', 'custom', 'ai_style');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'accepted', 'printing', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."point_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."upload_mode" AS ENUM('relay', 'wifi');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "catalog_master" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "design_category" NOT NULL,
	"title" text NOT NULL,
	"image_url" text DEFAULT '' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_price_config" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders_archive" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"point_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"garment_type" text NOT NULL,
	"print_size" text NOT NULL,
	"price" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_price_overrides" (
	"point_id" uuid PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "point_status" DEFAULT 'closed' NOT NULL,
	"upload_mode" "upload_mode" DEFAULT 'relay' NOT NULL,
	"operator_login" text NOT NULL,
	"operator_password_hash" text NOT NULL,
	"sync_token" text NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_sync_token_unique" UNIQUE("sync_token")
);
--> statement-breakpoint
ALTER TABLE "orders_archive" ADD CONSTRAINT "orders_archive_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_price_overrides" ADD CONSTRAINT "point_price_overrides_point_id_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."points"("id") ON DELETE cascade ON UPDATE no action;