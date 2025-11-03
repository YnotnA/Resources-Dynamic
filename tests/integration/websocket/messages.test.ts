import { createStandaloneWebSocket } from "@websocket/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "ws";

import { TestWebSocketClient } from "../../helpers/websocket-client";

describe("WebSocket Message Format", () => {
  let wss: Server;
  let client: TestWebSocketClient;

  beforeAll(async () => {
    wss = createStandaloneWebSocket(3100);
  });

  afterAll(() => {
    wss.close();
  });

  beforeEach(async () => {
    client = new TestWebSocketClient(3100);
    await client.connect();
    await client.waitForMessage(); // Welcome message
    client.clearMessages();
  });

  afterEach(() => {
    client.close();
  });

  it("should reject invalid MessagePack", async () => {
    client["ws"]?.send(Buffer.from("invalid data"));

    const response = await client.waitForMessage();

    expect(response.error).toBeDefined();
  });

  it("should reject invalid JSON structure", async () => {
    client.send({ invalid: "structure" });

    const response = await client.waitForMessage();

    expect(response.error).toBeDefined();
  });

  it("should accept valid message format", async () => {
    client.send({
      action: "ping",
    });

    const response = await client.waitForMessage();

    expect(response.type).toBe("pong");
  });
});
