CREATE TABLE "admin_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_setups" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_type_id" integer NOT NULL,
	"name" text NOT NULL,
	"max_guests" integer NOT NULL,
	"price_per_night" numeric(10, 2) NOT NULL,
	"on_request" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
-- Existing staff rows (if any) get a username made from their email or id first.
ALTER TABLE "admin_users" ADD COLUMN "username" text;--> statement-breakpoint
UPDATE "admin_users" SET "username" = lower(coalesce(split_part("email", '@', 1), 'user') || '.' || "id") WHERE "username" IS NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "side_options" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "page_content" ADD COLUMN "subtitle" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "page_content" ADD COLUMN "sections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_setups" ADD CONSTRAINT "room_setups_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_username_unique" UNIQUE("username");--> statement-breakpoint
-- Backfill so existing data keeps working without re-seeding:
-- every room type gets one setup with its current price, and page text becomes one section.
INSERT INTO "room_setups" ("room_type_id", "name", "max_guests", "price_per_night", "sort_order")
SELECT "id", 'Standard', "max_guests", "price_per_night", 1 FROM "room_types" rt
WHERE NOT EXISTS (SELECT 1 FROM "room_setups" s WHERE s."room_type_id" = rt."id");--> statement-breakpoint
UPDATE "page_content" SET "sections" = jsonb_build_array(jsonb_build_object('heading', '', 'body', "body"))
WHERE "sections" = '[]'::jsonb AND "body" <> '';
