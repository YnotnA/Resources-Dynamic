import { createPlanet, createSystem } from "@db/queries";
import { createMoon } from "@db/queries/moons";
import { createStar } from "@db/queries/stars";
import type {
  NewMoon,
  NewPlanet,
  NewStar,
  NewSystem,
  Planet,
  Star,
  System,
} from "@db/schema";
import { readFileSync, readdirSync } from "fs";
import path from "path";

import type { FlatType } from "./schema/importSystem.model";
import { importSystemSchema } from "./schema/importSystem.model";
import type { MoonType } from "./schema/moon.model";
import type { PlanetType } from "./schema/planet.model";
import type { StarType } from "./schema/star.model";
import type { SystemType } from "./schema/system.model";

const folderPath = path.join(process.cwd(), "data/system");

const files = readdirSync(folderPath);

const jsonFiles = files.filter((file) => file.endsWith(".json"));

const MASS_SUN = 1.989e30;
const MASS_EARTH = 5.972e24;
const AU = 1.496e11;

let flatInfo: FlatType;

export const importSystem = async () => {
  for (const file of jsonFiles) {
    const filePath = path.join(folderPath, file);

    // Lire le contenu du fichier
    const jsonString = readFileSync(filePath, "utf8");

    // Parser le JSON
    const data = importSystemSchema.parse(JSON.parse(jsonString));
    flatInfo = data.flat;

    const system = await importSystemDb(data.structured.system);

    const stars = await Promise.all(
      data.structured.stars.map(
        async (star) => await importStarDb(star, system),
      ),
    );

    const planets = await Promise.all(
      data.structured.planets.map(async (planet, index) => {
        const newPlanet = await importPlanetDb(planet, index + 1, stars[0]);

        if (planet.moons && planet.moons.length > 0) {
          await Promise.all(
            planet.moons.map(async (moon) => {
              await importMoonDb(moon, newPlanet);
            }),
          );
        }

        return newPlanet;
      }),
    );

    console.log(`📄 ${file}: import done`, {
      system: system.name,
      stars: stars.map((star) => star.name),
      planets: planets.map((planet) => planet.name),
    });
  }
};

const importSystemDb = async (system: SystemType) => {
  const newSystem: NewSystem = {
    name: system.name,
    internalName: system.name,
  };
  return await createSystem(newSystem);
};

const importStarDb = async (star: StarType, system: System) => {
  const newStar: NewStar = {
    name: star.name,
    internalName: star.name,
    massKg: star.mass_Sun * MASS_SUN,
    systemId: system.id,
  };
  return await createStar(newStar);
};

const getFlatInfo = (planetNumber: number, flatName: string) => {
  if (!flatInfo || typeof flatInfo !== "object") {
    return null;
  }
  const key = `P${planetNumber}_${flatName}`;
  return Object.prototype.hasOwnProperty.call(flatInfo, key)
    ? flatInfo[key]
    : null;
};

const importPlanetDb = async (
  planet: PlanetType,
  planetNumber: number,
  star: Star,
) => {
  let radiusGravityInfluenceKm = 0;
  const planetMassKg = planet.mass_Me * MASS_EARTH;
  const semiMajorAxeM = planet.semi_major_AU * AU;
  if (semiMajorAxeM > 0 && star.massKg > 0) {
    radiusGravityInfluenceKm =
      semiMajorAxeM * Math.pow(planetMassKg / star.massKg, 2 / 5);
  }

  const internalName = `${star.name}_${planetNumber}`;

  const newPlanet: NewPlanet = {
    name: (getFlatInfo(planetNumber, "Name") ?? internalName).toString(),
    internalName,
    massKg: planetMassKg,
    systemId: star.systemId,
    apoapsisAu: planet.apoapsis_AU,
    periapsisAu: planet.periapsis_AU,
    argPeriDeg: planet.arg_peri_deg,
    incDeg: planet.inclination_deg,
    meanAnomalyDeg: planet.M0_deg,
    nodeDeg: planet.ascending_node_deg,
    radiusKm: planet.radius_km,
    radiusGravityInfluenceKm: radiusGravityInfluenceKm / 1000, // Convert to km
  };
  return await createPlanet(newPlanet);
};

const importMoonDb = async (moon: MoonType, planet: Planet) => {
  if (
    !moon.apoapsis_km ||
    !moon.periapsis_km ||
    !moon.inclination_deg ||
    !moon.mass_Me ||
    !moon.radius_km ||
    !moon.semi_major_km
  ) {
    return null;
  }

  let radiusGravityInfluenceKm = 0;
  const moonMassKg = moon.mass_Me * MASS_EARTH;
  const semiMajorAxeM = moon.semi_major_km * AU;
  if (semiMajorAxeM > 0 && planet.massKg > 0) {
    radiusGravityInfluenceKm =
      semiMajorAxeM * Math.pow(moonMassKg / planet.massKg, 2 / 5);
  }

  const newMoon: NewMoon = {
    name: moon.name,
    apoapsisAu: (moon.apoapsis_km * 1000) / AU,
    periapsisAu: (moon.periapsis_km * 1000) / AU,
    argPeriDeg: 0, // TODO fix
    incDeg: moon.inclination_deg,
    internalName: moon.name,
    massKg: moonMassKg,
    meanAnomalyDeg: 0, // TODO fix
    nodeDeg: 0, // TODO fix
    radiusKm: moon.radius_km,
    planetId: planet.id,
    radiusGravityInfluenceKm,
  };
  return await createMoon(newMoon);
};

importSystem();
