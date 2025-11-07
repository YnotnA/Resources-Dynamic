import { keplerOrbitServiceLogger, logPerformance } from "@lib/logger";
import { length } from "zod";

import {
  KeplerOrbit,
  type OrbitalElements,
  type Vector3,
} from "./kepler-orbit";

export interface OrbitSample {
  timeS: number;
  position: Vector3;
}

export interface OrbitCalculationParams {
  objectId: string;
  objectType: "planet" | "moon";
  startTimeS: number;
  durationS: number;
  timestepS: number;
  orbitalElements?: OrbitalElements;
}

export interface CachedOrbitData {
  params: OrbitCalculationParams;
  samples: OrbitSample[];
  calculatedAt: Date;
  sampleCount: number;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface PrefetchConfig {
  enabled: boolean;
  multiplier: number;
  maxDurationS: number;
  minDurationS: number;
  autoThreshold: number;
}

export interface CacheStrategy {
  maxCacheSize: number;
  cacheExpirationMs: number;
  evictionPolicy: "lru" | "lfu" | "fifo";
}

export class KeplerOrbitService {
  private cache: Map<string, CachedOrbitData> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private activePrefetches: Map<string, Promise<void>> = new Map();

  private cacheStrategy: CacheStrategy = {
    maxCacheSize: 100, // 100 objets célestes max
    cacheExpirationMs: 60000, // 1 minute d'expiration
    evictionPolicy: "lru", // Least Recently Used
  };

  private prefetchConfig: PrefetchConfig = {
    enabled: true,
    multiplier: 300, // Buffer de 300× (ex: 1s demandé → 300s cachés)
    maxDurationS: 600, // Max 10 minutes par cache (~1.2 MB à 60 Hz)
    minDurationS: 1,
    autoThreshold: 0.8,
  };

  constructor(
    cacheStrategy?: Partial<CacheStrategy>,
    prefetchConfig?: Partial<PrefetchConfig>,
  ) {
    if (cacheStrategy) {
      this.cacheStrategy = { ...this.cacheStrategy, ...cacheStrategy };
    }
    if (prefetchConfig) {
      this.prefetchConfig = { ...this.prefetchConfig, ...prefetchConfig };
    }
  }

  private getCacheKey(
    objectId: string,
    objectType: string,
    timestepS: number,
  ): string {
    return `${objectType}:${objectId}:${timestepS.toFixed(6)}`;
  }

  /**
   * Clé unique pour chaque calcul (utilisée pour prefetch queue)
   */
  private getCalculationKey(params: OrbitCalculationParams): string {
    return `${params.objectType}:${params.objectId}:${params.timestepS.toFixed(6)}`;
  }

  private calculatePrefetchDuration(requestedDuration: number): number {
    if (!this.prefetchConfig.enabled) {
      keplerOrbitServiceLogger.info(`🔧 Prefetch disabled`);
      return requestedDuration;
    }

    if (requestedDuration < this.prefetchConfig.minDurationS) {
      keplerOrbitServiceLogger.info(
        { requestedDuration, minDuration: this.prefetchConfig.minDurationS },
        `🔧 Request too short, no prefetch`,
      );
      return requestedDuration;
    }

    const bufferDuration = requestedDuration * this.prefetchConfig.multiplier;
    const totalDuration = requestedDuration + bufferDuration;

    // Appliquer la limite max
    const finalDuration = Math.min(
      totalDuration,
      this.prefetchConfig.maxDurationS,
    );

    keplerOrbitServiceLogger.debug(
      {
        requestedDuration,
        multiplier: this.prefetchConfig.multiplier,
        finalDuration,
      },
      `🔧 Prefetch: ${requestedDuration.toFixed(1)}s × ${this.prefetchConfig.multiplier} = ${finalDuration.toFixed(1)}s`,
    );

    // console.log(
    //   `[KeplerOrbitService] 🔧 Prefetch: ${requestedDuration.toFixed(1)}s × ${this.prefetchConfig.multiplier} = ${finalDuration.toFixed(1)}s`,
    // );

    return finalDuration;
  }

