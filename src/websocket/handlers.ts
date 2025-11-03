import {
  ClientMessageType,
  clientMessageSchema,
} from "@/websocket/schema/clientMessage.model";
import { getNextTicks } from "@duckdb/queries/positions";
import { createTimer, logError, wsLogger } from "@lib/logger";
import { decode, encode } from "@msgpack/msgpack";
import type { WebSocket } from "ws";
import { ZodError } from "zod";

import { NextTicksType } from "./schema/requestPlanetarySystem.model";

// Store connected clients with metadata
const clients = new Map<WebSocket, { id: string; connectedAt: Date }>();

export const handleConnection = (ws: WebSocket) => {
  const clientId = generateClientId();

  clients.set(ws, {
    id: clientId,
    connectedAt: new Date(),
  });

  wsLogger.info(`🟢 Horizon connected`, { clientId });

  sendMessage(ws, {
    type: "connected",
    clientId,
    timestamp: Date.now(),
  });

  // Incoming message management
  ws.on("message", (data) => handleMessage(ws, data));

  // Disconnection management
  ws.on("close", () => handleDisconnection(ws));

  // Error handling
  ws.on("error", (error) => handleError(ws, error));
};

const handleMessage = async (ws: WebSocket, data: any) => {
  const client = clients.get(ws);

  try {
    // Decode MessagePack
    const decoded = decode(new Uint8Array(data as ArrayBuffer));

    // Validate with Zod
    const msg: ClientMessageType = clientMessageSchema.parse(decoded);

    wsLogger.debug("Message received", {
      clientId: client?.id,
      action: msg.action,
    });

    await routeMessage(ws, msg);
  } catch (err: unknown) {
    handleMessageError(ws, err);
  }
};

const routeMessage = async (ws: WebSocket, msg: ClientMessageType) => {
  switch (msg.action) {
    case "next-ticks":
      await handleNextTicks(ws, msg);
      break;

    case "ping":
      sendMessage(ws, { type: "pong", timestamp: Date.now() });
      break;
  }
};

const handleNextTicks = async (ws: WebSocket, msg: NextTicksType) => {
  const timer = createTimer();
  const clientId = clients.get(ws)?.id;

  wsLogger.debug("Processing next-ticks request", {
    clientId,
    target: msg.target,
    fromTime: msg.fromTime,
    count: msg.count,
  });

  try {
    const coords = await getNextTicks(msg);
    const duration = timer.end();

    wsLogger.debug(`✅ Sent ${coords.count} positions`, {
      clientId,
      target: coords.target.name,
      count: coords.count,
      duration,
    });

    sendMessage(ws, coords);
  } catch (error) {
    logError(wsLogger, error, { context: "handleNextTicks" });
    sendError(ws, "Processing error", "Failed to get next ticks");
  }
};

const handleMessageError = (ws: WebSocket, err: unknown) => {
  logError(wsLogger, err);

  const errorMessage =
    err instanceof ZodError
      ? err.issues
          .map((issue) => `On ${issue.path.join(".")} (${issue.message})`)
          .join(" | ")
      : String(err);

  sendError(ws, "Invalid message format", errorMessage);
};

const handleDisconnection = (ws: WebSocket) => {
  const client = clients.get(ws);

  if (client) {
    wsLogger.info(`🔴 Horizon disconnected`, { clientId: client.id });
    clients.delete(ws);
  }
};

const handleError = (ws: WebSocket, error: Error) => {
  const client = clients.get(ws);
  logError(wsLogger, error, { context: "handleError", clientId: client?.id });
};

const sendMessage = (ws: WebSocket, data: any) => {
  if (ws.readyState === 1) {
    // OPEN
    ws.send(encode(data));
  }
};

const sendError = (ws: WebSocket, error: string, message: string) => {
  sendMessage(ws, { error, message });
};

/**
 * Broadcast to all connected clients
 */
export const broadcast = (data: any, excludeWs?: WebSocket) => {
  clients.forEach((_client, ws) => {
    if (ws !== excludeWs && ws.readyState === 1) {
      sendMessage(ws, data);
    }
  });
};

/**
 * Generates a unique ID for a client
 */
const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

/**
 * Retrieves the number of connected clients
 */
export const getClientsCount = () => clients.size;

/**
 * Retrieves information about all clients
 */
export const getClientsInfo = () => {
  return Array.from(clients.values());
};
