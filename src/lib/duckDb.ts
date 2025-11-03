import { DuckDBInstanceCache } from "@duckdb/node-api";

import { duckDbLogger, logError } from "./logger";

export const duckDbInstance = async (path: string) => {
  try {
    const cache = new DuckDBInstanceCache();
    const instance = await cache.getOrCreateInstance(path);

    duckDbLogger.debug({
      msg: `✅ DuckDB instance retrieved or created`,
      path,
    });

    const connection = await instance.connect();

    duckDbLogger.debug({ msg: "✅ Connecting to the DuckDB instance" });

    return connection;
  } catch (error: unknown) {
    logError(duckDbLogger, error, { context: "duckDbInstance" });
    throw error;
  }
};