  private getDefaultOrbitalElements(): OrbitalElements {
    return {
      starMassKg: 1.98847e30,
      planetMassKg: 5.972e24,
      periapsisAU: 0.98,
      apoapsisAU: 1.02,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      meanAnomalyDeg: 0,
    };
  }

  private calculateInternal(params: OrbitCalculationParams): OrbitSample[] {
    const startTime = performance.now();

    const elements = params.orbitalElements || this.getDefaultOrbitalElements();
    keplerOrbitServiceLogger.debug(
      {
        objectId: params.objectId,
        startTime: params.startTimeS,
      },
      `🕐 Calculating orbit starting at T=${params.startTimeS}s`,
    );
    const orbit = new KeplerOrbit(elements, params.startTimeS);
    const steps = Math.max(1, Math.ceil(params.durationS / params.timestepS));
    const samples: OrbitSample[] = new Array(steps) as OrbitSample[];

    let currentTime = params.startTimeS;

    for (let i = 0; i < steps; i++) {
      const dt = i === 0 ? 0 : params.timestepS;
      const position = orbit.advance(dt);

      samples[i] = {
        timeS: Math.round(currentTime * 1000) / 1000,
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
      };

      currentTime += params.timestepS;
    }

    const duration = performance.now() - startTime;

    logPerformance(
      keplerOrbitServiceLogger,
      `Calculated ${steps} positions (${((steps / duration) * 1000).toFixed(0)} samples/sec)`,
      duration,
    );

    return samples;
  }

  private findMatchingCache(
    params: OrbitCalculationParams,
  ): CachedOrbitData | null {
    const cacheKey = this.getCacheKey(
      params.objectId,
      params.objectType,
      params.timestepS,
    );

    // Chercher dans le cache
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      keplerOrbitServiceLogger.info(
        {
          objectId: params.objectId,
        },
        `❌ Cache MISS for ${params.objectId} (no data)`,
      );
      return null;
    }

    // Vérifier expiration
    const age = Date.now() - cached.calculatedAt.getTime();
    if (age >= this.cacheStrategy.cacheExpirationMs) {
      keplerOrbitServiceLogger.info(
        {
          objectId: params.objectId,
        },
        `⏰ Cache EXPIRED for ${params.objectId}`,
      );

      this.cache.delete(cacheKey);
      return null;
    }

    const cachedStart = cached.params.startTimeS;
    const cachedEnd = cached.params.startTimeS + cached.params.durationS;
    const requestedStart = params.startTimeS;
    const requestedEnd = params.startTimeS + params.durationS;

    const tolerance = params.timestepS;

    if (
      requestedStart >= cachedStart - tolerance &&
      requestedEnd <= cachedEnd + tolerance
    ) {
      cached.accessCount++;
      cached.lastAccessedAt = new Date();
      keplerOrbitServiceLogger.debug(
        {
          objectId: params.objectId,
          cached: `${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.samples.length} samples)`,
          request: `${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s`,
        },
        `✅ Cache HIT for ${params.objectId}`,
      );
      return cached;
    }

    keplerOrbitServiceLogger.debug(
      {
        objectId: params.objectId,
        cached: `${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.samples.length} samples)`,
        request: `${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s`,
      },
      `⚠️  Cache PARTIAL for ${params.objectId}`,
    );

    return null;
  }

