import { DOUBLE, DuckDBConnection, INTEGER } from "@duckdb/node-api";
import { duckDbInstance } from "@lib/duckDb";
import { wsLogger } from "@lib/logger";
import { mappingCache } from "@websocket/cache/mapping-cache";

import type { NextTicksType } from "../../schema/planetarySystem/requestPlanetarySystem.ws";

let duckConnectPromise: Promise<DuckDBConnection> | null = null;

/**
 * Obtient la connexion DuckDB (singleton)
 */
const getDuckConnect = async (): Promise<DuckDBConnection> => {
  if (!duckConnectPromise) {
    duckConnectPromise = duckDbInstance(`${process.cwd()}/data/my-db.duckdb`);
  }
  return duckConnectPromise;
};

/**
 * Convertit un UUID en ID en utilisant le cache
 * ✅ Ultra-rapide : < 1µs
 */
const uuidToId = (uuid: string): number | null => {
  const id = mappingCache.getIdByUuid(uuid);

  if (id === undefined) {
    wsLogger.warn(`⚠️ UUID not found in cache: ${uuid}`);
    return null;
  }

  return id;
};

/**
 * Récupère les prochaines positions d'un objet céleste
 */
export const getNextTicks = async (clientMessage: NextTicksType) => {
  try {
    // ✅ Conversion UUID → ID via le cache
    const typeId = uuidToId(clientMessage.target);

    if (typeId === null) {
      wsLogger.error(`❌ Invalid target UUID: ${clientMessage.target}`);
      throw new Error(`Target not found: ${clientMessage.target}`);
    }

    const mapping = mappingCache.getByUuid(clientMessage.target);
    wsLogger.debug(
      `🎯 Query for ${mapping?.type} "${mapping?.name}" (ID: ${typeId})`,
    );

    // Connexion DuckDB
    const duckConnect = await getDuckConnect();

    // Préparer la requête
    const prepared = await duckConnect.prepare(`
      SELECT *
      FROM planet_positions
      WHERE time_s >= $time
      AND type_id = $typeId
      ORDER BY time_s
      LIMIT $limit
    `);

    // Bind des paramètres
    prepared.bind(
      {
        time: clientMessage.fromTime,
        typeId: typeId,
        limit: clientMessage.count,
      },
      { time: DOUBLE, typeId: INTEGER, limit: INTEGER },
    );

    // Exécution
    const result = await prepared.run();
    const rows = await result.getRowObjectsJson();

    wsLogger.debug(`✅ Found ${rows.length} positions for ${mapping?.name}`);

    return {
      target: {
        uuid: clientMessage.target,
        id: typeId,
        name: mapping?.name,
        type: mapping?.type,
      },
      timeStart: clientMessage.fromTime,
      count: rows.length,
      rows,
    };
  } catch (error) {
    wsLogger.error("❌ Error in getNextTicks:", error);
    throw error;
  }
};
