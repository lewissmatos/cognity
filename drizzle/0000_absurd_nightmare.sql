CREATE TYPE "public"."expense_category" AS ENUM('food', 'transport', 'shopping', 'entertainment', 'health', 'education', 'bills', 'travel', 'subscriptions', 'other');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"merchant" text,
	"category" "expense_category",
	"description" text,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
