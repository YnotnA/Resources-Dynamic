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

// Validation schema
const createPlanetSchema = z.object({
  systemId: z.number().int().positive(),
  name: z.string().min(1),
  internalName: z.string().min(1),
  massKg: z.number().positive(),
  periapsisAu: z.number(),
  apoapsisAu: z.number(),
  incDeg: z.number(),
  nodeDeg: z.number(),
  argPeriDeg: z.number(),
  meanAnomalyDeg: z.number(),
  radiusKm: z.number().positive(),
  radiusGravityInfluenceKm: z.number().positive(),
});

/**
 * GET /planets - Liste toutes les planètes
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
    console.error("Error fetching planets:", error);
    return c.json({ success: false, error: "Failed to fetch planets" }, 500);
  }
});

/**
 * GET /planets/:uuid - Récupère une planète par UUID avec ses lunes
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
    console.error("Error fetching planet:", error);
    return c.json({ success: false, error: "Failed to fetch planet" }, 500);
  }
});

/**
 * GET /planets/system/:systemId - Planètes d'un système
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
    return c.json({ success: false, error: "Failed to fetch planets" }, 500);
  }
});

/**
 * POST /planets - Crée une nouvelle planète
 */
planetsRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const validated = createPlanetSchema.parse(body);

    const newPlanet = await createPlanet(validated);

    return c.json({ success: true, data: newPlanet }, 201);
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
    return c.json({ success: false, error: "Failed to create planet" }, 500);
  }
});

/**
 * PATCH /planets/:uuid - Met à jour une planète
 */
planetsRouter.patch("/:uuid", async (c) => {
  try {
    const uuid = c.req.param("uuid");
    const body = await c.req.json();

    const updated = await updatePlanet(uuid, body);

    if (!updated) {
      return c.json({ success: false, error: "Planet not found" }, 404);
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    return c.json({ success: false, error: "Failed to update planet" }, 500);
  }
});

/**
 * DELETE /planets/:uuid - Supprime une planète
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
    return c.json({ success: false, error: "Failed to delete planet" }, 500);
  }
});

export default planetsRouter;
