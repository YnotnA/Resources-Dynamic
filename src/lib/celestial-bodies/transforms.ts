import { getSystemWithDetailsByInternalName } from "@db/queries";
import type { Moon, Planet, Star, System } from "@db/schema";
import type { Transform } from "@lib/cache-transform";
import { keplerOrbitService } from "@lib/kepler-orbit/kepler-orbit-service";
import { OrbitDataHelper } from "@lib/kepler-orbit/orbit-data-helper";
import { createTimer, logError, logPerformance, logger } from "@lib/logger";
import { Vector3Math } from "@lib/vector3/vector3Math";
import type { RequestInitType } from "@websocket/schema/Request/init.model";

let hasInitData: boolean = false;
let system: System | undefined;
let planets: Planet[] = [];
let stars: Star[] = [];
let moons: Moon[] = [];

type NextTicksResultType<T extends Planet | Moon | System | Star> = {
  system: System;
  object_type: T extends Planet
    ? "planet"
    : T extends Moon
      ? "moon"
      : T extends Star
        ? "star"
        : "system";
  object: T;
  transforms: Transform[];
} | null;

type NextTicksObjectType =
  | NextTicksResultType<Planet>
  | NextTicksResultType<Moon>;

export const getInit = async (requestInitData: RequestInitType["data"]) => {
  const timer = createTimer();
  await loadData(requestInitData.system_internal_name);

  try {
    const planetsData = getInitData<Planet>(
      planets,
      (target, fromTime, duration, timesteps) =>
        getPlanetNextTicks(target, fromTime, duration, timesteps),
      requestInitData,
    );

    const moonsData = getInitData<Moon>(
      moons,
      (target, fromTime, duration, timesteps) =>
        getMoonNextTicks(target, fromTime, duration, timesteps),
      requestInitData,
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

const getInitData = <T extends Planet | Moon | System | Star>(
  dataDb: T[],
  nextTicksCn: (
    target: string,
    fromTime: number,
    duration: number,
    timesteps: number,
  ) => NextTicksResultType<T>,
  requestInitData: RequestInitType["data"],
) => {
  const allData = dataDb.map((data) => {
    const objectNextTicks = nextTicksCn(
      data.uuid as string,
      requestInitData.from_timestamp,
      requestInitData.duration_s,
      requestInitData.frequency,
    );

    if (!objectNextTicks || objectNextTicks.transforms.length === 0) {
      return null;
    }

    let parentId = "";
    if ("systemId" in data) {
      parentId = system?.uuid as string;
    } else if ("planetId" in data && data.planetId) {
      parentId = getPlanet(data.planetId).uuid as string;
    }

    return {
      system,
      parentId,
      objectType: objectNextTicks.object_type,
      target: data,
      transforms: objectNextTicks.transforms,
    };
  });

  return allData.filter((item) => item !== null);
};

export const getNextTicks = async (
  target: string,
  fromTime: number,
  duration: number,
  frequency: number,
) => {
  const timer = createTimer();
  let nextTicks: NextTicksObjectType;
  await loadData();

  try {
    if (isPlanet(target)) {
      nextTicks = getPlanetNextTicks(target, fromTime, duration, frequency);
    } else if (isMoon(target)) {
      nextTicks = getMoonNextTicks(target, fromTime, duration, frequency);
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

const getStar = (target: string, systemId: number): Star => {
  const star = stars.find((star) => star.systemId === systemId);

  if (!star) {
    logger.error(`Star not found: ${target}`);
    throw new Error(`Star not found: ${target}`);
  }

  return star;
};

const getPlanet = (planetId: number): Planet => {
  const planet = planets.find((planet) => planet.id === planetId);

  if (!planet) {
    logger.error(`Planet not found: ${planetId}`);
    throw new Error(`Star not found: ${planetId}`);
  }

  return planet;
};

const isPlanet = (target: string): boolean => {
  return !!planets.find((planet) => planet.uuid === target);
};

const getPlanetNextTicks = (
  target: string,
  fromTime: number,
  duration: number,
  frequency: number,
): NextTicksResultType<Planet> => {
  const planet = planets.find((planet) => planet.uuid === target);

  if (!planet || !planet.systemId || !system) {
    return null;
  }

  const star = getStar(target, planet.systemId);

  const orbitalCalculation = OrbitDataHelper.createPlanetParamsFromDB(
    planet,
    star,
    fromTime,
    duration,
    frequency,
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
    object_type: "planet",
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

  if (!moon || !system) {
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
  return { system, object_type: "moon", object: moon, transforms };
};

const loadData = async (systemInternalName?: string) => {
  if (!hasInitData && systemInternalName) {
    const systemsWithDetails =
      await getSystemWithDetailsByInternalName(systemInternalName);

    if (!systemsWithDetails) {
      logger.error(
        { systemInternalName },
        `System not found ${systemInternalName}`,
      );
      throw new Error(`System not found ${systemInternalName}`);
    }

    planets = systemsWithDetails.planets.map(
      ({ moons: _moons, ...planetWithoutMoons }) => planetWithoutMoons,
    );

    moons = systemsWithDetails.planets.flatMap((planet) => planet.moons);

    stars = systemsWithDetails.stars;

    system = (({ id, uuid, name, internalName }) => ({
      id,
      uuid,
      name,
      internalName,
    }))(systemsWithDetails);

    hasInitData = true;
  }
};
