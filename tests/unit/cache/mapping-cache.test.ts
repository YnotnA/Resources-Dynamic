import { aCelestialBodyMapping } from "@builder/builders";
import { CelestialBodyMapping } from "@db/schema";
import { mappingCache } from "@websocket/cache/mapping-cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockData: CelestialBodyMapping[] = [];

vi.mock("@db/connection", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => Promise.resolve(mockData)),
    })),
  },
}));

describe("MappingCache", () => {
  beforeEach(() => {
    mockData = []; // Clear between tests
    mappingCache.clear();
  });

  describe("load", () => {
    it("should load mappings from database", async () => {
      mockData = [
        aCelestialBodyMapping().build(),
        aCelestialBodyMapping().build(),
      ];

      await mappingCache.load();

      expect(mappingCache.isReady()).toBe(true);
      const stats = mappingCache.getStats();
      expect(stats.totalEntries).toBe(2);
    });
  });

  describe("getByUuid", () => {
    it("should return mapping for valid UUID", async () => {
      const terra = aCelestialBodyMapping()
        .withType("planet")
        .withName("Terra")
        .build();

      mockData = [terra];
      await mappingCache.load();

      const mapping = mappingCache.getByUuid(terra.uuid);

      expect(mapping).toBeDefined();
      expect(mapping?.name).toBe("Terra");
      expect(mapping?.type).toBe("planet");
      expect(mapping?.id).toBe(terra.id);
    });

    it("should return undefined for invalid UUID", async () => {
      mockData = [aCelestialBodyMapping().build()];
      await mappingCache.load();

      const mapping = mappingCache.getByUuid("invalid-uuid");
      expect(mapping).toBeUndefined();
    });
  });

  describe("getIdByUuid", () => {
    it("should return ID for valid UUID", async () => {
      const body = aCelestialBodyMapping().build();
      mockData = [body];
      await mappingCache.load();

      const id = mappingCache.getIdByUuid(body.uuid);
      expect(id).toBe(body.id);
    });

    it("should return undefined for invalid UUID", async () => {
      mockData = [aCelestialBodyMapping().build()];
      await mappingCache.load();

      const id = mappingCache.getIdByUuid("invalid-uuid");
      expect(id).toBeUndefined();
    });
  });

  describe("getBatchByUuids", () => {
    it("should return multiple mappings", async () => {
      const terra = aCelestialBodyMapping().withName("Terra").build();
      const luna = aCelestialBodyMapping().withName("Luna").build();

      mockData = [terra, luna];
      await mappingCache.load();

      const mappings = mappingCache.getBatchByUuids([terra.uuid, luna.uuid]);

      expect(mappings).toHaveLength(2);
      expect(mappings[0].name).toBe("Terra");
      expect(mappings[1].name).toBe("Luna");
    });

    it("should filter out invalid UUIDs", async () => {
      const terra = aCelestialBodyMapping().withName("Terra").build();
      mockData = [terra];
      await mappingCache.load();

      const mappings = mappingCache.getBatchByUuids([
        terra.uuid,
        "invalid-uuid",
      ]);

      expect(mappings).toHaveLength(1);
    });
  });

  describe("getBySystemId", () => {
    it("should return all bodies in a system", async () => {
      const systemId = 42;

      mockData = [
        aCelestialBodyMapping().withSystemId(systemId).build(),
        aCelestialBodyMapping().withSystemId(systemId).build(),
      ];
      await mappingCache.load();

      const bodies = mappingCache.getBySystemId(systemId);

      expect(bodies).toHaveLength(2);
      expect(bodies.every((b) => b.systemId === systemId)).toBe(true);
    });

    it("should return empty array for non-existent system", async () => {
      mockData = [aCelestialBodyMapping().withSystemId(1).build()];
      await mappingCache.load();

      const bodies = mappingCache.getBySystemId(999);
      expect(bodies).toHaveLength(0);
    });
  });

  describe("getMoonsByPlanetId", () => {
    it("should return all moons of a planet", async () => {
      const planet = aCelestialBodyMapping()
        .withType("planet")
        .withId(1)
        .build();

      const moon = aCelestialBodyMapping()
        .withType("moon")
        .withName("Luna")
        .withParentId(planet.id)
        .build();

      mockData = [planet, moon];
      await mappingCache.load();

      const moons = mappingCache.getMoonsByPlanetId(planet.id);

      expect(moons).toHaveLength(1);
      expect(moons[0].name).toBe("Luna");
      expect(moons[0].type).toBe("moon");
    });

    it("should return empty array when planet has no moons", async () => {
      const planet = aCelestialBodyMapping()
        .withType("planet")
        .withId(5)
        .build();

      mockData = [planet];
      await mappingCache.load();

      const moons = mappingCache.getMoonsByPlanetId(planet.id);
      expect(moons).toHaveLength(0);
    });
  });
});
