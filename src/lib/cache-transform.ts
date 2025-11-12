import type { Vector3Type } from "@websocket/schema/vector3.model";

import { cacheTransformLogger, logError } from "./logger";

export interface Transform {
  timeS: number;
  position: Vector3Type;
}

export interface CacheCalculationParams {
  objectId: string;
  startTime: number;
  duration: number;
  frequency: number;
}

export interface CachedData {
  params: CacheCalculationParams;
  transforms: Transform[];
  calculatedAt: Date;
  transformCount: number;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface SaveCachedData extends Omit<CachedData, "transforms"> {
  transforms: Float64Array;
}

export interface PrefetchConfig {
  enabled: boolean;
  multiplier: number;
  maxTransformCount: number;
  minDuration: number;
  autoThreshold: number;
}

export interface CacheStrategy {
  maxCacheSize: number;
  cacheExpirationMs: number;
  evictionPolicy: "lru" | "lfu" | "fifo";
}

/**
 * Use for stat memory
 * timeS	float64	8 octets
 * position.x	float64	8 octets
 * position.y	float64	8 octets
 * position.z	float64	8 octets
 */
const BYTES_PER_TRANSFORM = 32;

export class CacheTransform {
  private cache: Map<string, SaveCachedData> = new Map();
  private activePrefetches: Map<string, Promise<void>> = new Map();
  private completedPrefetches: Set<string> = new Set();

  private cacheStrategy: CacheStrategy = {
    maxCacheSize: 100,
    cacheExpirationMs: 60000,
    evictionPolicy: "lru",
  };

