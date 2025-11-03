import { Hono } from "hono";

import {
  broadcast,
  getClientsCount,
  getClientsInfo,
} from "../websocket/handlers";

const api = new Hono();

// Route pour obtenir des stats sur les connexions WebSocket
api.get("/ws/stats", (c) => {
  return c.json({
    connectedClients: getClientsCount(),
    clients: getClientsInfo(),
  });
});

// Route pour broadcaster un message à tous les clients WS
api.post("/ws/broadcast", async (c) => {
  const body = await c.req.json();

  broadcast({
    type: "server-broadcast",
    data: body,
    timestamp: Date.now(),
  });

  return c.json({
    success: true,
    message: "Broadcasted to all clients",
    recipients: getClientsCount(),
  });
});

// Autres routes API...
api.get("/health", (c) => c.json({ status: "ok" }));

export default api;
