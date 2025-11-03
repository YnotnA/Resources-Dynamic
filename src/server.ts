import { getNextTicks } from "@feat/planet/planetManager";
import { logError, wsLogger } from "@lib/logger";
import { decode, encode } from "@msgpack/msgpack";
import { WebSocketServer } from "ws";
import { ZodError } from "zod";

import { clientMessageSchema } from "./schema/clientMessage.model";

const wss = new WebSocketServer({ port: 3000 });
wsLogger.info({ msg: "🚀 WebSocket server running on ws://localhost:3000" });

wss.on("connection", async (ws) => {
  wsLogger.info({ msg: "🟢 Horizon connected" });

  ws.on("message", async (data) => {
    let msg;
    try {
      const decoded = decode(new Uint8Array(data as ArrayBuffer));

      msg = clientMessageSchema.parse(decoded);
    } catch (err: unknown) {
      logError(wsLogger, err, { context: "handleMessage" });

      const errorMessage =
        err instanceof ZodError
          ? err.issues
              .map((issue) => `On ${issue.path} (${issue.message})`)
              .join(" | ")
          : err;

      ws.send(
        encode({ error: "Invalid message format", message: errorMessage }),
      );
      return;
    }

    wsLogger.debug({ msg: "⬅ Message from client", clientMessage: msg });

    if (msg.action === "next-ticks") {
      const coords = await getNextTicks(msg);

      ws.send(encode(coords));
    }
  });

  ws.on("close", () => {
    wsLogger.info({ msg: "🔴 Horizon disconnected" });
  });
});
