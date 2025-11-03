import { decode, encode } from "@msgpack/msgpack";
import WebSocket from "ws";

export class TestWebSocketClient {
  private ws: WebSocket | null = null;
  private messages: any[] = [];
  private connected: boolean = false;

  constructor(private port: number = 3099) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`ws://localhost:${this.port}`);

      this.ws.on("open", () => {
        this.connected = true;
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        const decoded = decode(data);
        this.messages.push(decoded);
      });

      this.ws.on("error", (error) => {
        reject(error);
      });

      // Timeout after 5 secondes
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 5000);
    });
  }

  send(message: any): void {
    if (!this.ws || !this.connected) {
      throw new Error("WebSocket not connected");
    }

    const encoded = encode(message);
    this.ws.send(encoded);
  }

  async waitForMessage(timeout: number = 5000): Promise<any> {
    const startTime = Date.now();

    while (this.messages.length === 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout waiting for message");
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return this.messages.shift();
  }

  getMessages(): any[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
