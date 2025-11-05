import { ObjectPositionType } from "@dbduck/schema/objectPosition.model";
import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

export class TestDuckDBHelper {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;

  async setup() {
    const { DuckDBInstance } = await import("@duckdb/node-api");
    this.instance = await DuckDBInstance.create(":memory:");
    this.connection = await this.instance.connect();

    await this.connection.run(`
      CREATE TABLE planet_positions (
        time_s DOUBLE,
        type_id INTEGER,
        x DOUBLE,
        y DOUBLE,
        z DOUBLE,
      )
    `);
  }

  async clean() {
    await this.connection?.run("DELETE FROM planet_positions");
  }

  async insertPositions(positions: ObjectPositionType[]) {
    for (const pos of positions) {
      await this.connection?.run(
        `
        INSERT INTO planet_positions (time_s, type_id, x, y, z)
        VALUES (?, ?, ?, ?, ?)
      `,
        [pos.time_s, pos.type_id, pos.x, pos.y, pos.z],
      );
    }
  }

  getConnection() {
    return this.connection;
  }
}
