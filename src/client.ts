import { decode, encode } from "@msgpack/msgpack";
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:3000");

ws.on("open", () => {
  console.log("✅ Connected to WebSocket server");

  ws.send(
    encode({
      action: "next-ticks",
      count: 5,
      fromTime: 800,
      target: "5cf68ed9-9eb1-4b34-9324-d4517a70a333",
    }),
  );
});

ws.on("message", (data) => {
  const decoded = decode(data as Buffer);
  console.log("🎯 Received:", decoded);
});

ws.on("close", () => console.log("🔴 Disconnected"));
ws.on("error", (err) => console.error("❌ WebSocket error:", err));
