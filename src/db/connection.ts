import { pgDbLogger } from "@app/lib/logger";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in environment variables");
}

// Connexion PostgreSQL
const connectionString = process.env.DATABASE_URL;

// Client PostgreSQL
export const client = postgres(connectionString, {
  max: 10, // Pool de connexions
  idle_timeout: 20,
  connect_timeout: 10,
});

// Instance Drizzle
export const db = drizzle(client, { schema });

// Test de connexion
export const testConnection = async () => {
  try {
    await client`SELECT 1`;
    pgDbLogger.info("✅ Database connected successfully");
    return true;
  } catch (error) {
    pgDbLogger.error("❌ Database connection failed", error);
    return false;
  }
};
