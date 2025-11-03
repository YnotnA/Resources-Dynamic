import { DOUBLE, DuckDBConnection, INTEGER } from "@duckdb/node-api";
import { duckDbInstance } from "@lib/duckDb";
import { createTimer, logError, logPerformance, wsLogger } from "@lib/logger";
import { mappingCache } from "@websocket/cache/mapping-cache";

import type { NextTicksType } from "../../schema/planetarySystem/requestPlanetarySystem.ws";

let duckConnectPromise: Promise<DuckDBConnection> | null = null;

const getDuckConnect = async (): Promise<DuckDBConnection> => {
  if (!duckConnectPromise) {
    duckConnectPromise = duckDbInstance(`${process.cwd()}/data/my-db.duckdb`);
  }
  return duckConnectPromise;
};

const uuidToId = (uuid: string): number | null => {
  const id = mappingCache.getIdByUuid(uuid);

  if (id === undefined) {
    wsLogger.warn({ msg: `⚠️ UUID not found in cache`, uuid });
    return null;
  }

  return id;
};

export const getNextTicks = async (clientMessage: NextTicksType) => {
  try {
    const timer = createTimer();
    const typeId = uuidToId(clientMessage.target);

    if (typeId === null) {
      wsLogger.error({
        msg: `❌ Invalid target UUID`,
        uuid: clientMessage.target,
      });
      throw new Error(`Target not found: ${clientMessage.target}`);
    }

    const mapping = mappingCache.getByUuid(clientMessage.target);
    wsLogger.debug({
      msg: `Querying positions`,
      target: mapping?.name,
      type: mapping?.type,
      id: typeId,
      fromTime: clientMessage.fromTime,
      count: clientMessage.count,
    });

    const duckConnect = await getDuckConnect();

    const prepared = await duckConnect.prepare(`
      SELECT *
      FROM planet_positions
      WHERE time_s >= $time
      AND type_id = $typeId
      ORDER BY time_s
      LIMIT $limit
    `);

    prepared.bind(
      {
        time: clientMessage.fromTime,
        typeId: typeId,
        limit: clientMessage.count,
      },
      { time: DOUBLE, typeId: INTEGER, limit: INTEGER },
    );

    const result = await prepared.run();
    const rows = await result.getRowObjectsJson();
    const duration = timer.end();

    logPerformance(wsLogger, "Sync mapping table", duration);

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
    logError(wsLogger, error, { context: "getNextTicks" });
    throw error;
  }
};
