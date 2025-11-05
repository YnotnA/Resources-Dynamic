import { createPlanetSchema, updateMoonSchema } from "@db/schema";
import { apiLogger, logRequestError } from "@lib/logger";
import { Hono } from "hono";
import { z } from "zod";

import {
  createPlanet,
  deletePlanet,
  getAllPlanets,
  getPlanetByUuid,
  getPlanetsBySystemId,
  updatePlanet,
} from "../db/queries";

const planetsRouter = new Hono();

/**
 * GET /planets - Lists all planets
 */
planetsRouter.get("/", async (c) => {
  try {
    const planetsList = await getAllPlanets();
    return c.json({
      success: true,
      count: planetsList.length,
      data: planetsList,
    });
  } catch (error) {
    logRequestError(apiLogger, c, error);
    return c.json({ success: false, error: "Failed to fetch planets" }, 500);
  }
});

/**
 * GET /planets/:uuid - Retrieves a planet by UUID with its moons
 */
planetsRouter.get("/:uuid", async (c) => {
  try {
    const uuid = c.req.param("uuid");
    const planet = await getPlanetByUuid(uuid);

    if (!planet) {
      return c.json({ success: false, error: "Planet not found" }, 404);
    }

    return c.json({ success: true, data: planet });
  } catch (error) {
    logRequestError(apiLogger, c, error);
    return c.json({ success: false, error: "Failed to fetch planet" }, 500);
  }
});

/**
 * GET /planets/system/:systemId - Planets in a system
 */
planetsRouter.get("/system/:systemId", async (c) => {
  try {
    const systemId = parseInt(c.req.param("systemId"));
    const planetsList = await getPlanetsBySystemId(systemId);

    return c.json({
      success: true,
      count: planetsList.length,
      data: planetsList,
    });
  } catch (error) {
    logRequestError(apiLogger, c, error);
    return c.json({ success: false, error: "Failed to fetch planets" }, 500);
  }
});

/**
 * POST /planets - Create a new planet
 */
planetsRouter.post("/", async (c) => {
  try {
    const body: unknown = await c.req.json();
    const validated = createPlanetSchema.parse(body);

    const newPlanet = await createPlanet(validated);

    return c.json({ success: true, data: newPlanet }, 201);
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
    return c.json({ success: false, error: "Failed to create planet" }, 500);
  }
});

/**
 * PATCH /planets/:uuid - Updates a planet
 */
planetsRouter.patch("/:uuid", async (c) => {
  try {
    const uuid = c.req.param("uuid");
    const body: unknown = await c.req.json();
    const validated = updateMoonSchema.parse(body);

    const updated = await updatePlanet(uuid, validated);

    if (!updated) {
      return c.json({ success: false, error: "Planet not found" }, 404);
    }

    return c.json({ success: true, data: updated });
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
    return c.json({ success: false, error: "Failed to update planet" }, 500);
  }
});

/**
 * DELETE /planets/:uuid - Delete a planet
 */
planetsRouter.delete("/:uuid", async (c) => {
  try {
    const uuid = c.req.param("uuid");
    const deleted = await deletePlanet(uuid);

    if (!deleted) {
      return c.json({ success: false, error: "Planet not found" }, 404);
    }

    return c.json({ success: true, message: "Planet deleted" });
  } catch (error) {
    logRequestError(apiLogger, c, error);
    return c.json({ success: false, error: "Failed to delete planet" }, 500);
  }
});

export default planetsRouter;
