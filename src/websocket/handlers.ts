import { getNextTicks } from "@duckdb/queries/positions";
import { createTimer, logError, wsLogger } from "@lib/logger";
import { decode, encode } from "@msgpack/msgpack";
import {
  ClientMessageType,
  clientMessageSchema,
} from "schema/clientMessage.model";
import { NextTicksType } from "schema/planetarySystem/requestPlanetarySystem.ws";
import type { WebSocket } from "ws";
import { ZodError } from "zod";

// Store des clients connectés avec metadata
const clients = new Map<WebSocket, { id: string; connectedAt: Date }>();

/**
 * Gère une nouvelle connexion WebSocket
 */
export const handleConnection = (ws: WebSocket) => {
  const clientId = generateClientId();

  clients.set(ws, {
    id: clientId,
    connectedAt: new Date(),
  });

  wsLogger.info({ msg: `🟢 Horizon connected`, clientId });

  // Envoi d'un message de bienvenue (optionnel)
  sendMessage(ws, {
    type: "connected",
    clientId,
    timestamp: Date.now(),
  });

  // Gestion des messages entrants
  ws.on("message", (data) => handleMessage(ws, data));

  // Gestion de la déconnexion
  ws.on("close", () => handleDisconnection(ws));

  // Gestion des erreurs
  ws.on("error", (error) => handleError(ws, error));
};

/**
 * Traite les messages reçus du client
 */
const handleMessage = async (ws: WebSocket, data: any) => {
  const client = clients.get(ws);

  try {
    // Décodage MessagePack
    const decoded = decode(new Uint8Array(data as ArrayBuffer));

    // Validation avec Zod
    const msg: ClientMessageType = clientMessageSchema.parse(decoded);

    wsLogger.debug({
      msg: `Message received`,
      clientId: client?.id,
      action: msg.action,
    });

    // Router les messages selon l'action
    await routeMessage(ws, msg);
  } catch (err: unknown) {
    handleMessageError(ws, err);
  }
};

/**
 * Route les messages vers les handlers appropriés
 */
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

/**
 * Handler pour l'action "next-ticks"
 */
const handleNextTicks = async (ws: WebSocket, msg: NextTicksType) => {
  const timer = createTimer();
  const clientId = clients.get(ws)?.id;

  wsLogger.debug({
    msg: "Processing next-ticks request",
    clientId,
    target: msg.target,
    fromTime: msg.fromTime,
    count: msg.count,
  });

  try {
    const coords = await getNextTicks(msg);
    const duration = timer.end();

    wsLogger.info({
      msg: `✅ Sent ${coords.count} positions`,
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

/**
 * Gère les erreurs de parsing/validation des messages
 */
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

/**
 * Gère la déconnexion d'un client
 */
const handleDisconnection = (ws: WebSocket) => {
  const client = clients.get(ws);

  if (client) {
    wsLogger.info({ msg: `🔴 Horizon disconnected`, clientId: client.id });
    clients.delete(ws);
  }
};

/**
 * Gère les erreurs WebSocket
 */
const handleError = (ws: WebSocket, error: Error) => {
  const client = clients.get(ws);
  logError(wsLogger, error, { context: "handleError", clientId: client?.id });
};

/**
 * Envoie un message encodé en MessagePack
 */
const sendMessage = (ws: WebSocket, data: any) => {
  if (ws.readyState === 1) {
    // OPEN
    ws.send(encode(data));
  }
};

/**
 * Envoie un message d'erreur
 */
const sendError = (ws: WebSocket, error: string, message: string) => {
  sendMessage(ws, { error, message });
};

/**
 * Broadcast à tous les clients connectés
 */
export const broadcast = (data: any, excludeWs?: WebSocket) => {
  clients.forEach((_client, ws) => {
    if (ws !== excludeWs && ws.readyState === 1) {
      sendMessage(ws, data);
    }
  });
};

/**
 * Génère un ID unique pour un client
 */
const generateClientId = (): string => {
  return `client_${Date.now()}_${Math.random().toString(36).substring(7)}`;
};

/**
 * Récupère le nombre de clients connectés
 */
export const getClientsCount = () => clients.size;

/**
 * Récupère les infos de tous les clients
 */
export const getClientsInfo = () => {
  return Array.from(clients.values());
};
