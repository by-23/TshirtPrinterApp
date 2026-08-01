CREATE TYPE "public"."managed_font_kind" AS ENUM('system', 'local', 'google', 'custom');--> statement-breakpoint
CREATE TYPE "public"."managed_font_format" AS ENUM('truetype', 'opentype', 'woff', 'woff2');--> statement-breakpoint
CREATE TABLE "managed_fonts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"family" text NOT NULL,
	"kind" "managed_font_kind" NOT NULL,
	"google_family" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"storage_path" text,
	"format" "managed_font_format",
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
