import {
  aCelestialBodyMapping,
  aObjectPositionBuilder,
} from "@builder/builders";
import { CelestialBodyMapping } from "@db/schema";
import { ObjectPositionType } from "@dbduck/schema/objectPosition.model";
import { mappingCache } from "@websocket/cache/mapping-cache";
import { createStandaloneWebSocket } from "@websocket/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "ws";

import { TestDuckDBHelper } from "../../helpers/duckdb-helper";
import { TestWebSocketClient } from "../../helpers/websocket-client";

const duckHelper = new TestDuckDBHelper();
let mockData: CelestialBodyMapping[] = [];

vi.mock("@db/connection", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve(mockData)),
    })),
  },
}));

vi.mock("@dbduck/connection", () => ({
  getDuckDBConnection: vi.fn(() => duckHelper.getConnection()),
}));

describe("WebSocket Init", () => {
  let wss: Server;
  let client: TestWebSocketClient;

  beforeAll(async () => {
    await duckHelper.setup();
    wss = createStandaloneWebSocket(3101);
  });

  afterAll(() => {
    wss.close();
  });

  beforeEach(async () => {
    client = new TestWebSocketClient(3101);
    await client.connect();
    await client.waitForConnected();
    client.clearMessages();
    mockData = []; // Clear between tests
    mappingCache.clear();
    await duckHelper.clean();
  });

  afterEach(() => {
    client.close();
  });

  it("should accept init message", async () => {
    mockData = [
      aCelestialBodyMapping().withId(23).build(),
      aCelestialBodyMapping().withId(15).build(),
      aCelestialBodyMapping().withId(50).build(), // must not retrieve (ID not in duckdb)
    ];

    const mockDuckData: ObjectPositionType[] = [
      aObjectPositionBuilder().withTime(50).withTypeId(23).build(), // must not retrieve (time > 0)
      aObjectPositionBuilder().withTime(0).withTypeId(23).build(),
      aObjectPositionBuilder().withTime(0).withTypeId(15).build(),
    ];

    await duckHelper.insertPositions(mockDuckData);

    await mappingCache.load();

    client.send({
      action: "init",
    });

    const response = await client.waitForInit();

    expect(response.type).toBe("init");
    expect(response.data).toHaveLength(2);
    expect(response.data[0].uuid).toBe(mockData[0]["uuid"]);
    expect(response.data[0].name).toBe(mockData[0]["name"]);
    expect(response.data[0].internalName).toBe(mockData[0]["internalName"]);
    expect(response.data[0].position.x).toBe(mockDuckData[1]["x"]);
    expect(response.data[0].position.y).toBe(mockDuckData[1]["y"]);
    expect(response.data[0].position.z).toBe(mockDuckData[1]["z"]);
  });
});
