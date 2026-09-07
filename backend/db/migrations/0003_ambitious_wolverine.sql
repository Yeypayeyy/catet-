CREATE TABLE "dead_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"inbox_event_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dead_letters" ADD CONSTRAINT "dead_letters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dead_letters" ADD CONSTRAINT "dead_letters_inbox_event_id_inbox_events_id_fk" FOREIGN KEY ("inbox_event_id") REFERENCES "public"."inbox_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dead_letters_inbox_event_uniq" ON "dead_letters" USING btree ("inbox_event_id");