  /**
   * Éviction basée sur la clé simple
   */
  private evictCache(): void {
    if (this.cache.size < this.cacheStrategy.maxCacheSize) {
      return;
    }

    let keyToEvict: string | null = null;

    switch (this.cacheStrategy.evictionPolicy) {
      case "lru": {
        let oldestAccess = Date.now();
        for (const [key, data] of this.cache.entries()) {
          if (data.lastAccessedAt.getTime() < oldestAccess) {
            oldestAccess = data.lastAccessedAt.getTime();
            keyToEvict = key;
          }
        }
        break;
      }

      case "lfu": {
        let minAccess = Infinity;
        for (const [key, data] of this.cache.entries()) {
          if (data.accessCount < minAccess) {
            minAccess = data.accessCount;
            keyToEvict = key;
          }
        }
        break;
      }

      case "fifo":
        keyToEvict = this.cache.keys().next().value ?? null;
        break;
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      keplerOrbitServiceLogger.info(`🗑️  Evicted cache entry: ${keyToEvict}`);
    }
  }

  private extractSubset(
    cached: CachedOrbitData,
    startTimeS: number,
    durationS: number,
  ): OrbitSample[] {
    const endTimeS = startTimeS + durationS;
    const timestepS = cached.params.timestepS;

    // Calculer les indices
    const startIndex = Math.max(
      0,
      Math.ceil((startTimeS - cached.params.startTimeS) / timestepS),
    );
    const endIndex = Math.min(
      cached.samples.length,
      Math.ceil((endTimeS - cached.params.startTimeS) / timestepS),
    );

    const subset = cached.samples.slice(startIndex, endIndex);

    keplerOrbitServiceLogger.debug(
      {
        startIndex,
        endIndex,
        count: subset.length,
        cacheSize: cached.samples.length,
      },
      `✂️  Extracted ${subset.length} samples [${startIndex}-${endIndex}] from cache of ${cached.samples.length}`,
    );

    return subset;
  }

  private completedPrefetches: Set<string> = new Set();

  /**
   * Vérifier et prefetch immédiatement si nécessaire
   */
  private checkAndPrefetch(
    cached: CachedOrbitData,
    currentTimeS: number,
    params: OrbitCalculationParams,
  ): void {
    const cacheStart = cached.params.startTimeS;
    const cacheEnd = cached.params.startTimeS + cached.params.durationS;
    const cacheProgress = (currentTimeS - cacheStart) / cached.params.durationS;

    if (cacheProgress < this.prefetchConfig.autoThreshold) {
      return;
    }

    const prefetchKey = `prefetch:${params.objectId}:${params.objectType}:${cacheEnd.toFixed(0)}`;

    if (
      this.activePrefetches.has(prefetchKey) ||
      this.completedPrefetches.has(prefetchKey)
    ) {
      return;
    }

    const cacheKey = this.getCacheKey(
      params.objectId,
      params.objectType,
      params.timestepS,
    );

    const tempKey = `${cacheKey}:next`;

    // Vérifier si le prefetch existe déjà en temp
    if (this.cache.has(tempKey)) {
      return;
    }

    keplerOrbitServiceLogger.debug(
      `🔮 Prefetch at ${(cacheProgress * 100).toFixed(0)}% (T=${currentTimeS.toFixed(0)}s)`,
    );

    this.activePrefetches.set(prefetchKey, Promise.resolve());

    try {
      const cacheDuration = this.calculatePrefetchDuration(params.durationS);

      const nextParams: OrbitCalculationParams = {
        ...params,
        startTimeS: cacheEnd,
        durationS: cacheDuration,
      };

      const samples = this.calculateInternal(nextParams);

      if (samples.length > 0) {
        this.cache.set(tempKey, {
          params: nextParams,
          samples,
          calculatedAt: new Date(),
          sampleCount: samples.length,
          accessCount: 0,
          lastAccessedAt: new Date(),
        });

        keplerOrbitServiceLogger.debug(
          `✅ Prefetch ready (temp): ${samples.length.toLocaleString()} samples`,
        );

        this.completedPrefetches.add(prefetchKey);
      }
    } catch (error) {
      console.error(`[KeplerOrbitService] ❌ Prefetch failed:`, error);
    } finally {
      this.activePrefetches.delete(prefetchKey);
    }
  }

