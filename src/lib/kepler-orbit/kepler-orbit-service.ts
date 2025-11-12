import type {
  CacheCalculationParams,
  CacheStrategy,
  PrefetchConfig,
  Transform,
} from "@lib/cache-transform";
import { CacheTransform } from "@lib/cache-transform";
import { keplerOrbitServiceLogger, logPerformance } from "@lib/logger";

import { KeplerOrbit, type OrbitalObject } from "./kepler-orbit";

export interface OrbitCalculationParams extends CacheCalculationParams {
  orbitalObject: OrbitalObject;
}

export class KeplerOrbitService {
  private cacheTransform: CacheTransform;

  constructor(
    cacheStrategy?: Partial<CacheStrategy>,
    prefetchConfig?: Partial<PrefetchConfig>,
  ) {
    this.cacheTransform = new CacheTransform(cacheStrategy, prefetchConfig);
  }

  private calculateInternal = (params: OrbitCalculationParams): Transform[] => {
    const startTime = performance.now();

    const timeStep = 1 / params.frequency;
    const orbitalObject = params.orbitalObject;

    if (!orbitalObject) {
      return [];
    }

    keplerOrbitServiceLogger.debug(
      {
        objectId: params.objectId,
        startTime: params.startTime,
      },
      `🕐 Calculating orbit starting at T=${params.startTime}s`,
    );

    const orbit = new KeplerOrbit(orbitalObject, params.startTime);
    const steps = Math.max(1, Math.ceil(params.duration / timeStep));
    const transforms: Transform[] = new Array(steps) as Transform[];

    let currentTime = params.startTime;

    for (let i = 0; i < steps; i++) {
      const dt = i === 0 ? 0 : timeStep;
      const position = orbit.advance(dt);

      transforms[i] = {
        timeS: Math.round(currentTime * 1000) / 1000,
        position,
      };

      currentTime += timeStep;
    }

    const duration = performance.now() - startTime;

    logPerformance(
      keplerOrbitServiceLogger,
      `Calculated ${steps} transforms (${((steps / duration) * 1000).toFixed(0)} transforms/sec)`,
      duration,
    );

    return transforms;
  };

  getCacheTransform(): CacheTransform {
    return this.cacheTransform;
  }

  /**
   * Get orbital transform
   */
  getTransforms(params: OrbitCalculationParams): Transform[] {
    // keplerOrbitServiceLogger.debug(
    //   { cacheStats: this.cachePosition.getCacheStats() },
    //   "Stats for cache",
    // );
    return this.cacheTransform.getTransforms(params, this.calculateInternal);
  }
}

export const keplerOrbitService = new KeplerOrbitService();
