import type { Moon, Planet, Star } from "@db/schema";
import type { Position } from "@lib/cache-position";
import { Vector3Math } from "@lib/kepler-orbit/kepler-orbit";
import { keplerOrbitService } from "@lib/kepler-orbit/kepler-orbit-service";
import { OrbitDataHelper } from "@lib/kepler-orbit/orbit-data-helper";
import { createTimer, logError, logPerformance, logger } from "@lib/logger";

import { getAllMoons } from "./moons";
import { getAllPlanets } from "./planets";
import { getAllStars } from "./stars";

let planets: Planet[] = [];
let stars: Star[] = [];
let moons: Moon[] = [];

type NextTicksObjectType = {
  object: Planet | Moon;
  positions: Position[];
} | null;

export const getInit = async () => {
  const timer = createTimer();
  await loadData();

  try {
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
  let nextTicks: NextTicksObjectType;
  await loadData();

  try {
    if (await isPlanet(target)) {
      nextTicks = await getPlanetNextTicks(
        target,
        fromTime,
        duration,
        timesteps,
      );
    } else if (await isMoon(target)) {
      nextTicks = await getMoonNextTicks(target, fromTime, duration, timesteps);
    } else {
      logger.error({ target }, `Object not found: ${target}`);
      throw new Error(`Object not found not found: ${target}`);
    }

    if (!nextTicks) {
      logger.error({ target }, `Next ticks not found: ${target}`);
      throw new Error(`Next ticks not found: ${target}`);
    }

    logPerformance(logger, `Query for ${nextTicks.object.name}`, timer.end(), {
      positionCount: nextTicks.positions.length,
      target: nextTicks.object,
    });

    return {
      target: nextTicks.object,
      timeStart: fromTime,
      count: nextTicks.positions.length,
      rows: nextTicks.positions,
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

const isPlanet = async (target: string): Promise<boolean> => {
  return !!planets.find((planet) => planet.uuid === target);
};

const getPlanetNextTicks = async (
  target: string,
  fromTime: number,
  duration: number,
  timesteps: number = 0.01666667,
): Promise<{ object: Planet; positions: Position[] } | null> => {
  const planet = planets.find((planet) => planet.uuid === target);

  if (!planet) {
    return null;
  }

  const star = getStar(target, planet.systemId as number);

  const orbitalCalculation = OrbitDataHelper.createPlanetParamsFromDB(
    planet,
    star,
    fromTime,
    duration,
    timesteps,
  );

  logger.debug(
    {
      planet,
      target,
      fromTime,
      duration,
      orbitalInfo: OrbitDataHelper.getOrbitalInfo(
        orbitalCalculation.orbitalObject,
      ),
    },
    "Querying planet positions",
  );

  return {
    object: planet,
    positions: keplerOrbitService.getPositions(orbitalCalculation),
  };
};

const isMoon = async (target: string): Promise<boolean> => {
  return !!moons.find((moon) => moon.uuid === target);
};

const getMoonNextTicks = async (
  target: string,
  fromTime: number,
  duration: number,
  timesteps: number = 0.01666667,
): Promise<{ object: Moon; positions: Position[] } | null> => {
  const moon = moons.find((moon) => moon.uuid === target);

  if (!moon) {
    return null;
  }

  const moonPlanet = planets.find((planet) => planet.id === moon.planetId);

  if (!moonPlanet) {
    logger.error({ moon }, `Planet for moon ${moon.name} not found: ${target}`);
    throw new Error(`Planet for moon ${moon.name} not found: ${target}`);
  }

  const moonPlanetPositions = await getPlanetNextTicks(
    moonPlanet.uuid as string,
    fromTime,
    duration,
    timesteps,
  );

  if (!moonPlanetPositions) {
    logger.error({ moon }, `No positions for planet for moon ${moon.name}`);
    throw new Error(`No positions for planet for moon ${moon.name}`);
  }

  const orbitalCalculation = OrbitDataHelper.createMoonParamsFromDB(
    moon,
    moonPlanet,
    fromTime,
    duration,
    timesteps,
  );

  logger.debug(
    {
      moon,
      target,
      fromTime,
      duration,
      orbitalInfo: OrbitDataHelper.getOrbitalInfo(
        orbitalCalculation.orbitalObject,
      ),
    },
    "Querying moon positions",
  );

  const positions = keplerOrbitService
    .getPositions(orbitalCalculation)
    .map((position, index) => {
      const newPosition = Vector3Math.add(
        moonPlanetPositions.positions[index].position,
        position.position,
      );

      return { ...position, position: newPosition };
    });
  return { object: moon, positions };
};

const loadData = async () => {
  if (planets.length === 0) {
    planets = await getAllPlanets();
  }

  if (stars.length === 0) {
    stars = await getAllStars();
  }

  if (moons.length === 0) {
    moons = await getAllMoons();
  }
};
