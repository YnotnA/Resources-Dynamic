import { getInit, getNextTicks } from "@lib/celestial-bodies/transforms";
import { createTimer, logError, wsLogger } from "@lib/logger";
import { decode, encode } from "@msgpack/msgpack";
import type { WebSocket } from "ws";
import { ZodError } from "zod";

import type { RequestInitType } from "./schema/Request/init.model";
import type { NextTicksType } from "./schema/Request/nextTicks.model";
import type { RequestWsType } from "./schema/Request/request.model";
import { requestWsSchema } from "./schema/Request/request.model";
import type { InitMessageType } from "./schema/Response/init.model";
import type { NextTicksMessageType } from "./schema/Response/nextTick.model";
import type { ResponseWsType } from "./schema/Response/response.model";

// Store connected clients with metadata
const clients = new Map<WebSocket, { id: string; connectedAt: Date }>();

export const handleConnection = (ws: WebSocket) => {
  const clientId = generateClientId();

  clients.set(ws, {
    id: clientId,
    connectedAt: new Date(),
  });

  wsLogger.info({ clientId }, `🟢 Horizon connected`);

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

const handleMessage = async (ws: WebSocket, data: unknown) => {
  const client = clients.get(ws);

  try {
    // Decode MessagePack
    const decoded = decode(new Uint8Array(data as ArrayBuffer));

    // Validate with Zod
    const msg: RequestWsType = requestWsSchema.parse(decoded);

    wsLogger.debug(
      {
        clientId: client?.id,
        event_type: msg.event_type,
      },
      "Message received",
    );

    await routeMessage(ws, msg);
  } catch (err: unknown) {
    handleMessageError(ws, err);
  }
};

const routeMessage = async (ws: WebSocket, msg: RequestWsType) => {
  switch (msg.event_type) {
    case "init":
      await handleInit(ws, msg);
      break;

    case "transform":
      await handleTransform(ws, msg);
      break;
  }
};

const handleInit = async (ws: WebSocket, msg: RequestInitType) => {
  const timer = createTimer();
  const clientId = clients.get(ws)?.id;

  try {
    const objects = await getInit(msg.data);

    wsLogger.debug(
      {
        clientId,
        duration: timer.end(),
      },
      `✅ Sent init ${objects.length} positions`,
    );

    const init: InitMessageType["data"] = objects.map((object) => {
      return {
        object_type: object.objectType,
        object_uuid: object.target.uuid as string,
        object_data: {
          parent_id: object.parentId,
          from_timestamp: msg.data.from_timestamp,
          name: object.target.name,
          scenename: `scenes/planet/${object.target.internalName}.tscn`,
          positions: object.transforms.map((transform) => transform.position),
          rotations: [
            {
              x: 0, // TODO: define
              y: 0, // TODO: define
              z: 0, // TODO: define
            },
          ],
        },
      };
    });

    sendMessage(ws, {
      namespace: "genericprops",
      event: "create_object",
      data: init,
    });
  } catch (error) {
    logError(wsLogger, error, { context: "handleInit" });
    sendError(
      ws,
      "Processing error",
      `${error instanceof Error ? error.message : "Failed to get init"}`,
    );
  }

  wsLogger.debug(
    {
      clientId,
    },
    "Processing init request",
  );
};

const handleTransform = async (ws: WebSocket, msg: NextTicksType) => {
  const timer = createTimer();
  const clientId = clients.get(ws)?.id;

  const uuid = msg.data.uuid;
  const fromTimestamp = msg.data.from_timestamp;
  const duration = msg.data.duration_s;
  const frequency = msg.data.frequency;

  wsLogger.debug(
    {
      clientId,
      uuid,
      fromTimestamp,
      duration,
      frequency,
    },
    "Processing next-ticks request",
  );

  try {
    const coords = await getNextTicks(uuid, fromTimestamp, duration, frequency);

    wsLogger.debug(
      {
        clientId,
        target: coords.target.name,
        count: coords.count,
        duration: timer.end(),
      },
      `✅ Sent ${coords.count} positions`,
    );

    const nextTicks: NextTicksMessageType["data"] = coords.positions.map(
      (position) => {
        return {
          uuid,
          time: position.timeS,
          rotation: {
            x: 0, // TODO: define
            y: 0, // TODO: define
            z: 0, // TODO: define
          },
          position: position.position,
        };
      },
    );

    sendMessage(ws, { type: "next-ticks", data: nextTicks });
  } catch (error) {
    logError(wsLogger, error, { context: "handleNextTicks" });
    sendError(
      ws,
      "Processing error",
      `${error instanceof Error ? error.message : "Failed to get next ticks"}`,
    );
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
    wsLogger.info({ clientId: client.id }, `🔴 Horizon disconnected`);
    clients.delete(ws);
  }
};

const handleError = (ws: WebSocket, error: Error) => {
  const client = clients.get(ws);
  logError(wsLogger, error, { context: "handleError", clientId: client?.id });
};

const sendMessage = (ws: WebSocket, data: ResponseWsType) => {
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
export const broadcast = (data: ResponseWsType, excludeWs?: WebSocket) => {
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
