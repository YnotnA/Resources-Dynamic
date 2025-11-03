import {
  DuckDBConnection,
  DuckDBInstance,
  DuckDBInstanceCache,
} from "@duckdb/node-api";
import { duckDbLogger, logError } from "@lib/logger";
import * as path from "path";

// ===================================
// Configuration
// ===================================

const DUCKDB_PATH =
  process.env.DUCKDB_PATH || path.join(process.cwd(), "data", "my-db.duckdb");

// ===================================
// Singleton instances
// ===================================

let instanceCache: DuckDBInstanceCache | null = null;
let duckDbInstance: DuckDBInstance | null = null;
let duckDbConnection: DuckDBConnection | null = null;

/**
 * Récupère ou crée l'instance DuckDB (singleton)
 */
export const getDuckDBInstance = async (): Promise<DuckDBInstance> => {
  if (duckDbInstance) {
    return duckDbInstance;
  }

  try {
    duckDbLogger.info("🦆 Initializing DuckDB instance", {
      path: DUCKDB_PATH,
    });

    // Créer le cache si nécessaire
    if (!instanceCache) {
      instanceCache = new DuckDBInstanceCache();
    }

    // Récupérer ou créer l'instance
    duckDbInstance = await instanceCache.getOrCreateInstance(DUCKDB_PATH);

    duckDbLogger.info("✅ DuckDB instance ready", { path: DUCKDB_PATH });

    return duckDbInstance;
  } catch (error) {
    logError(duckDbLogger, error, {
      context: "getDuckDBInstance",
      path: DUCKDB_PATH,
    });
    throw error;
  }
};

/**
 * Récupère ou crée la connexion DuckDB (singleton)
 */
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

/**
 * Test la connexion DuckDB
 */
export const testDuckDBConnection = async (): Promise<boolean> => {
  try {
    duckDbLogger.info("🧪 Testing DuckDB connection");

    const conn = await getDuckDBConnection();

    // Exécuter une requête simple pour tester
    const result = await conn.run("SELECT 1 as test");
    const rows = await result.getRows();

    if (rows.length > 0) {
      duckDbLogger.info("✅ DuckDB connection test successful");
      return true;
    }

    duckDbLogger.warn("⚠️ DuckDB connection test returned no rows");
    return false;
  } catch (error) {
    logError(duckDbLogger, error, { context: "testDuckDBConnection" });
    return false;
  }
};

/**
 * Récupère des informations sur la base DuckDB
 */
export const getDuckDBInfo = async () => {
  try {
    const conn = await getDuckDBConnection();

    // Version de DuckDB
    const versionResult = await conn.run("SELECT version() as version");
    const versionRows = await versionResult.getRowObjects();
    const version = versionRows[0]?.version;

    // Liste des tables
    const tablesResult = await conn.run("SHOW TABLES");
    const tables = await tablesResult.getRowObjects();

    // Taille du fichier DB
    const fs = await import("fs");
    let fileSize = 0;
    if (fs.existsSync(DUCKDB_PATH)) {
      const stats = fs.statSync(DUCKDB_PATH);
      fileSize = stats.size;
    }

    return {
      path: DUCKDB_PATH,
      version,
      tables: tables.map((row: any) => row.name),
      tableCount: tables.length,
      fileSizeBytes: fileSize,
      fileSizeMB: Math.round((fileSize / 1024 / 1024) * 100) / 100,
    };
  } catch (error) {
    logError(duckDbLogger, error, { context: "getDuckDBInfo" });
    throw error;
  }
};

/**
 * Crée une nouvelle connexion (non-singleton) pour des opérations concurrentes
 */
export const createDuckDBConnection = async (): Promise<DuckDBConnection> => {
  try {
    const instance = await getDuckDBInstance();
    const newConn = await instance.connect();

    duckDbLogger.debug("🔌 Created new DuckDB connection");

    return newConn;
  } catch (error) {
    logError(duckDbLogger, error, { context: "createDuckDBConnection" });
    throw error;
  }
};
