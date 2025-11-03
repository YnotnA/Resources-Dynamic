import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import apiRoutes from "./routes/api";

const app = new Hono();

// Middlewares
app.use("*", logger());
app.use("*", cors());

// Routes API
app.route("/api", apiRoutes);

export default app;
