CREATE TABLE "reward_bonuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"points" numeric(12, 2) NOT NULL,
	"description" text,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reward_bonuses" ADD CONSTRAINT "reward_bonuses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_bonuses" ADD CONSTRAINT "reward_bonuses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reward_bonuses_user_idx" ON "reward_bonuses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reward_bonuses_account_idx" ON "reward_bonuses" USING btree ("account_id");