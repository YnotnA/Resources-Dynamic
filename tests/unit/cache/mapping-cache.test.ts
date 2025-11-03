import { mappingCache } from "@websocket/cache/mapping-cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@db/connection", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() =>
        Promise.resolve([
          {
            uuid: "550e8400-e29b-41d4-a716-446655440000",
            id: 1,
            type: "planet",
            name: "Terra",
            systemId: 1,
            parentId: null,
          },
          {
            uuid: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            id: 2,
            type: "moon",
            name: "Luna",
            systemId: 1,
            parentId: 1,
          },
        ]),
      ),
    })),
  },
}));

describe("MappingCache", () => {
  beforeEach(async () => {
    mappingCache.clear();
    await mappingCache.load();
  });

  describe("load", () => {
    it("should load mappings from database", async () => {
      expect(mappingCache.isReady()).toBe(true);

      const stats = mappingCache.getStats();
      expect(stats.totalEntries).toBe(2);
    });
  });

  describe("getByUuid", () => {
    it("should return mapping for valid UUID", () => {
      const mapping = mappingCache.getByUuid(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(mapping).toBeDefined();
      expect(mapping?.name).toBe("Terra");
      expect(mapping?.type).toBe("planet");
      expect(mapping?.id).toBe(1);
    });

    it("should return undefined for invalid UUID", () => {
      const mapping = mappingCache.getByUuid("invalid-uuid");
      expect(mapping).toBeUndefined();
    });
  });

  describe("getIdByUuid", () => {
    it("should return ID for valid UUID", () => {
      const id = mappingCache.getIdByUuid(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(id).toBe(1);
    });

    it("should return undefined for invalid UUID", () => {
      const id = mappingCache.getIdByUuid("invalid-uuid");
      expect(id).toBeUndefined();
    });
  });

  describe("getBatchByUuids", () => {
    it("should return multiple mappings", () => {
      const mappings = mappingCache.getBatchByUuids([
        "550e8400-e29b-41d4-a716-446655440000",
        "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      ]);

      expect(mappings).toHaveLength(2);
      expect(mappings[0].name).toBe("Terra");
      expect(mappings[1].name).toBe("Luna");
    });

    it("should filter out invalid UUIDs", () => {
      const mappings = mappingCache.getBatchByUuids([
        "550e8400-e29b-41d4-a716-446655440000",
        "invalid-uuid",
      ]);

      expect(mappings).toHaveLength(1);
    });
  });

  describe("getBySystemId", () => {
    it("should return all bodies in a system", () => {
      const bodies = mappingCache.getBySystemId(1);

      expect(bodies).toHaveLength(2);
      expect(bodies.every((b) => b.systemId === 1)).toBe(true);
    });

    it("should return empty array for non-existent system", () => {
      const bodies = mappingCache.getBySystemId(999);
      expect(bodies).toHaveLength(0);
    });
  });

  describe("getMoonsByPlanetId", () => {
    it("should return all moons of a planet", () => {
      const moons = mappingCache.getMoonsByPlanetId(1);

      expect(moons).toHaveLength(1);
      expect(moons[0].name).toBe("Luna");
      expect(moons[0].type).toBe("moon");
    });
  });
});
