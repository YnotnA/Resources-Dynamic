import { serve } from "@hono/node-server";
import * as dotenv from "dotenv";

import app from "./app";
import { testConnection } from "./db/connection";
import { syncMappingTable } from "./db/queries/mapping";
import { logger } from "./lib/logger";
import { mappingCache } from "./websocket/cache/mapping-cache";
import { createStandaloneWebSocket } from "./websocket/server";

dotenv.config();

const WS_PORT = parseInt(process.env.WS_PORT || "3000");
const API_PORT = parseInt(process.env.API_PORT || "3001");

// Démarrage du serveur
const start = async () => {
  logger.info("🎬 Starting Resources Dynamic Server...");

  // Test connexion DB
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error("❌ Failed to connect to database. Exiting...");
    process.exit(1);
  }

  logger.info("🔄 Syncing mapping table...");
  await syncMappingTable();

  logger.info("📥 Loading mapping cache...");
  await mappingCache.load();
  console.log(
    `✅ Cache ready: ${mappingCache.getStats().totalEntries} entries`,
  );

  // WebSocket standalone
  createStandaloneWebSocket(WS_PORT);

  // API Hono
  serve({
    fetch: app.fetch,
    port: API_PORT,
  });

  logger.info(`🔌 WebSocket: ws://localhost:${WS_PORT}`);
  logger.info(`📡 API: http://localhost:${API_PORT}`);
  logger.info(`📚 Planets API: http://localhost:${API_PORT}/api/planets`);
};

process.on("SIGINT", async () => {
  logger.info("\n🛑 Shutting down gracefully...");
  mappingCache.clear();
  process.exit(0);
});

start().catch(logger.error);
