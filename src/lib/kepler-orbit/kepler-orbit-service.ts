import type {
  CacheCalculationParams,
  CacheStrategy,
  PrefetchConfig,
  Transform,
} from "@lib/cache-position";
import { CacheTransform } from "@lib/cache-position";
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

    const orbitalObject = params.orbitalObject;

    if (!orbitalObject) {
      return [];
    }

    keplerOrbitServiceLogger.debug(
      {
        objectId: params.objectId,
        startTime: params.startTimeS,
      },
      `🕐 Calculating orbit starting at T=${params.startTimeS}s`,
    );

    const orbit = new KeplerOrbit(orbitalObject, params.startTimeS);
    const steps = Math.max(1, Math.ceil(params.durationS / params.timestepS));
    const transforms: Transform[] = new Array(steps) as Transform[];

    let currentTime = params.startTimeS;

    for (let i = 0; i < steps; i++) {
      const dt = i === 0 ? 0 : params.timestepS;
      const position = orbit.advance(dt);

      transforms[i] = {
        timeS: Math.round(currentTime * 1000) / 1000,
        position,
      };

      currentTime += params.timestepS;
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
