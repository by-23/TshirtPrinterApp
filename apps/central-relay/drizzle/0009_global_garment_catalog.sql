CREATE TABLE "global_garment_catalog" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
