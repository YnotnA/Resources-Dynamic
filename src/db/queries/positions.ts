import type { Planet, Star } from "@db/schema";
import type { OrbitCalculationParams } from "@lib/kepler-orbit/kepler-orbit-service";
import { keplerOrbitService } from "@lib/kepler-orbit/kepler-orbit-service";
import { OrbitDataHelper } from "@lib/kepler-orbit/kerpler-orbit-helper";
import { createTimer, logError, logPerformance, logger } from "@lib/logger";

import { getAllPlanets } from "./planets";
import { getAllStars } from "./stars";

let planets: Planet[] = [];
let stars: Star[] = [];

export const getInit = async () => {
  const timer = createTimer();

  try {
    if (planets.length === 0) {
      planets = await getAllPlanets();
    }

    if (stars.length === 0) {
      stars = await getAllStars();
    }

    const dataPromises = planets.map(async (planet) => {
      const firstTick = await getNextTicks(planet.uuid as string, 0, 1);
      const firstTickItem = firstTick.rows.at(0);

      if (!firstTickItem) {
        return null;
      }

      return {
        target: planet,
        item: firstTickItem,
      };
    });

    const duration = timer.end();

    const data = (await Promise.all(dataPromises)).filter(
      (item) => item !== null,
    );

    logPerformance(logger, `Query for init`, duration);

    return data;
  } catch (error) {
    logError(logger, error, {
      context: "getInit",
    });
    throw error;
  }
};

export const getNextTicks = async (
  target: string,
  fromTime: number,
  count: number,
  timesteps: number = 0.01666667,
) => {
  const timer = createTimer();

  try {
    if (planets.length === 0) {
      planets = await getAllPlanets();
    }

    if (stars.length === 0) {
      stars = await getAllStars();
    }

    const planet = planets.find((planet) => planet.uuid === target);

    if (!planet) {
      logger.error(`Planet not found: ${target}`);
      throw new Error(`Planet not found: ${target}`);
    }

    const star = stars.find((star) => star.systemId === planet.systemId);

    if (!star) {
      logger.error(`Star not found: ${target}`);
      throw new Error(`Star not found: ${target}`);
    }

    logger.debug(
      {
        planet,
        target,
        fromTime,
        count,
      },
      "Querying positions",
    );

    const orbitalElements = OrbitDataHelper.planetDBToOrbitalElements(
      planet,
      star,
    );

    const params: OrbitCalculationParams = {
      objectId: planet.uuid as string,
      objectType: "planet" as const,
      startTimeS: fromTime,
      durationS: count,
      timestepS: timesteps,
      orbitalObject: orbitalElements,
    };

    const rows = keplerOrbitService.getPositions(params);

    const duration = timer.end();

    logPerformance(logger, `Query for ${planet.name}`, duration, {
      rowCount: rows.length,
      target: planet.name,
    });

    return {
      target: planet,
      timeStart: fromTime,
      count: rows.length,
      rows,
    };
  } catch (error) {
    logError(logger, error, {
      context: "getNextTicks",
      target,
      fromTime,
    });
    throw error;
  }
};
