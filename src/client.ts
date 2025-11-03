import { decode, encode } from "@msgpack/msgpack";
import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:9200");

ws.on("open", () => {
  console.log("✅ Connected to WebSocket server");

  ws.send(
    encode({
      action: "next-ticks",
      count: 60,
      fromTime: 80,
      target: "55ad9203-68c6-4d52-a4dd-601fe1c97852",
    }),
  );
});

ws.on("message", (data) => {
  const decoded = decode(data as Buffer);
  console.log("🎯 Received:", decoded);
});

ws.on("close", () => console.log("🔴 Disconnected"));
ws.on("error", (err) => console.error("❌ WebSocket error:", err));