  /**
   * Get orbital positions with intelligent caching
   */
  getPositions(params: OrbitCalculationParams): OrbitSample[] {
    const normalizedParams = { ...params };

    if (params.orbitalElements) {
      try {
        const orbit = new KeplerOrbit(params.orbitalElements, 0);
        const period = orbit.getOrbitalPeriod();

        if (params.startTimeS >= period || params.startTimeS < 0) {
          const normalizedStartTime =
            ((params.startTimeS % period) + period) % period;
          normalizedParams.startTimeS = normalizedStartTime;
        }
      } catch (_error) {
        // Ignorer
      }
    }

    const cacheKey = this.getCacheKey(
      params.objectId,
      params.objectType,
      params.timestepS,
    );

    const tempKey = `${cacheKey}:next`;
    const prefetched = this.cache.get(tempKey);

    if (prefetched) {
      const prefetchStart = prefetched.params.startTimeS;
      const prefetchEnd =
        prefetched.params.startTimeS + prefetched.params.durationS;

      // Si on a atteint ou dépassé le début du nouveau cache
      if (normalizedParams.startTimeS >= prefetchStart) {
        keplerOrbitServiceLogger.debug(
          `🔄 Promoting prefetch: ${prefetchStart.toFixed(0)}-${prefetchEnd.toFixed(0)}s`,
        );

        // Supprimer l'ancien cache
        this.cache.delete(cacheKey);

        // Promouvoir le prefetch
        this.cache.set(cacheKey, prefetched);
        this.cache.delete(tempKey);

        // Clean all prefetchs flags of old cache
        const oldCacheEnd = prefetchStart; // Le début du nouveau = fin de l'ancien
        const oldPrefetchKey = `prefetch:${params.objectId}:${params.objectType}:${oldCacheEnd.toFixed(0)}`;
        this.completedPrefetches.delete(oldPrefetchKey);
      }
    }

    // Chercher dans le cache
    const cached = this.findMatchingCache(normalizedParams);

    if (cached) {
      const subset = this.extractSubset(
        cached,
        normalizedParams.startTimeS,
        normalizedParams.durationS,
      );

      if (subset.length > 0) {
        // PREFETCH
        if (this.prefetchConfig.enabled) {
          this.checkAndPrefetch(
            cached,
            normalizedParams.startTimeS,
            normalizedParams,
          );
        }

        return subset;
      }
    }

    keplerOrbitServiceLogger.info("❌ Cache MISS, calculating...");

    const cacheDuration = this.calculatePrefetchDuration(
      normalizedParams.durationS,
    );

    const cacheParams: OrbitCalculationParams = {
      ...normalizedParams,
      startTimeS: normalizedParams.startTimeS,
      durationS: cacheDuration,
    };

    const startCalc = performance.now();
    const samples = this.calculateInternal(cacheParams);
    const calcTime = performance.now() - startCalc;

    if (samples.length === 0) {
      throw new Error("Failed to calculate orbital positions");
    }

    const memoryMB = (samples.length * 32) / 1024 / 1024;
    keplerOrbitServiceLogger.debug(
      `💾 ${samples.length.toLocaleString()} samples in ${calcTime.toFixed(1)}ms (~${memoryMB.toFixed(1)} MB)`,
    );

    this.evictCache();

    // Supprimer le temp cache si existe
    this.cache.delete(tempKey);

    this.cache.set(cacheKey, {
      params: cacheParams,
      samples,
      calculatedAt: new Date(),
      sampleCount: samples.length,
      accessCount: 1,
      lastAccessedAt: new Date(),
    });

    const result = this.extractSubset(
      this.cache.get(cacheKey) as CachedOrbitData,
      normalizedParams.startTimeS,
      normalizedParams.durationS,
    );

    if (result.length === 0) {
      throw new Error("extractSubset failed");
    }

    return result;
  }

