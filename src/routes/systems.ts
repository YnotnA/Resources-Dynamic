import { Hono } from "hono";
import { z } from "zod";

import {
  createSystem,
  getAllSystems,
  getSystemWithDetails,
} from "../db/queries";

const systemsRouter = new Hono();

const createSystemSchema = z.object({
  name: z.string().min(1),
});

/**
 * GET /systems - Liste tous les systèmes
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
    return c.json({ success: false, error: "Failed to fetch systems" }, 500);
  }
});

/**
 * GET /systems/:id - Récupère un système avec ses planètes et étoiles
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
    return c.json({ success: false, error: "Failed to fetch system" }, 500);
  }
});

/**
 * POST /systems - Crée un nouveau système
 */
systemsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validated = createSystemSchema.parse(body);

    const newSystem = await createSystem(validated);

    return c.json({ success: true, data: newSystem }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Validation failed",
          details: error,
        },
        400,
      );
    }
    return c.json({ success: false, error: "Failed to create system" }, 500);
  }
});

export default systemsRouter;
