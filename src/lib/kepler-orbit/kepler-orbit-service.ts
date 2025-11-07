import type {
  CacheCalculationParams,
  CacheStrategy,
  Position,
  PrefetchConfig,
} from "@lib/cache-position";
import { CachePosition } from "@lib/cache-position";
import { keplerOrbitServiceLogger, logPerformance } from "@lib/logger";

import { KeplerOrbit, type OrbitalObject } from "./kepler-orbit";

export interface OrbitCalculationParams extends CacheCalculationParams {
  orbitalObject: OrbitalObject;
}

export class KeplerOrbitService {
  private cachePosition: CachePosition;

  constructor(
    cacheStrategy?: Partial<CacheStrategy>,
    prefetchConfig?: Partial<PrefetchConfig>,
  ) {
    this.cachePosition = new CachePosition(cacheStrategy, prefetchConfig);
  }

  private calculateInternal = (params: OrbitCalculationParams): Position[] => {
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
    const positions: Position[] = new Array(steps) as Position[];

    let currentTime = params.startTimeS;

    for (let i = 0; i < steps; i++) {
      const dt = i === 0 ? 0 : params.timestepS;
      const position = orbit.advance(dt);

      positions[i] = {
        timeS: Math.round(currentTime * 1000) / 1000,
        position,
      };

      currentTime += params.timestepS;
    }

    const duration = performance.now() - startTime;

    logPerformance(
      keplerOrbitServiceLogger,
      `Calculated ${steps} positions (${((steps / duration) * 1000).toFixed(0)} positions/sec)`,
      duration,
    );

    return positions;
  };

  getCachePosition(): CachePosition {
    return this.cachePosition;
  }

  /**
   * Get orbital position
   */
  getPositions(params: OrbitCalculationParams): Position[] {
    const normalizedParams = { ...params };

    // Calculate a startTime based on the orbital period
    if (params.orbitalObject) {
      try {
        const orbit = new KeplerOrbit(params.orbitalObject, 0);
        const period = orbit.getOrbitalPeriod();

        if (params.startTimeS >= period || params.startTimeS < 0) {
          const normalizedStartTime =
            ((params.startTimeS % period) + period) % period;
          normalizedParams.startTimeS = normalizedStartTime;
        }
      } catch (_error) {
        // Ignore
      }
    }

    return this.cachePosition.getPositions(
      normalizedParams,
      this.calculateInternal,
    );
  }
}

export const keplerOrbitService = new KeplerOrbitService();
