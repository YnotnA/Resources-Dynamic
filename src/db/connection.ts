import { logError, pgDbLogger } from "@lib/logger";
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in environment variables");
}

const pgClient = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(pgClient, { schema });

export const testConnection = async () => {
  try {
    await pgClient`SELECT 1`;
    pgDbLogger.info("✅ Database connected successfully");
    return true;
  } catch (error) {
    logError(pgDbLogger, error, { context: "testConnection" });
    return false;
  }
};
