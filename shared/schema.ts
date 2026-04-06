import { pgTable, text, uuid, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  context: text("context"),
  status: text("status").notNull().default("active"),
  chosenOptionId: uuid("chosen_option_id"),
  reflection: text("reflection"),
  actualOutcome: text("actual_outcome"),
  outcomeDate: timestamp("outcome_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const options = pgTable("options", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  decisionId: uuid("decision_id").notNull().references(() => decisions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const outcomes = pgTable("outcomes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  optionId: uuid("option_id").notNull().references(() => options.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  probability: numeric("probability").notNull().default("50"),
  impact: numeric("impact").notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const premortems = pgTable("premortems", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  decisionId: uuid("decision_id").notNull().references(() => decisions.id, { onDelete: "cascade" }),
  optionId: uuid("option_id").references(() => options.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  severity: text("severity").notNull().default("medium"),
  frequency: text("frequency").notNull().default("occasional"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Decision = typeof decisions.$inferSelect;
export type Option = typeof options.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;
export type Premortem = typeof premortems.$inferSelect;
