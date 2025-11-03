import { Logger } from "tslog";

export const logger = new Logger({
  name: "App",
  // Don't use `env` here, because we can use the logger in the browser
  minLevel: process.env.NODE_ENV === "production" ? 3 : 0,
  prettyLogTimeZone: "local",
});

export const wsLogger = logger.getSubLogger({ name: "WebSocket" });
export const duckDbLogger = logger.getSubLogger({ name: "DuckDb" });
