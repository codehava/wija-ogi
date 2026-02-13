CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"description" text,
	"target_id" uuid,
	"target_type" varchar(20),
	"performed_by" uuid,
	"performed_by_name" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"tree_name" varchar(255),
	"email" varchar(255) NOT NULL,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"invited_by" uuid,
	"invited_by_name" varchar(255),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"gedcom_id" varchar(50),
	"person_id" uuid,
	"file_path" varchar(500),
	"file_type" varchar(50),
	"title" varchar(255),
	"s3_key" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"gedcom_id" varchar(50),
	"first_name" varchar(255) NOT NULL,
	"middle_name" varchar(255),
	"last_name" varchar(255) NOT NULL,
	"full_name" varchar(500),
	"lontara_first_name" text,
	"lontara_middle_name" text,
	"lontara_last_name" text,
	"lontara_first_name_custom" text,
	"lontara_middle_name_custom" text,
	"lontara_last_name_custom" text,
	"gender" varchar(10) DEFAULT 'unknown' NOT NULL,
	"birth_date" varchar(20),
	"birth_place" varchar(500),
	"birth_place_lontara" text,
	"birth_order" integer,
	"death_date" varchar(20),
	"death_place" varchar(500),
	"death_place_lontara" text,
	"is_living" boolean DEFAULT true,
	"occupation" varchar(255),
	"title" varchar(50),
	"reign_title" varchar(255),
	"biography" text,
	"spouse_ids" jsonb DEFAULT '[]'::jsonb,
	"parent_ids" jsonb DEFAULT '[]'::jsonb,
	"child_ids" jsonb DEFAULT '[]'::jsonb,
	"sibling_ids" jsonb DEFAULT '[]'::jsonb,
	"is_root_ancestor" boolean DEFAULT false,
	"position_x" real DEFAULT 0,
	"position_y" real DEFAULT 0,
	"position_fixed" boolean DEFAULT false,
	"photo_url" varchar(500),
	"thumbnail_url" varchar(500),
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"gedcom_family_id" varchar(50),
	"type" varchar(20) NOT NULL,
	"person1_id" uuid NOT NULL,
	"person2_id" uuid NOT NULL,
	"marriage_date" varchar(20),
	"marriage_place" varchar(500),
	"marriage_place_lontara" text,
	"marriage_status" varchar(20),
	"marriage_order" integer,
	"biological_parent" boolean DEFAULT true,
	"divorce_date" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"gedcom_id" varchar(50),
	"title" text NOT NULL,
	"author" text,
	"publisher" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tree_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'viewer' NOT NULL,
	"display_name" varchar(255),
	"linked_person_id" uuid,
	"joined_at" timestamp DEFAULT now(),
	"invited_by" uuid,
	"last_active_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"slug" varchar(255),
	"owner_id" uuid,
	"root_ancestor_id" uuid,
	"script_mode" varchar(10) DEFAULT 'both',
	"theme" varchar(10) DEFAULT 'light',
	"language" varchar(5) DEFAULT 'id',
	"plan" varchar(20) DEFAULT 'free',
	"plan_status" varchar(20) DEFAULT 'active',
	"member_count" integer DEFAULT 0,
	"person_count" integer DEFAULT 0,
	"relationship_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "trees_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"image" varchar(500),
	"password_hash" varchar(255),
	"preferred_script" varchar(10) DEFAULT 'both',
	"preferred_theme" varchar(10) DEFAULT 'light',
	"preferred_language" varchar(5) DEFAULT 'id',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person1_id_persons_id_fk" FOREIGN KEY ("person1_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person2_id_persons_id_fk" FOREIGN KEY ("person2_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tree_members" ADD CONSTRAINT "tree_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activities_tree_idx" ON "activities" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "persons_tree_idx" ON "persons" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "relationships_tree_idx" ON "relationships" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "relationships_person1_idx" ON "relationships" USING btree ("person1_id");--> statement-breakpoint
CREATE INDEX "relationships_person2_idx" ON "relationships" USING btree ("person2_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tree_members_tree_user_idx" ON "tree_members" USING btree ("tree_id","user_id");