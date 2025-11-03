import { NextTicksType } from "@/websocket/schema/requestPlanetarySystem.model";
import { DOUBLE, INTEGER } from "@duckdb/node-api";
import {
  createTimer,
  duckDbLogger,
  logError,
  logPerformance,
} from "@lib/logger";
import { mappingCache } from "@websocket/cache/mapping-cache";

import { getDuckDBConnection } from "../connection";

const duckQueryLogger = duckDbLogger.child({ name: "Query" });

/**
 * Récupère les prochaines positions d'un objet céleste
 */
export const getNextTicks = async (clientMessage: NextTicksType) => {
  const timer = createTimer();

  try {
    // Conversion UUID → ID via le cache
    const mapping = mappingCache.getByUuid(clientMessage.target);

    if (!mapping) {
      duckQueryLogger.error(`Target not found: ${clientMessage.target}`);
      throw new Error(`Target not found: ${clientMessage.target}`);
    }

    duckQueryLogger.debug(
      {
        target: mapping.name,
        type: mapping.type,
        id: mapping.id,
        fromTime: clientMessage.fromTime,
        count: clientMessage.count,
      },
      "Querying positions",
    );

    // Connexion DuckDB
    const conn = await getDuckDBConnection();

    // Préparer la requête
    const prepared = await conn.prepare(`
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
        typeId: mapping.id,
        limit: clientMessage.count,
      },
      { time: DOUBLE, typeId: INTEGER, limit: INTEGER },
    );

    // Exécution
    const result = await prepared.run();
    const rows = await result.getRowObjectsJson();

    const duration = timer.end();

    logPerformance(duckQueryLogger, `Query for ${mapping.name}`, duration, {
      rowCount: rows.length,
      target: mapping.name,
    });

    return {
      target: {
        uuid: clientMessage.target,
        id: mapping.id,
        name: mapping.name,
        type: mapping.type,
      },
      timeStart: clientMessage.fromTime,
      count: rows.length,
      rows,
    };
  } catch (error) {
    logError(duckQueryLogger, error, {
      target: clientMessage.target,
      fromTime: clientMessage.fromTime,
    });
    throw error;
  }
};
