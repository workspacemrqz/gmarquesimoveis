import { defineConfig } from "drizzle-kit";

// Use SUPABASE or DATABASE_URL for database connection
const databaseUrl = process.env.SUPABASE || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE or DATABASE_URL environment variable must be set");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
