import type { Moon, Planet, Star } from "@db/schema";
import {
  type OrbitalObject,
  Vector3Math,
} from "@lib/kepler-orbit/kepler-orbit";
import type { OrbitCalculationParams } from "@lib/kepler-orbit/kepler-orbit-service";
import { keplerOrbitService } from "@lib/kepler-orbit/kepler-orbit-service";
import { OrbitDataHelper } from "@lib/kepler-orbit/orbit-data-helper";
import { createTimer, logError, logPerformance, logger } from "@lib/logger";
import type { Vector3Type } from "@websocket/schema/vector3.model";

import { getAllMoons } from "./moons";
import { getAllPlanets } from "./planets";
import { getAllStars } from "./stars";

let planets: Planet[] = [];
let stars: Star[] = [];
let moons: Moon[] = [];

export const getInit = async () => {
  const timer = createTimer();

  try {
    if (planets.length === 0) {
      planets = await getAllPlanets();
    }

    if (stars.length === 0) {
      stars = await getAllStars();
    }

    if (moons.length === 0) {
      moons = await getAllMoons();
    }

    const planetsDataPromises = planets.map(async (planet) => {
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

    const planetsData = (await Promise.all(planetsDataPromises)).filter(
      (item) => item !== null,
    );

    const moonsDataPromises = moons.map(async (moon) => {
      const firstTick = await getNextTicks(moon.uuid as string, 0, 1);
      const firstTickItem = firstTick.rows.at(0);

      if (!firstTickItem) {
        return null;
      }

      return {
        target: moon,
        item: firstTickItem,
      };
    });

    const moonsData = (await Promise.all(moonsDataPromises)).filter(
      (item) => item !== null,
    );

    logPerformance(logger, `Query for init`, timer.end());

    return [...planetsData, ...moonsData];
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
  duration: number,
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

    if (moons.length === 0) {
      moons = await getAllMoons();
    }

    const allObjects = [...planets, ...moons];

    const object = allObjects.find((object) => object.uuid === target);

    if (!object) {
      logger.error(`Object not found: ${target}`);
      throw new Error(`Object not found: ${target}`);
    }

    let systemId = "systemId" in object ? object.systemId : null;
    let orbitalCenters: Vector3Type[] = [{ x: 0, y: 0, z: 0 }];
    let star: Star | undefined;
    let orbitalObject: OrbitalObject | undefined;

    if (systemId) {
      star = getStar(target, systemId);
    }

    // Si il s'agit d'une lune
    if (!systemId && "planetId" in object) {
      const planetMoon = planets.find(
        (planet) => planet.id === object.planetId,
      );
      if (!planetMoon) {
        logger.error(`Planet for moon ${object.name} not found: ${target}`);
        throw new Error(`Planet for moon ${object.name} not found: ${target}`);
      }
      systemId = planetMoon.systemId as number;
      star = getStar(target, systemId);

      const orbitalPlanetMoon = OrbitDataHelper.planetDBToOrbitalElements(
        planetMoon,
        star,
      );

      const planetMoonParams: OrbitCalculationParams = {
        objectId: planetMoon.uuid as string,
        objectType: "planet" as const,
        startTimeS: fromTime,
        durationS: duration,
        timestepS: timesteps,
        orbitalObject: orbitalPlanetMoon,
      };

      const planetMoonPositions =
        keplerOrbitService.getPositions(planetMoonParams);

      orbitalCenters = planetMoonPositions.map(
        (planetMoonPositions) => planetMoonPositions.position,
      );

      orbitalObject = OrbitDataHelper.moonDBToOrbitalElements(
        object,
        planetMoon,
      );
    }

    if (!star) {
      logger.error(`Missing star for ${target}`);
      throw new Error(`Missing star for ${target}`);
    }

    if (!orbitalObject) {
      orbitalObject = OrbitDataHelper.planetDBToOrbitalElements(
        object as Planet,
        star,
      );
    }

    logger.debug(
      {
        object,
        target,
        fromTime,
        duration,
        orbitalInfo: OrbitDataHelper.getOrbitalInfo(orbitalObject),
      },
      "Querying positions",
    );

    const params: OrbitCalculationParams = {
      objectId: object.uuid as string,
      objectType: "planet" as const,
      startTimeS: fromTime,
      durationS: duration,
      timestepS: timesteps,
      orbitalObject,
    };

    const rows = keplerOrbitService
      .getPositions(params)
      .map((position, index) => {
        const newPosition = Vector3Math.add(
          orbitalCenters[index] ?? orbitalCenters[0],
          position.position,
        );

        return { ...position, position: newPosition };
      });

    logPerformance(logger, `Query for ${object.name}`, timer.end(), {
      rowCount: rows.length,
      target: object.name,
    });

    return {
      target: object,
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

const getStar = (target: string, systemId: number): Star => {
  const star = stars.find((star) => star.systemId === systemId);

  if (!star) {
    logger.error(`Star not found: ${target}`);
    throw new Error(`Star not found: ${target}`);
  }

  return star;
};