  private prefetchConfig: PrefetchConfig = {
    enabled: true,
    multiplier: 300,
    maxTransformCount: 10000,
    minDuration: 1,
    autoThreshold: 0.7,
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

  private getCacheKey(objectId: string, frequency: number): string {
    return `${objectId}:${frequency.toFixed(6)}`;
  }

  private getPrefetchKey(objectId: string, frequency: number): string {
    return `prefetch:${this.getCacheKey(objectId, frequency)}`;
  }

  private findMatchingCache(params: CacheCalculationParams): CachedData | null {
    const cacheKey = this.getCacheKey(params.objectId, params.frequency);

    const cached = this.getCache(cacheKey);

    if (!cached) {
      cacheTransformLogger.debug(
        {
          objectId: params.objectId,
        },
        `❌ Cache MISS for ${params.objectId} (no data)`,
      );
      return null;
    }

    // Check expiration
    const age = Date.now() - cached.calculatedAt.getTime();
    if (age >= this.cacheStrategy.cacheExpirationMs) {
      cacheTransformLogger.debug(
        {
          objectId: params.objectId,
        },
        `⏰ Cache EXPIRED for ${params.objectId}`,
      );

      this.cache.delete(cacheKey);
      return null;
    }

    const cachedStart = cached.params.startTime;
    const cachedEnd = cached.params.startTime + cached.params.duration;
    const requestedStart = params.startTime;
    const requestedEnd = params.startTime + params.duration;

    const tolerance = 1 / params.frequency;

    if (
      requestedStart >= cachedStart - tolerance &&
      requestedEnd <= cachedEnd + tolerance
    ) {
      this.incrementAccessCount(cacheKey);
      this.updateLastAccessAt(cacheKey);
      cacheTransformLogger.debug(
        {
          objectId: params.objectId,
          cached: `${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.transforms.length} samples)`,
          request: `${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s`,
        },
        `✅ Cache HIT for ${params.objectId}`,
      );
      return cached;
    }

    cacheTransformLogger.debug(
      {
        objectId: params.objectId,
        cached: `${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.transforms.length} samples)`,
        request: `${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s`,
      },
      `⚠️  Cache PARTIAL for ${params.objectId}`,
    );

    return null;
  }

  /**
   * Automatic cache eviction to limit memory usage
   *
   * Automatically removes a cache entry when the maximum size is reached,
   * according to the configured eviction policy:
   * - **LRU** (Least Recently Used): Removes the entry not accessed for the longest time
   * - **LFU** (Least Frequently Used): Removes the entry with the fewest accesses
   * - **FIFO** (First In, First Out): Removes the oldest entry
   *
   * This method is called before each cache insertion to prevent
   * excessive growth of memory usage.
   *
   * @example
   * // With maxCacheSize = 100 and 100 planets in cache
   * // When adding a 101st planet, the least used one will be removed
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
      cacheTransformLogger.debug(`🗑️  Evicted cache entry: ${keyToEvict}`);
    }
  }

  private extractSubset(
    cached: CachedData,
    startTime: number,
    duration: number,
  ): Transform[] {
    const endTime = startTime + duration;
    const timestep = 1 / cached.params.frequency;

    const startIndex = Math.max(
      0,
      Math.ceil((startTime - cached.params.startTime) / timestep),
    );
    const endIndex = Math.min(
      cached.transforms.length,
      Math.ceil((endTime - cached.params.startTime) / timestep),
    );

    const subset = cached.transforms.slice(startIndex, endIndex);

    cacheTransformLogger.debug(
      {
        startIndex,
        endIndex,
        count: subset.length,
        cacheSize: cached.transforms.length,
      },
      `✂️  Extracted ${subset.length} samples [${startIndex}-${endIndex}] from cache of ${cached.transforms.length}`,
    );

    return subset;
  }

  private calculatePrefetchDuration(
    requestedDuration: number,
    frequency: number,
  ): number {
    if (!this.prefetchConfig.enabled) {
      cacheTransformLogger.info(`🔧 Prefetch disabled`);
      return requestedDuration;
    }

    const timeStep = 1 / frequency;

    if (requestedDuration < this.prefetchConfig.minDuration) {
      cacheTransformLogger.debug(
        { requestedDuration, minDuration: this.prefetchConfig.minDuration },
        `🔧 Request too short, no prefetch`,
      );
      return requestedDuration;
    }

    const bufferDuration = requestedDuration * this.prefetchConfig.multiplier;
    const totalDuration = requestedDuration + bufferDuration;

    const maxDurationSamples = this.prefetchConfig.maxTransformCount * timeStep;

    const finalDuration = Math.min(totalDuration, maxDurationSamples);

    cacheTransformLogger.debug(
      {
        requestedDuration,
        multiplier: this.prefetchConfig.multiplier,
        finalDuration,
        maxTransformCount: this.prefetchConfig.maxTransformCount,
        timeStep,
        frequency,
      },
      `🔧 Prefetch: ${requestedDuration.toFixed(1)}s (step=${timeStep}) x ${this.prefetchConfig.multiplier} = ${finalDuration.toFixed(1)}s [Max ${this.prefetchConfig.maxTransformCount} pts]`,
    );

    return finalDuration;
  }

  private normalizeCache(transforms: Transform[]): Float64Array {
    const arr = new Float64Array(transforms.length * 4);
    transforms.forEach((transform, i) => {
      const idx = i * 4;
      arr[idx] = transform.timeS;
      arr[idx + 1] = transform.position.x;
      arr[idx + 2] = transform.position.y;
      arr[idx + 3] = transform.position.z;
    });
    return arr;
  }

  private denormalizeCache(arr: Float64Array): Transform[] {
    const transforms: Transform[] = [];
    for (let i = 0; i < arr.length; i += 4) {
      transforms.push({
        timeS: arr[i],
        position: { x: arr[i + 1], y: arr[i + 2], z: arr[i + 3] },
      });
    }
    return transforms;
  }

  private setCache(tempKey: string, cachedData: CachedData | SaveCachedData) {
    if (
      Array.isArray(cachedData.transforms[0]) &&
      cachedData.transforms.length > 0 &&
      "timeS" in cachedData.transforms[0]
    ) {
      this.cache.set(tempKey, cachedData as SaveCachedData);
    } else {
      this.cache.set(tempKey, {
        ...cachedData,
        transforms: this.normalizeCache(cachedData.transforms as Transform[]),
      });
    }
  }

  private getCache(tempKey: string): CachedData | null {
    const cache = this.cache.get(tempKey);
    if (!cache) {
      return null;
    }

    return { ...cache, transforms: this.denormalizeCache(cache.transforms) };
  }

  private incrementAccessCount(cacheKey: string): void {
    const cache = this.cache.get(cacheKey);
    if (!cache) {
      return;
    }
    cache.accessCount++;
  }

  private updateLastAccessAt(cacheKey: string): void {
    const cache = this.cache.get(cacheKey);
    if (!cache) {
      return;
    }
    cache.lastAccessedAt = new Date();
  }

  private checkAndPrefetch<T extends CacheCalculationParams>(
    cached: CachedData,
    params: CacheCalculationParams,
    calculateFn: (params: T) => Transform[],
  ): void {
    const cacheStart = params.startTime + params.duration;
    const cacheEnd = cached.params.startTime + cached.params.duration;
    const cacheProgress =
      (cacheStart - cached.params.startTime) / cached.params.duration;

    if (cacheProgress < this.prefetchConfig.autoThreshold) {
      return;
    }

    if (params.duration < this.prefetchConfig.minDuration) {
      cacheTransformLogger.debug(
        {
          requestedDuration: params.duration,
          minDuration: this.prefetchConfig.minDuration,
        },
        `🔧 Request too short, no prefetch`,
      );
      return;
    }

    const prefetchKey = this.getPrefetchKey(params.objectId, cacheEnd);

    if (
      this.activePrefetches.has(prefetchKey) ||
      this.completedPrefetches.has(prefetchKey)
    ) {
      return;
    }

    const cacheKey = this.getCacheKey(params.objectId, params.frequency);

    const tempKey = `${cacheKey}:next`;

    if (this.cache.has(tempKey)) {
      return;
    }

    cacheTransformLogger.debug(
      { cacheKey },
      `🔮 Prefetch at ${(cacheProgress * 100).toFixed(0)}% (T=${params.startTime.toFixed(0)}s)`,
    );

    this.activePrefetches.set(prefetchKey, Promise.resolve());

    try {
      const cacheDuration = this.calculatePrefetchDuration(
        params.duration,
        params.frequency,
      );
      const nextParams = {
        ...params,
        startTime: cacheEnd,
        duration: cacheDuration,
      } as T;

      const transforms = calculateFn(nextParams);

      if (transforms.length > 0) {
        this.setCache(tempKey, {
          params: nextParams,
          transforms,
          calculatedAt: new Date(),
          transformCount: transforms.length,
          accessCount: 0,
          lastAccessedAt: new Date(),
        });

        cacheTransformLogger.debug(
          `✅ Prefetch ready (temp): ${transforms.length.toLocaleString()} transforms`,
        );

        this.completedPrefetches.add(prefetchKey);
      }
    } catch (error) {
      logError(cacheTransformLogger, error, {
        context: "checkAndPrefetch",
        msg: "❌ Prefetch failed",
      });
    } finally {
      this.activePrefetches.delete(prefetchKey);
    }
  }

  getTransforms<T extends CacheCalculationParams>(
    params: T,
    calculateFn: (params: T) => Transform[],
  ): Transform[] {
    const normalizedParams = { ...params };

    const cacheKey = this.getCacheKey(params.objectId, params.frequency);

    const cache = this.cache;
    const tempKey = `${cacheKey}:next`;
    const prefetched = this.getCache(tempKey);

    if (prefetched) {
      const prefetchStart = prefetched.params.startTime;
      const prefetchEnd =
        prefetched.params.startTime + prefetched.params.duration;

      if (normalizedParams.startTime >= prefetchStart) {
        cacheTransformLogger.debug(
          `🔄 Promoting prefetch: ${prefetchStart.toFixed(0)}-${prefetchEnd.toFixed(0)}s`,
        );

        cache.delete(cacheKey);
        this.setCache(cacheKey, prefetched);
        cache.delete(tempKey);

        const oldCacheEnd = prefetchStart;
        const oldPrefetchKey = this.getPrefetchKey(
          params.objectId,
          oldCacheEnd,
        );
        this.completedPrefetches.delete(oldPrefetchKey);
      }
    }

    const cached = this.findMatchingCache(normalizedParams);

    if (cached) {
      const subset = this.extractSubset(
        cached,
        normalizedParams.startTime,
        normalizedParams.duration,
      );

      if (subset.length > 0) {
        if (this.prefetchConfig.enabled) {
          this.checkAndPrefetch(cached, normalizedParams, calculateFn);
        }
        return subset;
      }
    }

    cacheTransformLogger.debug("❌ Cache MISS, calculating...");

    const cacheDuration = this.calculatePrefetchDuration(
      normalizedParams.duration,
      normalizedParams.frequency,
    );

    const cacheParams = {
      ...normalizedParams,
      startTime: normalizedParams.startTime,
      duration: cacheDuration,
    } as T;

    const startCalc = performance.now();
    const transforms = calculateFn(cacheParams);
    const calcTime = performance.now() - startCalc;

    if (transforms.length === 0) {
      throw new Error("Failed to calculate orbital transforms");
    }

    const memoryMB = (transforms.length * BYTES_PER_TRANSFORM) / 1024 / 1024;
    cacheTransformLogger.debug(
      `💾 ${transforms.length.toLocaleString()} transforms in ${calcTime.toFixed(1)}ms (~${memoryMB.toFixed(2)} MB)`,
    );

    this.evictCache();
    this.cache.delete(tempKey);

    this.setCache(cacheKey, {
      params: cacheParams,
      transforms,
      calculatedAt: new Date(),
      transformCount: transforms.length,
      accessCount: 1,
      lastAccessedAt: new Date(),
    });

    const result = this.extractSubset(
      this.getCache(cacheKey) as CachedData,
      normalizedParams.startTime,
      normalizedParams.duration,
    );

    if (result.length === 0) {
      throw new Error("extractSubset failed");
    }

    return result;
  }

  updatePrefetchConfig(config: Partial<PrefetchConfig>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...config };
    cacheTransformLogger.info(
      { prefetchConfig: this.prefetchConfig },
      "⚙️  Prefetch config updated",
    );
  }

  updateCacheStrategy(strategy: Partial<CacheStrategy>): void {
    this.cacheStrategy = { ...this.cacheStrategy, ...strategy };
    cacheTransformLogger.info(
      { cacheStrategy: this.cacheStrategy },
      "⚙️  Cache strategy updated",
    );
  }

  clearCache(): void {
    this.cache.clear();
    this.completedPrefetches.clear();
    this.activePrefetches.clear();
    cacheTransformLogger.info("🧹 Cache cleared");
  }

  clearCacheForObject(objectId: string): void {
    const prefix = `${objectId}:`;
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));

    const prefetchPrefix = `prefetch:${objectId}:`;
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

    cacheTransformLogger.info(
      `🧹 Cleared ${keysToDelete.length} cache entries for ${objectId}`,
    );
  }

  getCacheStats(): {
    size: number;
    maxSize: number;
    prefetchMultiplier: number;
    activePrefetches: number;
    maxSampleCount: number;
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
      sampleCount: data.transformCount,
      memoryMB: (data.transformCount * BYTES_PER_TRANSFORM) / 1024 / 1024,
      timeRange: `${data.params.startTime.toFixed(3)}-${(data.params.startTime + data.params.duration).toFixed(3)}s`,
      ageMs: Date.now() - data.calculatedAt.getTime(),
      accessCount: data.accessCount,
      lastAccessAt: data.lastAccessedAt,
    }));

    return {
      size: this.cache.size,
      maxSize: this.cacheStrategy.maxCacheSize,
      prefetchMultiplier: this.prefetchConfig.multiplier,
      activePrefetches: this.activePrefetches.size,
      maxSampleCount: this.prefetchConfig.maxTransformCount,
      entries,
    };
  }
}
