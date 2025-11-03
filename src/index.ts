import { serve } from "@hono/node-server";

import app from "./app";
import { createStandaloneWebSocket } from "./websocket/server";

const API_PORT = 3000;
const WS_PORT = 9200;

// Créer le serveur HTTP avec Hono
const server = serve({
  fetch: app.fetch,
  port: API_PORT,
});

// Attacher le WebSocket au même serveur
createStandaloneWebSocket(WS_PORT);

console.log(`📡 API available at http://localhost:${API_PORT}/api`);
console.log(`🔌 WebSocket available at ws://localhost:${WS_PORT}/ws`);
