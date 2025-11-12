import { aMoon, aPlanet, aStar, aSystem } from "@builder/builders";
import { createStandaloneWebSocket } from "@websocket/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "ws";

import { TestWebSocketClient } from "../../helpers/websocket-client";
import { mockSystemsWithDetails } from "../../setup";

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
    mockSystemsWithDetails.length = 0;
    vi.resetModules(); // réinitialise le cache des imports
    vi.clearAllMocks(); // réinitialise les mocks
  });

  afterEach(() => {
    client.close();
  });

  it("should accept init message", async () => {
    const system = aSystem()
      .withPlanets([
        aPlanet().withMoons([aMoon().build()]).build(),
        aPlanet().withoutMoons().build(),
      ])
      .withStar(aStar().build())
      .build();

    mockSystemsWithDetails.push(system);

    client.send({
      action: "init",
    });

    const response = await client.waitForInit();

    expect(response.type).toBe("init");
    expect(response.data).toHaveLength(3); // 2 planets + 1 moon
    expect(response.data[0].uuid).toBe(system.planets[0]["uuid"]);
    expect(response.data[0].name).toBe(system.planets[0]["name"]);
    expect(response.data[0].internalName).toBe(
      system.planets[0]["internalName"],
    );
    expect(response.data[1].uuid).toBe(system.planets[1]["uuid"]);
    expect(response.data[1].name).toBe(system.planets[1]["name"]);
    expect(response.data[1].internalName).toBe(
      system.planets[1]["internalName"],
    );
    expect(response.data[2].uuid).toBe(system.planets[0].moons[0]["uuid"]);
    expect(response.data[2].name).toBe(system.planets[0].moons[0]["name"]);
    expect(response.data[2].internalName).toBe(
      system.planets[0].moons[0]["internalName"],
    );
  });
});
