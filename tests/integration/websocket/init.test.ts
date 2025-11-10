import { aMoon, aPlanet, aStar } from "@builder/builders";
import { Moon, Planet, Star } from "@db/schema";
import { createStandaloneWebSocket } from "@websocket/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "ws";

import { TestWebSocketClient } from "../../helpers/websocket-client";

let mockPlanets: Planet[] = [];
let mockStars: Star[] = [];
let mockMoons: Moon[] = [];

vi.mock("@db/queries/stars.ts", () => {
  return {
    getAllStars: vi.fn(() => Promise.resolve(mockStars)),
  };
});

vi.mock("@db/queries/planets.ts", () => {
  return {
    getAllPlanets: vi.fn(() => Promise.resolve(mockPlanets)),
  };
});

vi.mock("@db/queries/moons.ts", () => {
  return {
    getAllMoons: vi.fn(() => Promise.resolve(mockMoons)),
  };
});

describe("WebSocket Init", () => {
  let wss: Server;
  let client: TestWebSocketClient;

  beforeAll(() => {
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
    mockStars = [];
    mockPlanets = [];
    mockMoons = [];
  });

  afterEach(() => {
    client.close();
  });

  it("should accept init message", async () => {
    mockStars = [aStar().withSystemId(1).build()];
    mockPlanets = [
      aPlanet().withSystemId(1).build(),
      aPlanet().withSystemId(1).build(),
    ];
    mockMoons = [aMoon().withPlanetId(mockPlanets[0].id).build()];

    client.send({
      action: "init",
    });

    const response = await client.waitForInit();

    expect(response.type).toBe("init");
    expect(response.data).toHaveLength(3);
    expect(response.data[0].uuid).toBe(mockPlanets[0]["uuid"]);
    expect(response.data[0].name).toBe(mockPlanets[0]["name"]);
    expect(response.data[0].internalName).toBe(mockPlanets[0]["internalName"]);
    expect(response.data[2].uuid).toBe(mockMoons[0]["uuid"]);
    expect(response.data[2].name).toBe(mockMoons[0]["name"]);
    expect(response.data[2].internalName).toBe(mockMoons[0]["internalName"]);
  });
});
