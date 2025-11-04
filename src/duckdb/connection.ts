import type {
  DuckDBConnection,
  DuckDBInstance} from "@duckdb/node-api";
import {
  DuckDBInstanceCache,
} from "@duckdb/node-api";
import { duckDbLogger, logError } from "@lib/logger";
import * as dotenv from "dotenv";

dotenv.config();

const DUCKDB_PATH = process.env.DUCKDB_PATH;

if (!DUCKDB_PATH) {
  throw new Error("DUCKDB_PATH must be set in environment variables");
}

let instanceCache: DuckDBInstanceCache | null = null;
let duckDbInstance: DuckDBInstance | null = null;
let duckDbConnection: DuckDBConnection | null = null;

export const getDuckDBInstance = async (): Promise<DuckDBInstance> => {
  if (duckDbInstance) {
    return duckDbInstance;
  }

  try {
    duckDbLogger.info(
      {
        path: DUCKDB_PATH,
      },
      "🦆 Initializing DuckDB instance",
    );

    // Create cache if need
    if (!instanceCache) {
      instanceCache = new DuckDBInstanceCache();
    }

    // Get or create duckDb Instance
    duckDbInstance = await instanceCache.getOrCreateInstance(DUCKDB_PATH);

    duckDbLogger.info({ path: DUCKDB_PATH }, "✅ DuckDB instance ready");

    return duckDbInstance;
  } catch (error) {
    logError(duckDbLogger, error, {
      context: "getDuckDBInstance",
      path: DUCKDB_PATH,
    });
    throw error;
  }
};

export const getDuckDBConnection = async (): Promise<DuckDBConnection> => {
  if (duckDbConnection) {
    return duckDbConnection;
  }

  try {
    const instance = await getDuckDBInstance();

    duckDbLogger.info("🔌 Connecting to DuckDB");
    duckDbConnection = await instance.connect();

    duckDbLogger.info("✅ DuckDB connection established");

    return duckDbConnection;
  } catch (error) {
    logError(duckDbLogger, error, { context: "getDuckDBConnection" });
    throw error;
  }
};
