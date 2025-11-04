import { DOUBLE, INTEGER } from "@duckdb/node-api";
import {
  createTimer,
  duckDbLogger,
  logError,
  logPerformance,
} from "@lib/logger";
import { mappingCache } from "@websocket/cache/mapping-cache";
import type { NextTicksType } from "@websocket/schema/Request/nextTicks.model";

import { getDuckDBConnection } from "../connection";

const duckQueryLogger = duckDbLogger.child({ name: "Query" });

type ObjectPosition = {
  time_s: number;
  type_id: number;
  x: number;
  y: number;
  z: number;
};

export const getNextTicks = async (clientMessage: NextTicksType) => {
  const timer = createTimer();

  try {
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

    const conn = await getDuckDBConnection();

    const prepared = await conn.prepare(`
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
        typeId: mapping.id,
        limit: clientMessage.count,
      },
      { time: DOUBLE, typeId: INTEGER, limit: INTEGER },
    );

    const result = await prepared.run();
    const rows = (await result.getRowObjectsJson()) as ObjectPosition[];

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
