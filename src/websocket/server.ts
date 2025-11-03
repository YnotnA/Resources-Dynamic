import { wsLogger } from "@lib/logger";
import { WebSocketServer } from "ws";

import { handleConnection } from "./handlers";

export const createStandaloneWebSocket = (port: number = 3000) => {
  const wss = new WebSocketServer({ port });

  wss.on("connection", handleConnection);

  wsLogger.info({
    msg: `🚀 WebSocket server running on ws://localhost:${port}`,
  });

  return wss;
};
