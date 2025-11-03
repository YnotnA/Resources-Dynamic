import { db } from "@db/connection";
import { type CelestialBodyMapping, celestialBodiesMapping } from "@db/schema";
import { cacheLogger, createTimer, logPerformance } from "@lib/logger";

export type CelestialBodyType = "star" | "planet" | "moon";

/**
 * Interface pour le cache (simplifié)
 */
export interface CachedMapping {
  uuid: string;
  id: number;
  type: CelestialBodyType;
  name: string;
  systemId: number;
  parentId?: number;
}

/**
 * Cache en mémoire pour le mapping UUID → ID
 * Chargé une seule fois au démarrage du WebSocket
 */
class MappingCache {
  private uuidToMappingMap: Map<string, CachedMapping> = new Map();
  private idToUuidMap: Map<string, string> = new Map(); // key: "type:id"
  private isLoaded: boolean = false;
  private lastSync: Date | null = null;

  /**
   * Charge tous les mappings en mémoire depuis la table via Drizzle
   */
  async load(): Promise<void> {
    try {
      const timer = createTimer();
      cacheLogger.info({ msg: "📥 Loading celestial bodies mapping cache..." });

      // ✅ Utilisation du schéma Drizzle
      const mappings: CelestialBodyMapping[] = await db
        .select()
        .from(celestialBodiesMapping);

      this.uuidToMappingMap.clear();
      this.idToUuidMap.clear();

      for (const mapping of mappings) {
        const cached: CachedMapping = {
          uuid: mapping.uuid,
          id: mapping.id,
          type: mapping.type as CelestialBodyType,
          name: mapping.name,
          systemId: mapping.systemId,
          parentId: mapping.parentId ?? undefined,
        };

        // UUID → Mapping complet
        this.uuidToMappingMap.set(mapping.uuid, cached);

        // ID → UUID (pour recherche inverse)
        const key = `${mapping.type}:${mapping.id}`;
        this.idToUuidMap.set(key, mapping.uuid);
      }

      this.isLoaded = true;
      this.lastSync = new Date();

      const duration = timer.end();
      const stats = this.getStats();

      cacheLogger.debug({
        msg: "✅ Cache loaded successfully",
        duration,
        totalEntries: stats.totalEntries,
        byType: stats.byType,
        memoryKB: stats.memoryUsageKB,
      });

      logPerformance(cacheLogger, "Load cache", duration);
    } catch (error) {
      cacheLogger.error("❌ Failed to load mapping cache:", error);
      throw error;
    }
  }

  /**
   * Recharge le cache (à appeler périodiquement ou sur événement)
   */
  async reload(): Promise<void> {
    cacheLogger.info("🔄 Reloading mapping cache...");
    await this.load();
  }

  /**
   * Récupère le mapping complet par UUID (< 1µs)
   */
  getByUuid(uuid: string): CachedMapping | undefined {
    if (!this.isLoaded) {
      cacheLogger.warn("⚠️ Cache not loaded, call load() first");
      return undefined;
    }
    return this.uuidToMappingMap.get(uuid);
  }

  /**
   * Récupère uniquement l'ID par UUID (< 1µs)
   */
  getIdByUuid(uuid: string): number | undefined {
    return this.getByUuid(uuid)?.id;
  }

  /**
   * Récupère l'UUID par ID et type
   */
  getUuidById(type: CelestialBodyType, id: number): string | undefined {
    if (!this.isLoaded) {
      cacheLogger.warn("⚠️ Cache not loaded, call load() first");
      return undefined;
    }
    return this.idToUuidMap.get(`${type}:${id}`);
  }

  /**
   * Batch: Récupère plusieurs mappings par UUIDs
   */
  getBatchByUuids(uuids: string[]): CachedMapping[] {
    return uuids
      .map((uuid) => this.getByUuid(uuid))
      .filter((m): m is CachedMapping => m !== undefined);
  }

  /**
   * Récupère tous les objets d'un système
   */
  getBySystemId(systemId: number): CachedMapping[] {
    return Array.from(this.uuidToMappingMap.values()).filter(
      (m) => m.systemId === systemId,
    );
  }

  /**
   * Filtre par type
   */
  getByType(type: CelestialBodyType): CachedMapping[] {
    return Array.from(this.uuidToMappingMap.values()).filter(
      (m) => m.type === type,
    );
  }

  /**
   * Récupère toutes les lunes d'une planète
   */
  getMoonsByPlanetId(planetId: number): CachedMapping[] {
    return Array.from(this.uuidToMappingMap.values()).filter(
      (m) => m.type === "moon" && m.parentId === planetId,
    );
  }

  /**
   * Vérifie si le cache est chargé
   */
  isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Statistiques du cache
   */
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
      memoryUsageKB: Math.round(
        JSON.stringify(Array.from(this.uuidToMappingMap.values())).length /
          1024,
      ),
    };
  }

  /**
   * Vide le cache
   */
  clear(): void {
    this.uuidToMappingMap.clear();
    this.idToUuidMap.clear();
    this.isLoaded = false;
    this.lastSync = null;
    cacheLogger.info("🗑️ Cache cleared");
  }

  /**
   * Recherche par nom (fuzzy search)
   */
  searchByName(query: string): CachedMapping[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.uuidToMappingMap.values()).filter((m) =>
      m.name.toLowerCase().includes(lowerQuery),
    );
  }
}

// Export une instance singleton
export const mappingCache = new MappingCache();