  /**
   * Prefetch in background (non-blocking)
   */
  prefetchInBackground(params: OrbitCalculationParams): void {
    const cacheKey = this.getCalculationKey(params);

    if (this.prefetchQueue.has(cacheKey) || this.findMatchingCache(params)) {
      return;
    }

    this.prefetchQueue.add(cacheKey);

    setTimeout(() => {
      try {
        this.getPositions(params);
      } finally {
        this.prefetchQueue.delete(cacheKey);
      }
    }, 0);
  }

  async waitForPrefetches(): Promise<void> {
    await Promise.all(Array.from(this.activePrefetches.values()));
  }

  /**
   * Get position at specific time with interpolation
   */
  getPositionAtTime(
    params: OrbitCalculationParams,
    timeS: number,
  ): Vector3 | null {
    const cached = this.findMatchingCache(params);
    if (!cached) {
      return null;
    }

    const relativeTime = timeS - cached.params.startTimeS;
    const index = Math.floor(relativeTime / cached.params.timestepS);

    if (index < 0 || index >= cached.samples.length) {
      return null;
    }

    if (Math.abs(cached.samples[index].timeS - timeS) < 0.0001) {
      return cached.samples[index].position;
    }

    if (index + 1 < cached.samples.length) {
      const sample1 = cached.samples[index];
      const sample2 = cached.samples[index + 1];
      const t = (timeS - sample1.timeS) / (sample2.timeS - sample1.timeS);

      return {
        x: sample1.position.x + (sample2.position.x - sample1.position.x) * t,
        y: sample1.position.y + (sample2.position.y - sample1.position.y) * t,
        z: sample1.position.z + (sample2.position.z - sample1.position.z) * t,
      };
    }

    return cached.samples[index].position;
  }

  clearCache(): void {
    this.cache.clear();
    this.completedPrefetches.clear();
    this.activePrefetches.clear();
    keplerOrbitServiceLogger.info("🧹 Cache cleared");
  }

  clearCacheForObject(objectId: string, objectType: string): void {
    const prefix = `${objectType}:${objectId}:`;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    const prefetchPrefix = `prefetch:${objectId}:${objectType}:`;
    for (const key of this.completedPrefetches) {
      if (key.startsWith(prefetchPrefix)) {
        this.completedPrefetches.delete(key);
      }
    }
    for (const key of this.activePrefetches.keys()) {
      if (key.startsWith(prefetchPrefix)) {
        this.activePrefetches.delete(key);
      }
    }

    keplerOrbitServiceLogger.info(
      `🧹 Cleared ${keysToDelete.length} cache entries for ${objectType}:${objectId}`,
    );
  }

  updatePrefetchConfig(config: Partial<PrefetchConfig>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...config };
    keplerOrbitServiceLogger.info(
      { prefetchConfig: this.prefetchConfig },
      "⚙️  Prefetch config updated",
    );
  }

  updateCacheStrategy(strategy: Partial<CacheStrategy>): void {
    this.cacheStrategy = { ...this.cacheStrategy, ...strategy };
    keplerOrbitServiceLogger.info(
      { cacheStrategy: this.cacheStrategy },
      "⚙️  Cache strategy updated",
    );
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    prefetchMultiplier: number;
    activePrefetches: number;
    entries: Array<{
      key: string;
      sampleCount: number;
      memoryMB: number;
      timeRange: string;
      ageMs: number;
      accessCount: number;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, data]) => ({
      key,
      sampleCount: data.sampleCount,
      memoryMB: (data.sampleCount * 32) / 1024 / 1024,
      timeRange: `${data.params.startTimeS.toFixed(0)}-${(data.params.startTimeS + data.params.durationS).toFixed(0)}s`,
      ageMs: Date.now() - data.calculatedAt.getTime(),
      accessCount: data.accessCount,
    }));

    return {
      size: this.cache.size,
      maxSize: this.cacheStrategy.maxCacheSize,
      prefetchMultiplier: this.prefetchConfig.multiplier,
      activePrefetches: this.activePrefetches.size,
      entries,
    };
  }
}

export const keplerOrbitService = new KeplerOrbitService();
