import { getAllSystemsWithDetails } from "@db/queries";
import type { Moon, Planet, Star, System } from "@db/schema";
import type { Transform } from "@lib/cache-transform";
import { keplerOrbitService } from "@lib/kepler-orbit/kepler-orbit-service";
import { OrbitDataHelper } from "@lib/kepler-orbit/orbit-data-helper";
import { createTimer, logError, logPerformance, logger } from "@lib/logger";
import { Vector3Math } from "@lib/vector3/vector3Math";

let hasInitData: boolean = false;
let systems: System[] = [];
let planets: Planet[] = [];
let stars: Star[] = [];
let moons: Moon[] = [];

type NextTicksResultType<T extends Planet | Moon> = {
  system: System;
  object: T;
  transforms: Transform[];
} | null;

type NextTicksObjectType =
  | NextTicksResultType<Planet>
  | NextTicksResultType<Moon>;

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
  ) => NextTicksResultType<T>,
) => {
  const allData = dataDb.map((data) => {
    const objectNextTicks = nextTicksCn(
      data.uuid as string,
      0,
      0.01666667,
      0.01666667,
    ); // Only one position from T0

    if (!objectNextTicks || objectNextTicks.transforms.length === 0) {
      return null;
    }

    return {
      system: objectNextTicks.system,
      target: data,
      transform: objectNextTicks.transforms[0] ?? null,
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
      positionCount: nextTicks.transforms.length,
      target: nextTicks.object,
    });

    return {
      target: nextTicks.object,
      timeStart: fromTime,
      count: nextTicks.transforms.length,
      positions: nextTicks.transforms,
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

const getSystem = (target: string, systemId: number): System => {
  const system = systems.find((system) => system.id === systemId);

  if (!system) {
    logger.error(`System not found: ${target}`);
    throw new Error(`System not found: ${target}`);
  }

  return system;
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
): NextTicksResultType<Planet> => {
  const planet = planets.find((planet) => planet.uuid === target);

  if (!planet || !planet.systemId) {
    return null;
  }

  const star = getStar(target, planet.systemId);
  const system = getSystem(target, planet.systemId);

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
    system,
    object: planet,
    transforms: keplerOrbitService.getTransforms(orbitalCalculation),
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
): NextTicksResultType<Moon> => {
  const moon = moons.find((moon) => moon.uuid === target);

  if (!moon) {
    return null;
  }

  const moonPlanet = planets.find((planet) => planet.id === moon.planetId);

  if (!moonPlanet) {
    logger.error(
      { moon },
      `Planet for moon "${moon.name}" not found: ${target}`,
    );
    throw new Error(`Planet for moon "${moon.name}" not found: ${target}`);
  }

  const system = getSystem(target, moonPlanet.systemId as number);

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
    "Querying moon transforms",
  );

  const transforms = keplerOrbitService
    .getTransforms(orbitalCalculation)
    .map((transform, index) => {
      const newPosition = Vector3Math.add(
        moonPlanetPositions.transforms[index].position,
        transform.position,
      );

      return { ...transform, position: newPosition };
    });
  return { system, object: moon, transforms };
};

const loadData = async () => {
  if (!hasInitData) {
    const systemsWithDetails = await getAllSystemsWithDetails();

    planets = systemsWithDetails.flatMap((system) =>
      system.planets.map(
        ({ moons: _moons, ...planetWithoutMoons }) => planetWithoutMoons,
      ),
    );

    moons = systemsWithDetails.flatMap((system) =>
      system.planets.flatMap((planet) => planet.moons),
    );

    stars = systemsWithDetails.flatMap((system) => system.stars);

    systems = systemsWithDetails.map(
      ({ planets: _planets, stars: _stars, ...systemWithoutChildren }) =>
        systemWithoutChildren,
    );

    hasInitData = true;
  }
};
