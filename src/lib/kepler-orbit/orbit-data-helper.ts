import type { Moon, Planet, Star } from "@db/schema";
import type { Vector3Type } from "@websocket/schema/vector3.model";

import type { OrbitalObject } from "./kepler-orbit";
import type { OrbitCalculationParams } from "./kepler-orbit-service";

/**
 * Helper functions for database integration
 */
export class OrbitDataHelper {
  /**
   * Create OrbitCalculationParams from database planet
   */
  static createPlanetParamsFromDB(
    planet: Planet,
    star: Star,
    startTime: number,
    duration: number,
    frequency: number,
  ): OrbitCalculationParams {
    return {
      objectId: planet.uuid as string,
      startTime,
      duration,
      frequency,
      orbitalObject: OrbitDataHelper.planetDBToOrbitalElements(planet, star),
    };
  }

  /**
   * Create OrbitCalculationParams from database moon
   */
  static createMoonParamsFromDB(
    moon: Moon,
    planet: Planet,
    startTime: number,
    duration: number,
    frequency: number,
  ): OrbitCalculationParams {
    return {
      objectId: moon.uuid as string,
      startTime,
      duration,
      frequency,
      orbitalObject: OrbitDataHelper.moonDBToOrbitalElements(moon, planet),
    };
  }

  /**
   * Validate orbital elements consistency
   */
  static validateOrbitalElements(elements: OrbitalObject): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // Check semi-major axis
    const semiMajorAxisAU = (elements.periapsisAU + elements.apoapsisAU) / 2;
    if (semiMajorAxisAU <= 0) {
      warnings.push("Semi-major axis must be positive");
    }

    // Check eccentricity
    const eccentricity =
      (elements.apoapsisAU - elements.periapsisAU) /
      (elements.apoapsisAU + elements.periapsisAU);
    if (eccentricity < 0 || eccentricity >= 1) {
      warnings.push(
        `Eccentricity ${eccentricity.toFixed(3)} is out of valid range [0, 1)`,
      );
    }

    // Check inclination
    if (elements.inclinationDeg < 0 || elements.inclinationDeg > 180) {
      warnings.push(
        `Inclination ${elements.inclinationDeg}° should be in [0, 180]`,
      );
    }

    // Check masses
    if (elements.primaryMassKg <= 0 || elements.objectMassKg <= 0) {
      warnings.push("Masses must be positive");
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Calculate orbital info
   */
  static getOrbitalInfo(elements: OrbitalObject): {
    semiMajorAxisAU: number;
    semiMajorAxisKm: number;
    eccentricity: number;
    periodDays: number;
    periodYears: number;
    periodSeconds: number;
  } {
    const AU_M = 1.495978707e11;
    const G = 6.6743e-11;
    const SECONDS_PER_DAY = 86400;
    const SECONDS_PER_YEAR = 31557600;

    const semiMajorAxisAU = (elements.periapsisAU + elements.apoapsisAU) / 2;
    const semiMajorAxisM = semiMajorAxisAU * AU_M;
    const eccentricity =
      (elements.apoapsisAU - elements.periapsisAU) /
      (elements.apoapsisAU + elements.periapsisAU);

    const mu = G * (elements.primaryMassKg + elements.objectMassKg);
    const periodS = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisM, 3) / mu);

    return {
      semiMajorAxisAU,
      semiMajorAxisKm: semiMajorAxisM / 1000,
      eccentricity,
      periodDays: periodS / SECONDS_PER_DAY,
      periodYears: periodS / SECONDS_PER_YEAR,
      periodSeconds: periodS,
    };
  }

  /**
   * Compare two positions for testing
   */
  static comparePositions(
    pos1: Vector3Type,
    pos2: Vector3Type,
    label1: string = "Position 1",
    label2: string = "Position 2",
  ): void {
    const dist1 = Math.sqrt(pos1.x ** 2 + pos1.y ** 2 + pos1.z ** 2);
    const dist2 = Math.sqrt(pos2.x ** 2 + pos2.y ** 2 + pos2.z ** 2);
    const diff = Math.sqrt(
      (pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2,
    );

    console.log(`\n📊 Position Comparison:`);
    console.log(`   ${label1}:`);
    console.log(
      `     Coords: (${(pos1.x / 1e9).toFixed(2)}, ${(pos1.y / 1e9).toFixed(2)}, ${(pos1.z / 1e9).toFixed(2)}) million km`,
    );
    console.log(`     Distance: ${(dist1 / 1e9).toFixed(2)} million km`);
    console.log(`   ${label2}:`);
    console.log(
      `     Coords: (${(pos2.x / 1e9).toFixed(2)}, ${(pos2.y / 1e9).toFixed(2)}, ${(pos2.z / 1e9).toFixed(2)}) million km`,
    );
    console.log(`     Distance: ${(dist2 / 1e9).toFixed(2)} million km`);
    console.log(`   Difference: ${(diff / 1e9).toFixed(2)} million km`);
    console.log(
      `   Match: ${diff < 1e6 ? "✅ YES (< 1000 km)" : diff < 1e9 ? "⚠️  CLOSE" : "❌ NO"}`,
    );
  }

  /**
   * Convert PostgreSQL planet data to OrbitalElements
   */
  static planetDBToOrbitalElements(object: Planet, star: Star): OrbitalObject {
    return {
      primaryMassKg: star.massKg,
      objectMassKg: object.massKg,
      periapsisAU: object.periapsisAu,
      apoapsisAU: object.apoapsisAu,
      inclinationDeg: object.incDeg,
      longitudeOfAscendingNodeDeg: object.nodeDeg,
      argumentOfPeriapsisDeg: object.argPeriDeg,
      meanAnomalyDeg: object.meanAnomalyDeg,
    };
  }

  static moonDBToOrbitalElements(object: Moon, planet: Planet): OrbitalObject {
    return {
      primaryMassKg: planet.massKg,
      objectMassKg: object.massKg,
      periapsisAU: object.periapsisAu,
      apoapsisAU: object.apoapsisAu,
      inclinationDeg: object.incDeg,
      longitudeOfAscendingNodeDeg: object.nodeDeg,
      argumentOfPeriapsisDeg: object.argPeriDeg,
      meanAnomalyDeg: object.meanAnomalyDeg,
    };
  }
}
