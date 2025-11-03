import { DOUBLE, DuckDBConnection, INTEGER } from "@duckdb/node-api";
import { duckDbInstance } from "@lib/duckDb";
import { ClientMessageType } from "schema/clientMessage.model";

let duckConnectPromise: Promise<DuckDBConnection> | null = null;

const getDuckConnect = async (): Promise<DuckDBConnection> => {
  if (!duckConnectPromise) {
    duckConnectPromise = duckDbInstance(`${process.cwd()}/data/my-db.duckdb`);
  }
  return duckConnectPromise;
};

const uuidMapper = (uuid: string): number => {
  return 12;
};

export const getNextTicks = async (clientMessage: ClientMessageType) => {
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
      typeId: uuidMapper(clientMessage.target),
      limit: clientMessage.count,
    },
    { time: DOUBLE, typeId: INTEGER, limit: INTEGER },
  );

  const result = await prepared.run();
  const rows = await result.getRowObjectsJson();

  return {
    timeStart: clientMessage.fromTime,
    count: rows.length,
    rows,
  };
};
