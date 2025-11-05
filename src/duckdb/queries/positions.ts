import { getDuckDBConnection } from "@dbduck/connection";
import type { ObjectPositionType } from "@dbduck/schema/objectPosition.model";
import { DOUBLE, INTEGER } from "@duckdb/node-api";
import {
  createTimer,
  duckDbLogger,
  logError,
  logPerformance,
} from "@lib/logger";
import { mappingCache } from "@websocket/cache/mapping-cache";

const duckQueryLogger = duckDbLogger.child({ name: "Query" });

export const getInit = async () => {
  const timer = createTimer();

  try {
    const mappings = mappingCache.getAll();
    if (!mappings) {
      duckQueryLogger.error(`No data found`);
      throw new Error(`No data found`);
    }

    const dataPromises = mappings.map(async (mapping) => {
      const firstTick = await getNextTicks(mapping.uuid, 0, 1);
      const firstTickItem = firstTick.rows.at(0);

      if (!firstTickItem) {
        return null;
      }

      return {
        target: mapping,
        item: firstTickItem,
      };
    });

    const duration = timer.end();

    const data = (await Promise.all(dataPromises)).filter(
      (item) => item !== null,
    );

    logPerformance(duckQueryLogger, `Query for init`, duration);

    return data;
  } catch (error) {
    logError(duckQueryLogger, error, {
      context: "getInit",
    });
    throw error;
  }
};

export const getNextTicks = async (
  target: string,
  fromTime: number,
  count: number,
) => {
  const timer = createTimer();

  try {
    const mapping = mappingCache.getByUuid(target);

    if (!mapping) {
      duckQueryLogger.error(`Target not found: ${target}`);
      throw new Error(`Target not found: ${target}`);
    }

    duckQueryLogger.debug(
      {
        target: mapping.name,
        type: mapping.type,
        id: mapping.id,
        fromTime,
        count,
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
        time: fromTime,
        typeId: mapping.id,
        limit: count,
      },
      { time: DOUBLE, typeId: INTEGER, limit: INTEGER },
    );

    const result = await prepared.run();
    const rows = (await result.getRowObjectsJson()) as ObjectPositionType[];

    const duration = timer.end();

    logPerformance(duckQueryLogger, `Query for ${mapping.name}`, duration, {
      rowCount: rows.length,
      target: mapping.name,
    });

    return {
      target: mapping,
      timeStart: fromTime,
      count: rows.length,
      rows,
    };
  } catch (error) {
    logError(duckQueryLogger, error, {
      context: "getNextTicks",
      target,
      fromTime,
    });
    throw error;
  }
};
