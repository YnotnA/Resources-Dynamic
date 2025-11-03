import { DuckDBInstanceCache } from "@duckdb/node-api";

import { duckDbLogger } from "./logger";

export const duckDbInstance = async (path: string) => {
  try {
    const cache = new DuckDBInstanceCache();
    const instance = await cache.getOrCreateInstance(path);

    duckDbLogger.debug(`✅ DuckDB instance retrieved or created (${path})`);

    const connection = await instance.connect();

    duckDbLogger.debug("✅ Connecting to the DuckDB instance");

    return connection;
  } catch (error: unknown) {
    duckDbLogger.error("❌ Error initializing DuckDB", error);
    throw error;
  }
};
