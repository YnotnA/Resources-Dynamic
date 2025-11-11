import type { Vector3Type } from "@websocket/schema/vector3.model";

import { cachePositionLogger, logError } from "./logger";

export interface Position {
  timeS: number;
  position: Vector3Type;
}

export interface CacheCalculationParams {
  objectId: string;
  startTimeS: number;
  durationS: number;
  timestepS: number;
}

export interface CachedData {
  params: CacheCalculationParams;
  positions: Position[];
  calculatedAt: Date;
  sampleCount: number;
  accessCount: number;
  lastAccessedAt: Date;
}

export interface SaveCachedData extends Omit<CachedData, "positions"> {
  positions: Float64Array;
}

export interface PrefetchConfig {
  enabled: boolean;
  multiplier: number;
  maxPositionCount: number;
  minDurationS: number;
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
const BYTES_PER_POSITION = 32;

export class CachePosition {
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
    maxPositionCount: 10000,
    minDurationS: 5,
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

  private getCacheKey(objectId: string, timestepS: number): string {
    return `${objectId}:${timestepS.toFixed(6)}`;
  }

  private getPrefetchKey(objectId: string, timestepS: number): string {
    return `prefetch:${this.getCacheKey(objectId, timestepS)}`;
  }

  private findMatchingCache(params: CacheCalculationParams): CachedData | null {
    const cacheKey = this.getCacheKey(params.objectId, params.timestepS);

    const cached = this.getCache(cacheKey);

    if (!cached) {
      cachePositionLogger.debug(
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
      cachePositionLogger.debug(
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
      this.incrementAccessCount(cacheKey);
      this.updateLastAccessAt(cacheKey);
      cachePositionLogger.debug(
        {
          objectId: params.objectId,
          cached: `${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.positions.length} samples)`,
          request: `${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s`,
        },
        `✅ Cache HIT for ${params.objectId}`,
      );
      return cached;
    }

    cachePositionLogger.debug(
      {
        objectId: params.objectId,
        cached: `${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.positions.length} samples)`,
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
      cachePositionLogger.debug(`🗑️  Evicted cache entry: ${keyToEvict}`);
    }
  }

  private extractSubset(
    cached: CachedData,
    startTimeS: number,
    durationS: number,
  ): Position[] {
    const endTimeS = startTimeS + durationS;
    const timestepS = cached.params.timestepS;

    const startIndex = Math.max(
      0,
      Math.ceil((startTimeS - cached.params.startTimeS) / timestepS),
    );
    const endIndex = Math.min(
      cached.positions.length,
      Math.ceil((endTimeS - cached.params.startTimeS) / timestepS),
    );

    const subset = cached.positions.slice(startIndex, endIndex);

    cachePositionLogger.debug(
      {
        startIndex,
        endIndex,
        count: subset.length,
        cacheSize: cached.positions.length,
      },
      `✂️  Extracted ${subset.length} samples [${startIndex}-${endIndex}] from cache of ${cached.positions.length}`,
    );

    return subset;
  }

  private calculatePrefetchDuration(
    requestedDuration: number,
    timestepS: number,
  ): number {
    if (!this.prefetchConfig.enabled) {
      cachePositionLogger.info(`🔧 Prefetch disabled`);
      return requestedDuration;
    }

    if (requestedDuration < this.prefetchConfig.minDurationS) {
      cachePositionLogger.debug(
        { requestedDuration, minDuration: this.prefetchConfig.minDurationS },
        `🔧 Request too short, no prefetch`,
      );
      return requestedDuration;
    }

    const bufferDuration = requestedDuration * this.prefetchConfig.multiplier;
    const totalDuration = requestedDuration + bufferDuration;

    const maxDurationSamples = this.prefetchConfig.maxPositionCount * timestepS;

    const finalDuration = Math.min(totalDuration, maxDurationSamples);

    cachePositionLogger.debug(
      {
        requestedDuration,
        multiplier: this.prefetchConfig.multiplier,
        finalDuration,
        maxPositionCount: this.prefetchConfig.maxPositionCount,
        timestepS,
      },
      `🔧 Prefetch: ${requestedDuration.toFixed(1)}s (step=${timestepS}) x ${this.prefetchConfig.multiplier} = ${finalDuration.toFixed(1)}s [Max ${this.prefetchConfig.maxPositionCount} pts]`,
    );

    return finalDuration;
  }

  private normalizeCache(positions: Position[]): Float64Array {
    const arr = new Float64Array(positions.length * 4);
    positions.forEach((pos, i) => {
      const idx = i * 4;
      arr[idx] = pos.timeS;
      arr[idx + 1] = pos.position.x;
      arr[idx + 2] = pos.position.y;
      arr[idx + 3] = pos.position.z;
    });
    return arr;
  }

  private denormalizeCache(arr: Float64Array): Position[] {
    const positions: Position[] = [];
    for (let i = 0; i < arr.length; i += 4) {
      positions.push({
        timeS: arr[i],
        position: { x: arr[i + 1], y: arr[i + 2], z: arr[i + 3] },
      });
    }
    return positions;
  }

  private setCache(tempKey: string, cachedData: CachedData | SaveCachedData) {
    if (
      Array.isArray(cachedData.positions[0]) &&
      cachedData.positions.length > 0 &&
      "timeS" in cachedData.positions[0]
    ) {
      this.cache.set(tempKey, cachedData as SaveCachedData);
    } else {
      this.cache.set(tempKey, {
        ...cachedData,
        positions: this.normalizeCache(cachedData.positions as Position[]),
      });
    }
  }

  private getCache(tempKey: string): CachedData | null {
    const cache = this.cache.get(tempKey);
    if (!cache) {
      return null;
    }

    return { ...cache, positions: this.denormalizeCache(cache.positions) };
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

  /**
   * Check and prefetch with custom calculation function
   */
  private checkAndPrefetch<T extends CacheCalculationParams>(
    cached: CachedData,
    params: CacheCalculationParams,
    calculateFn: (params: T) => Position[],
  ): void {
    const cacheStart = params.startTimeS + params.durationS;
    const cacheEnd = cached.params.startTimeS + cached.params.durationS;
    const cacheProgress =
      (cacheStart - cached.params.startTimeS) / cached.params.durationS;

    if (cacheProgress < this.prefetchConfig.autoThreshold) {
      return;
    }

    if (params.durationS < this.prefetchConfig.minDurationS) {
      cachePositionLogger.debug(
        {
          requestedDuration: params.durationS,
          minDuration: this.prefetchConfig.minDurationS,
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

    const cacheKey = this.getCacheKey(params.objectId, params.timestepS);

    const tempKey = `${cacheKey}:next`;

    if (this.cache.has(tempKey)) {
      return;
    }

    cachePositionLogger.debug(
      { cacheKey },
      `🔮 Prefetch at ${(cacheProgress * 100).toFixed(0)}% (T=${params.startTimeS.toFixed(0)}s)`,
    );

    this.activePrefetches.set(prefetchKey, Promise.resolve());

    try {
      const cacheDuration = this.calculatePrefetchDuration(
        params.durationS,
        params.timestepS,
      );
      const nextParams = {
        ...params,
        startTimeS: cacheEnd,
        durationS: cacheDuration,
      } as T;

      const positions = calculateFn(nextParams);

      if (positions.length > 0) {
        this.setCache(tempKey, {
          params: nextParams,
          positions,
          calculatedAt: new Date(),
          sampleCount: positions.length,
          accessCount: 0,
          lastAccessedAt: new Date(),
        });

        cachePositionLogger.debug(
          `✅ Prefetch ready (temp): ${positions.length.toLocaleString()} positions`,
        );

        this.completedPrefetches.add(prefetchKey);
      }
    } catch (error) {
      logError(cachePositionLogger, error, {
        context: "checkAndPrefetch",
        msg: "❌ Prefetch failed",
      });
    } finally {
      this.activePrefetches.delete(prefetchKey);
    }
  }

  /**
   * Get positions with respect to maxSampleCount
   */
  getPositions<T extends CacheCalculationParams>(
    params: T,
    calculateFn: (params: T) => Position[],
  ): Position[] {
    const normalizedParams = { ...params };

    const cacheKey = this.getCacheKey(params.objectId, params.timestepS);

    const cache = this.cache;
    const tempKey = `${cacheKey}:next`;
    const prefetched = this.getCache(tempKey);

    if (prefetched) {
      const prefetchStart = prefetched.params.startTimeS;
      const prefetchEnd =
        prefetched.params.startTimeS + prefetched.params.durationS;

      if (normalizedParams.startTimeS >= prefetchStart) {
        cachePositionLogger.debug(
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

    // Check cache
    const cached = this.findMatchingCache(normalizedParams);

    if (cached) {
      const subset = this.extractSubset(
        cached,
        normalizedParams.startTimeS,
        normalizedParams.durationS,
      );

      if (subset.length > 0) {
        if (this.prefetchConfig.enabled) {
          this.checkAndPrefetch(cached, normalizedParams, calculateFn);
        }
        return subset;
      }
    }

    cachePositionLogger.debug("❌ Cache MISS, calculating...");

    const cacheDuration = this.calculatePrefetchDuration(
      normalizedParams.durationS,
      normalizedParams.timestepS,
    );

    const cacheParams = {
      ...normalizedParams,
      startTimeS: normalizedParams.startTimeS,
      durationS: cacheDuration,
    } as T;

    const startCalc = performance.now();
    const positions = calculateFn(cacheParams);
    const calcTime = performance.now() - startCalc;

    if (positions.length === 0) {
      throw new Error("Failed to calculate orbital positions");
    }

    const memoryMB = (positions.length * BYTES_PER_POSITION) / 1024 / 1024;
    cachePositionLogger.debug(
      `💾 ${positions.length.toLocaleString()} positions in ${calcTime.toFixed(1)}ms (~${memoryMB.toFixed(2)} MB)`,
    );

    this.evictCache();
    this.cache.delete(tempKey);

    this.setCache(cacheKey, {
      params: cacheParams,
      positions,
      calculatedAt: new Date(),
      sampleCount: positions.length,
      accessCount: 1,
      lastAccessedAt: new Date(),
    });

    const result = this.extractSubset(
      this.getCache(cacheKey) as CachedData,
      normalizedParams.startTimeS,
      normalizedParams.durationS,
    );

    if (result.length === 0) {
      throw new Error("extractSubset failed");
    }

    return result;
  }

  updatePrefetchConfig(config: Partial<PrefetchConfig>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...config };
    cachePositionLogger.info(
      { prefetchConfig: this.prefetchConfig },
      "⚙️  Prefetch config updated",
    );
  }

  updateCacheStrategy(strategy: Partial<CacheStrategy>): void {
    this.cacheStrategy = { ...this.cacheStrategy, ...strategy };
    cachePositionLogger.info(
      { cacheStrategy: this.cacheStrategy },
      "⚙️  Cache strategy updated",
    );
  }

  clearCache(): void {
    this.cache.clear();
    this.completedPrefetches.clear();
    this.activePrefetches.clear();
    cachePositionLogger.info("🧹 Cache cleared");
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

    cachePositionLogger.info(
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
      sampleCount: data.sampleCount,
      memoryMB: (data.sampleCount * BYTES_PER_POSITION) / 1024 / 1024,
      timeRange: `${data.params.startTimeS.toFixed(3)}-${(data.params.startTimeS + data.params.durationS).toFixed(3)}s`,
      ageMs: Date.now() - data.calculatedAt.getTime(),
      accessCount: data.accessCount,
      lastAccessAt: data.lastAccessedAt,
    }));

    return {
      size: this.cache.size,
      maxSize: this.cacheStrategy.maxCacheSize,
      prefetchMultiplier: this.prefetchConfig.multiplier,
      activePrefetches: this.activePrefetches.size,
      maxSampleCount: this.prefetchConfig.maxPositionCount,
      entries,
    };
  }
}
