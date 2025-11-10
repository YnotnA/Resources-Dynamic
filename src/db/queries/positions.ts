import type { Moon, Planet, Star } from "@db/schema";
import type { Position } from "@lib/cache-position";
import { keplerOrbitService } from "@lib/kepler-orbit/kepler-orbit-service";
import { OrbitDataHelper } from "@lib/kepler-orbit/orbit-data-helper";
import { createTimer, logError, logPerformance, logger } from "@lib/logger";
import { Vector3Math } from "@lib/vector3/vector3Math";

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
    const planetsData = getInitData<Planet>(
      planets,
      (target, fromTime, duration, timesteps) =>
        getPlanetNextTicks(target, fromTime, duration, timesteps),
    );

    const moonsData = getInitData<Moon>(
      moons,
      (target, fromTime, duration, timesteps) =>
        getMoonNextTicks(target, fromTime, duration, timesteps),
    );

    logPerformance(logger, `Queries for init`, timer.end());

    return [...planetsData, ...moonsData];
  } catch (error) {
    logError(logger, error, {
      context: "getInit",
    });
    throw error;
  }
};

const getInitData = <T extends Moon | Planet>(
  dataDb: T[],
  nextTicksCn: (
    target: string,
    fromTime: number,
    duration: number,
    timesteps: number,
  ) => { object: T; positions: Position[] } | null,
) => {
  const allData = dataDb.map((data) => {
    const planetNextTicks = nextTicksCn(data.uuid as string, 0, 1, 1); // Only one position from T0

    if (!planetNextTicks || planetNextTicks.positions.length === 0) {
      return null;
    }

    return {
      target: data,
      item: planetNextTicks.positions[0],
    };
  });

  return allData.filter((item) => item !== null);
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
    if (isPlanet(target)) {
      nextTicks = getPlanetNextTicks(target, fromTime, duration, timesteps);
    } else if (isMoon(target)) {
      nextTicks = getMoonNextTicks(target, fromTime, duration, timesteps);
    } else {
      logger.error({ target }, `Object not found: ${target}`);
      throw new Error(`Object not found not found: ${target}`);
    }

    if (!nextTicks) {
      logger.error({ target }, `Next ticks not found for target: ${target}`);
      throw new Error(`Next ticks not found for target: ${target}`);
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

const isPlanet = (target: string): boolean => {
  return !!planets.find((planet) => planet.uuid === target);
};

const getPlanetNextTicks = (
  target: string,
  fromTime: number,
  duration: number,
  timesteps: number = 0.01666667,
): { object: Planet; positions: Position[] } | null => {
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

const isMoon = (target: string): boolean => {
  return !!moons.find((moon) => moon.uuid === target);
};

const getMoonNextTicks = (
  target: string,
  fromTime: number,
  duration: number,
  timesteps: number = 0.01666667,
): { object: Moon; positions: Position[] } | null => {
  const moon = moons.find((moon) => moon.uuid === target);

  if (!moon) {
    return null;
  }

  const moonPlanet = planets.find((planet) => planet.id === moon.planetId);

  if (!moonPlanet) {
    logger.error({ moon }, `Planet for moon ${moon.name} not found: ${target}`);
    throw new Error(`Planet for moon ${moon.name} not found: ${target}`);
  }

  const moonPlanetPositions = getPlanetNextTicks(
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
