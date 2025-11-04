import { createSystemSchema, updateSystemSchema } from "@db/schema";
import { apiLogger, logRequestError } from "@lib/logger";
import { Hono } from "hono";
import { z } from "zod";

import {
  createSystem,
  getAllSystems,
  getSystemWithDetails,
  updateSystem,
} from "../db/queries";

const systemsRouter = new Hono();

/**
 * GET /systems - List all systems
 */
systemsRouter.get("/", async (c) => {
  try {
    const systemsList = await getAllSystems();
    return c.json({
      success: true,
      count: systemsList.length,
      data: systemsList,
    });
  } catch (error) {
    logRequestError(apiLogger, c, error);
    return c.json({ success: false, error: "Failed to fetch systems" }, 500);
  }
});

/**
 * GET /systems/:id - Retrieves a system with its planets and stars
 */
systemsRouter.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const system = await getSystemWithDetails(id);

    if (!system) {
      return c.json({ success: false, error: "System not found" }, 404);
    }

    return c.json({ success: true, data: system });
  } catch (error) {
    logRequestError(apiLogger, c, error);
    return c.json({ success: false, error: "Failed to fetch system" }, 500);
  }
});

/**
 * POST /systems - Creates a new system
 */
systemsRouter.post("/", async (c) => {
  try {
    const body: unknown = await c.req.json();
    const validated = createSystemSchema.parse(body);

    const newSystem = await createSystem(validated);

    return c.json({ success: true, data: newSystem }, 201);
  } catch (error) {
    logRequestError(apiLogger, c, error);
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: error.issues,
        },
        400,
      );
    }
    return c.json({ success: false, error: "Failed to create system" }, 500);
  }
});

/**
 * PATCH /systems/:id - Updates a system
 */
systemsRouter.patch("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const body: unknown = await c.req.json();
    const validated = updateSystemSchema.parse(body);

    const updated = await updateSystem(id, validated);

    if (!updated) {
      return c.json({ success: false, error: "System not found" }, 404);
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logRequestError(apiLogger, c, error);
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: error.issues,
        },
        400,
      );
    }

    return c.json({ success: false, error: "Failed to update system" }, 500);
  }
});

export default systemsRouter;
