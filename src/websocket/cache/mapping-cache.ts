import { db } from "@db/connection";
import type { CelestialBodyType } from "@db/schema";
import { type CelestialBodyMapping, celestialBodiesMapping } from "@db/schema";
import {
  cacheLogger,
  createTimer,
  logError,
  logPerformance,
} from "@lib/logger";

/**
 * In-memory cache for UUID → ID mapping
 * Loaded once when the WebSocket starts up
 */
class MappingCache {
  private uuidToMappingMap: Map<string, CelestialBodyMapping> = new Map();
  private idToUuidMap: Map<string, string> = new Map(); // key: "type:id"
  private isLoaded: boolean = false;
  private lastSync: Date | null = null;

  /**
   * Loads all mappings into memory from the table via Drizzle
   */
  async load(): Promise<void> {
    try {
      const timer = createTimer();
      cacheLogger.info("📥 Loading celestial bodies mapping cache...");

      const mappings: CelestialBodyMapping[] = await db
        .select()
        .from(celestialBodiesMapping);

      this.uuidToMappingMap.clear();
      this.idToUuidMap.clear();

      for (const mapping of mappings) {
        // UUID → Complete mapping
        this.uuidToMappingMap.set(mapping.uuid, mapping);

        // ID → UUID (for reverse lookup)
        const key = `${mapping.type}:${mapping.id}`;
        this.idToUuidMap.set(key, mapping.uuid);
      }

      this.isLoaded = true;
      this.lastSync = new Date();

      const duration = timer.end();
      const stats = this.getStats();

      cacheLogger.debug(
        {
          duration,
          totalEntries: stats.totalEntries,
          byType: stats.byType,
          memoryKB: stats.memoryUsageKB,
        },
        "✅ Cache loaded successfully",
      );

      logPerformance(cacheLogger, "Load cache", duration);
    } catch (error) {
      logError(cacheLogger, error, { context: "load" });
      throw error;
    }
  }

  async reload(): Promise<void> {
    cacheLogger.info("🔄 Reloading mapping cache...");
    await this.load();
  }

  getAll(): CelestialBodyMapping[] {
    return Array.from(this.uuidToMappingMap.values());
  }

  getByUuid(uuid: string): CelestialBodyMapping | undefined {
    if (!this.isLoaded) {
      cacheLogger.warn("⚠️ Cache not loaded, call load() first");
      return undefined;
    }
    return this.uuidToMappingMap.get(uuid);
  }

  getIdByUuid(uuid: string): number | undefined {
    return this.getByUuid(uuid)?.id;
  }

  getUuidById(type: CelestialBodyType, id: number): string | undefined {
    if (!this.isLoaded) {
      cacheLogger.warn("⚠️ Cache not loaded, call load() first");
      return undefined;
    }
    return this.idToUuidMap.get(`${type}:${id}`);
  }

  getBatchByUuids(uuids: string[]): CelestialBodyMapping[] {
    return uuids
      .map((uuid) => this.getByUuid(uuid))
      .filter((m): m is CelestialBodyMapping => m !== undefined);
  }

  getBySystemId(systemId: number): CelestialBodyMapping[] {
    return this.getAll().filter((m) => m.systemId === systemId);
  }

  getByType(type: CelestialBodyType): CelestialBodyMapping[] {
    return this.getAll().filter((m) => m.type === type);
  }

  getMoonsByPlanetId(planetId: number): CelestialBodyMapping[] {
    return this.getAll().filter(
      (m) => m.type === "moon" && m.parentId === planetId,
    );
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  getStats() {
    const byType = {
      stars: this.getByType("star").length,
      planets: this.getByType("planet").length,
      moons: this.getByType("moon").length,
    };

    return {
      isLoaded: this.isLoaded,
      totalEntries: this.uuidToMappingMap.size,
      byType,
      lastSync: this.lastSync,
      memoryUsageKB: Math.round(JSON.stringify(this.getAll()).length / 1024),
    };
  }

  clear(): void {
    this.uuidToMappingMap.clear();
    this.idToUuidMap.clear();
    this.isLoaded = false;
    this.lastSync = null;
    cacheLogger.info("🗑️ Cache cleared");
  }

  searchByName(query: string): CelestialBodyMapping[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter((m) =>
      m.name.toLowerCase().includes(lowerQuery),
    );
  }
}

export const mappingCache = new MappingCache();
