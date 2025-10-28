import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Use SUPABASE or DATABASE_URL for database connection
const connectionString = process.env.SUPABASE || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE or DATABASE_URL environment variable must be set. Did you forget to configure the database connection?",
  );
}

export const pool = new Pool({ 
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

export const db = drizzle(pool, { schema });
