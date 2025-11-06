export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitalElements {
  starMassKg: number;
  planetMassKg: number;
  periapsisAU: number;
  apoapsisAU: number;
  inclinationDeg: number;
  longitudeOfAscendingNodeDeg: number;
  argumentOfPeriapsisDeg: number;
  meanAnomalyDeg: number;
}

export interface OrbitSample {
  timeS: number;
  position: Vector3;
}

export interface OrbitCalculationParams {
  objectId: string;
  objectType: "planet" | "moon" | "asteroid" | "comet";
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

/**
 * Database interfaces (PostgreSQL)
 */
export interface PlanetFromDB {
  id: number;
  uuid: string;
  system_id: number;
  name: string;
  internal_name: string;
  mass_kg: number;
  periapsis_au: number;
  apoapsis_au: number;
  inc_deg: number;
  node_deg: number;
  arg_peri_deg: number;
  mean_anomaly_deg: number;
  radius_km: number;
  radius_gravity_influence_km: number;
}

export interface SystemFromDB {
  id: number;
  star_mass_kg?: number; // Multiplicateur de masse solaire
}

class Vector3Math {
  static create(x: number = 0, y: number = 0, z: number = 0): Vector3 {
    return { x, y, z };
  }

  static add(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static subtract(a: Vector3, b: Vector3): Vector3 {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static multiply(v: Vector3, scalar: number): Vector3 {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  static distanceTo(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  static magnitude(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static normalize(v: Vector3): Vector3 {
    const mag = this.magnitude(v);
    if (mag === 0) return { x: 0, y: 0, z: 0 };
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }

  static dot(a: Vector3, b: Vector3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  static cross(a: Vector3, b: Vector3): Vector3 {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
}

class Basis3D {
  constructor(
    public x: Vector3 = { x: 1, y: 0, z: 0 },
    public y: Vector3 = { x: 0, y: 1, z: 0 },
    public z: Vector3 = { x: 0, y: 0, z: 1 },
  ) {}

  transform(v: Vector3): Vector3 {
    return {
      x: this.x.x * v.x + this.x.y * v.y + this.x.z * v.z,
      y: this.y.x * v.x + this.y.y * v.y + this.y.z * v.z,
      z: this.z.x * v.x + this.z.y * v.y + this.z.z * v.z,
    };
  }

  rotated(axis: Vector3, angleRad: number): Basis3D {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const axisNorm = Vector3Math.normalize(axis);

    if (Vector3Math.magnitude(axis) === 0) {
      return this;
    }

    const { x: ux, y: uy, z: uz } = axisNorm;

    const m00 = cosA + ux * ux * (1 - cosA);
    const m01 = ux * uy * (1 - cosA) - uz * sinA;
    const m02 = ux * uz * (1 - cosA) + uy * sinA;

    const m10 = uy * ux * (1 - cosA) + uz * sinA;
    const m11 = cosA + uy * uy * (1 - cosA);
    const m12 = uy * uz * (1 - cosA) - ux * sinA;

    const m20 = uz * ux * (1 - cosA) - uy * sinA;
    const m21 = uz * uy * (1 - cosA) + ux * sinA;
    const m22 = cosA + uz * uz * (1 - cosA);

    const rotVec = (v: Vector3): Vector3 => ({
      x: m00 * v.x + m01 * v.y + m02 * v.z,
      y: m10 * v.x + m11 * v.y + m12 * v.z,
      z: m20 * v.x + m21 * v.y + m22 * v.z,
    });

    return new Basis3D(rotVec(this.x), rotVec(this.y), rotVec(this.z));
  }

  inverse(): Basis3D {
    return new Basis3D(
      { x: this.x.x, y: this.y.x, z: this.z.x },
      { x: this.x.y, y: this.y.y, z: this.z.y },
      { x: this.x.z, y: this.y.z, z: this.z.z },
    );
  }

  static identity(): Basis3D {
    return new Basis3D();
  }
}

class KeplerOrbit {
  private static readonly AU_M = 1.495978707e11;
  private static readonly G = 6.6743e-11;
  private static readonly TAU = 2.0 * Math.PI;

  private basis: Basis3D;
  private orbitCenter: Vector3;
  private semiMajorAxisM: number;
  private eccentricity: number;
  private meanMotion: number;
  private meanAnomaly: number;

  constructor(
    private elements: OrbitalElements,
    private referenceTimeS: number = 0,
  ) {
    this.orbitCenter = { x: 0, y: 0, z: 0 };

    if (elements.periapsisAU > 0 || elements.apoapsisAU > 0) {
      let rpAU =
        elements.periapsisAU > 0 ? elements.periapsisAU : elements.apoapsisAU;
      let raAU =
        elements.apoapsisAU > 0 ? elements.apoapsisAU : elements.periapsisAU;

      if (raAU < rpAU) {
        [rpAU, raAU] = [raAU, rpAU];
      }

      this.semiMajorAxisM = 0.5 * (rpAU + raAU) * KeplerOrbit.AU_M;
      this.eccentricity = Math.max(
        0,
        (raAU - rpAU) / Math.max(raAU + rpAU, 1e-12),
      );

      console.log(`[KeplerOrbit] 📐 Orbit parameters:`);
      console.log(
        `   Semi-major axis: ${(this.semiMajorAxisM / 1e9).toFixed(2)} million km (${(this.semiMajorAxisM / KeplerOrbit.AU_M).toFixed(4)} AU)`,
      );
      console.log(`   Eccentricity: ${this.eccentricity.toFixed(4)}`);
      console.log(`   Periapsis: ${rpAU.toFixed(4)} AU`);
      console.log(`   Apoapsis: ${raAU.toFixed(4)} AU`);
    } else {
      throw new Error("periapsisAU and apoapsisAU must be provided");
    }

    // Calculer mean motion
    const mu =
      KeplerOrbit.G *
      Math.max(elements.starMassKg + elements.planetMassKg, 1.0);
    this.meanMotion = Math.sqrt(mu / Math.pow(this.semiMajorAxisM, 3));

    // Créer la base de rotation orbitale
    this.basis = this.createOrbitBasis(
      elements.argumentOfPeriapsisDeg,
      elements.inclinationDeg,
      elements.longitudeOfAscendingNodeDeg,
    );

    const M0 = (elements.meanAnomalyDeg * Math.PI) / 180;
    this.meanAnomaly = this.normalizeAngle(
      M0 + this.meanMotion * referenceTimeS,
    );

    console.log(
      `[KeplerOrbit] 🎯 Mean anomaly at epoch (T=0): ${elements.meanAnomalyDeg.toFixed(2)}°`,
    );
    console.log(
      `[KeplerOrbit] 🕐 Reference time: ${referenceTimeS.toFixed(2)}s`,
    );
    console.log(
      `[KeplerOrbit] 📍 Mean anomaly at T=${referenceTimeS}: ${((this.meanAnomaly * 180) / Math.PI).toFixed(2)}°`,
    );

    // Vérifier la position initiale calculée
    const initialPos = this.getPosition();
    const initialDistance = Vector3Math.magnitude(initialPos);
    console.log(`[KeplerOrbit] ✅ Initial position calculated:`);
    console.log(
      `   Distance: ${(initialDistance / 1e9).toFixed(2)} million km`,
    );
    console.log(
      `   Coordinates: (${(initialPos.x / 1e9).toFixed(2)}, ${(initialPos.y / 1e9).toFixed(2)}, ${(initialPos.z / 1e9).toFixed(2)}) million km`,
    );

    // Vérifier que la position est sur l'orbite
    const minR = this.semiMajorAxisM * (1 - this.eccentricity);
    const maxR = this.semiMajorAxisM * (1 + this.eccentricity);
    if (initialDistance < minR * 0.99 || initialDistance > maxR * 1.01) {
      console.warn(`[KeplerOrbit] ⚠️  Initial position may be off orbit!`);
      console.warn(
        `   Expected range: [${(minR / 1e9).toFixed(2)}, ${(maxR / 1e9).toFixed(2)}] million km`,
      );
      console.warn(
        `   Actual: ${(initialDistance / 1e9).toFixed(2)} million km`,
      );
    }
  }

  getOrbitalPeriod(): number {
    if (this.meanMotion === 0) return 0;
    return (2 * Math.PI) / this.meanMotion;
  }

  private createOrbitBasis(
    argPeriDeg: number,
    incDeg: number,
    nodeDeg: number,
  ): Basis3D {
    let b = Basis3D.identity();
    // Rotation sequence: Rz(Ω) * Rx(i) * Rz(ω)
    b = b.rotated({ x: 0, y: 0, z: 1 }, (nodeDeg * Math.PI) / 180);
    b = b.rotated({ x: 1, y: 0, z: 0 }, (incDeg * Math.PI) / 180);
    b = b.rotated({ x: 0, y: 0, z: 1 }, (argPeriDeg * Math.PI) / 180);
    return b;
  }

  private normalizeAngle(angle: number): number {
    let x = angle % KeplerOrbit.TAU;
    if (x < 0) x += KeplerOrbit.TAU;
    return x;
  }

  private solveKeplerEquation(M: number, e: number): number {
    const Mm = this.normalizeAngle(M);
    let E = e > 0.8 ? Math.PI : Mm;

    for (let i = 0; i < 16; i++) {
      const f = E - e * Math.sin(E) - Mm;
      const fp = 1.0 - e * Math.cos(E);
      const step = -f / Math.max(fp, 1e-12);
      E += step;
      if (Math.abs(step) < 1e-12) break;
    }

    return this.normalizeAngle(E);
  }

  private keplerPositionPlane(a: number, e: number, M: number): Vector3 {
    const E = this.solveKeplerEquation(M, e);
    const xp = a * (Math.cos(E) - e);
    const zp = a * Math.sqrt(Math.max(1.0 - e * e, 0)) * Math.sin(E);
    return { x: xp, y: 0, z: zp };
  }

  private calculatePosition(M: number): Vector3 {
    const posPlane = this.keplerPositionPlane(
      this.semiMajorAxisM,
      this.eccentricity,
      M,
    );
    return Vector3Math.add(this.orbitCenter, this.basis.transform(posPlane));
  }

  advance(dt: number): Vector3 {
    this.meanAnomaly = this.normalizeAngle(
      this.meanAnomaly + this.meanMotion * dt,
    );
    return this.calculatePosition(this.meanAnomaly);
  }

  getPosition(): Vector3 {
    return this.calculatePosition(this.meanAnomaly);
  }

  getCurrentMeanAnomaly(): number {
    return this.meanAnomaly;
  }
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
      console.log(`[KeplerOrbitService] 🔧 Prefetch disabled`);
      return requestedDuration;
    }

    if (requestedDuration < this.prefetchConfig.minDurationS) {
      console.log(`[KeplerOrbitService] 🔧 Request too short, no prefetch`);
      return requestedDuration;
    }

    const bufferDuration = requestedDuration * this.prefetchConfig.multiplier;
    const totalDuration = requestedDuration + bufferDuration;

    // Appliquer la limite max
    const finalDuration = Math.min(
      totalDuration,
      this.prefetchConfig.maxDurationS,
    );

    console.log(
      `[KeplerOrbitService] 🔧 Prefetch: ${requestedDuration.toFixed(1)}s × ${this.prefetchConfig.multiplier} = ${finalDuration.toFixed(1)}s`,
    );

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
    console.log(
      `[KeplerOrbitService] 🕐 Calculating orbit starting at T=${params.startTimeS}s`,
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
    console.log(
      `[KeplerOrbitService] 🚀 Calculated ${steps} positions in ${duration.toFixed(2)}ms (${((steps / duration) * 1000).toFixed(0)} samples/sec)`,
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
      console.log(
        `[KeplerOrbitService] ❌ Cache MISS for ${params.objectId} (no data)`,
      );
      return null;
    }

    // Vérifier expiration
    const age = Date.now() - cached.calculatedAt.getTime();
    if (age >= this.cacheStrategy.cacheExpirationMs) {
      console.log(
        `[KeplerOrbitService] ⏰ Cache EXPIRED for ${params.objectId}`,
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
      console.log(
        `[KeplerOrbitService] ✅ Cache HIT for ${params.objectId} (covers ${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s from cached ${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s)`,
      );
      return cached;
    }

    console.log(
      `[KeplerOrbitService] ⚠️  Cache PARTIAL for ${params.objectId}`,
    );
    console.log(
      `   Cached:    ${cachedStart.toFixed(0)}-${cachedEnd.toFixed(0)}s (${cached.samples.length} samples)`,
    );
    console.log(
      `   Requested: ${requestedStart.toFixed(0)}-${requestedEnd.toFixed(0)}s`,
    );
    console.log(`   → Cache does NOT cover requested range, will recalculate`);

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
      console.log(
        `[KeplerOrbitService] 🗑️  Evicted cache entry: ${keyToEvict}`,
      );
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
      Math.floor((startTimeS - cached.params.startTimeS) / timestepS),
    );
    const endIndex = Math.min(
      cached.samples.length,
      Math.ceil((endTimeS - cached.params.startTimeS) / timestepS),
    );

    const subset = cached.samples.slice(startIndex, endIndex);

    console.log(
      `[KeplerOrbitService] ✂️  Extracted ${subset.length} samples [${startIndex}-${endIndex}] from cache of ${cached.samples.length}`,
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

    // ✅ Vérifier si déjà fait OU en cours
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

    console.log(
      `[KeplerOrbitService] 🔮 Prefetch at ${(cacheProgress * 100).toFixed(0)}% (T=${currentTimeS.toFixed(0)}s)`,
    );

    // ✅ Marquer comme en cours
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

        console.log(
          `[KeplerOrbitService] ✅ Prefetch ready (temp): ${samples.length.toLocaleString()} samples`,
        );

        // ✅ Marquer comme complété de manière permanente
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

    // ✅ VÉRIFIER ET PROMOUVOIR LE PREFETCH
    const tempKey = `${cacheKey}:next`;
    const prefetched = this.cache.get(tempKey);

    if (prefetched) {
      const prefetchStart = prefetched.params.startTimeS;
      const prefetchEnd =
        prefetched.params.startTimeS + prefetched.params.durationS;

      // Si on a atteint ou dépassé le début du nouveau cache
      if (normalizedParams.startTimeS >= prefetchStart) {
        console.log(
          `[KeplerOrbitService] 🔄 Promoting prefetch: ${prefetchStart.toFixed(0)}-${prefetchEnd.toFixed(0)}s`,
        );

        // Supprimer l'ancien cache
        this.cache.delete(cacheKey);

        // Promouvoir le prefetch
        this.cache.set(cacheKey, prefetched);
        this.cache.delete(tempKey);

        // ✅ NETTOYER les flags de prefetch de l'ancien cache
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

    // Cache MISS
    console.log(`[KeplerOrbitService] ❌ Cache MISS, calculating...`);

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
    console.log(
      `[KeplerOrbitService] 🚀 ${samples.length.toLocaleString()} samples in ${calcTime.toFixed(1)}ms (~${memoryMB.toFixed(1)} MB)`,
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
    console.log("[KeplerOrbitService] 🧹 Cache cleared");
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

    // ✅ Nettoyer aussi les flags de prefetch
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

    console.log(
      `[KeplerOrbitService] 🧹 Cleared ${keysToDelete.length} cache entries for ${objectType}:${objectId}`,
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

  updatePrefetchConfig(config: Partial<PrefetchConfig>): void {
    this.prefetchConfig = { ...this.prefetchConfig, ...config };
    console.log(
      "[KeplerOrbitService] ⚙️  Prefetch config updated:",
      this.prefetchConfig,
    );
  }

  updateCacheStrategy(strategy: Partial<CacheStrategy>): void {
    this.cacheStrategy = { ...this.cacheStrategy, ...strategy };
    console.log(
      "[KeplerOrbitService] ⚙️  Cache strategy updated:",
      this.cacheStrategy,
    );
  }

  /**
   * Convert PostgreSQL planet data to OrbitalElements
   */
  static planetDBToOrbitalElements(
    planet: PlanetFromDB,
    system: SystemFromDB,
  ): OrbitalElements {
    const SOLAR_MASS_KG = 1.98847e30;
    const starMassMultiplier = system.star_mass_kg ?? 0.758581416228569;

    return {
      starMassKg: SOLAR_MASS_KG * starMassMultiplier,
      planetMassKg: planet.mass_kg,
      periapsisAU: planet.periapsis_au,
      apoapsisAU: planet.apoapsis_au,
      inclinationDeg: planet.inc_deg,
      longitudeOfAscendingNodeDeg: planet.node_deg,
      argumentOfPeriapsisDeg: planet.arg_peri_deg,
      meanAnomalyDeg: planet.mean_anomaly_deg,
    };
  }
}

/**
 * Singleton instance
 */
export const keplerOrbitService = new KeplerOrbitService();

/**
 * Helper functions for database integration
 */
export class OrbitDataHelper {
  /**
   * Create OrbitCalculationParams from database planet
   */
  static createParamsFromDB(
    planet: PlanetFromDB,
    system: SystemFromDB,
    startTimeS: number = 0,
    durationS: number = 3600,
    timestepS: number = 0.01666667,
  ): OrbitCalculationParams {
    return {
      objectId: planet.uuid,
      objectType: "planet",
      startTimeS,
      durationS,
      timestepS,
      orbitalElements: KeplerOrbitService.planetDBToOrbitalElements(
        planet,
        system,
      ),
    };
  }

  /**
   * Validate orbital elements consistency
   */
  static validateOrbitalElements(elements: OrbitalElements): {
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
    if (elements.starMassKg <= 0 || elements.planetMassKg <= 0) {
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
  static getOrbitalInfo(elements: OrbitalElements): {
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

    const mu = G * (elements.starMassKg + elements.planetMassKg);
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
    pos1: Vector3,
    pos2: Vector3,
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
}
