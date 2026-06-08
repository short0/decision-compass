import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./shared/schema.ts", "./shared/userSchema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  tablesFilter: ["!session"],
});
