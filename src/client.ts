import { decode, encode } from "@msgpack/msgpack";
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:9200");

ws.on("open", () => {
  console.log("✅ Connected to WebSocket server");

  ws.send(
    encode({
      action: "init",
    }),
  );

  ws.send(
    encode({
      action: "next-ticks",
      count: 2,
      fromTime: Math.floor(Math.random() * 100) + 1,
      target: "3ed66943-71e6-4a17-9631-884eaaba8852",
    }),
  );
});

ws.on("message", (data) => {
  const decoded = decode(data as Buffer);
  console.log("🎯 Received:", decoded);
});

ws.on("close", () => console.log("🔴 Disconnected"));
ws.on("error", (err) => console.error("❌ WebSocket error:", err));
