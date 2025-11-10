import * as dotenv from "dotenv";
import { afterAll, beforeAll, vi } from "vitest";

dotenv.config({ path: ".env.test", override: false });

vi.mock("@lib/logger", () => {
  const createMockLogger = () => ({
    silly: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  });

  return {
    logger: createMockLogger(),
    wsLogger: createMockLogger(),
    duckDbLogger: createMockLogger(),
    duckQueryLogger: createMockLogger(),
    pgDbLogger: createMockLogger(),
    apiLogger: createMockLogger(),
    cacheLogger: createMockLogger(),
    cachePositionLogger: createMockLogger(),
    keplerOrbitServiceLogger: createMockLogger(),
    keplerOrbitLogger: createMockLogger(),
    logError: vi.fn(),
    logPerformance: vi.fn(),
    createTimer: vi.fn(() => ({
      end: vi.fn(() => 100),
    })),
    isDev: true,
    isProd: false,
  };
});

beforeAll(() => {
  console.log("🧪 Setting up tests...");
});

afterAll(() => {
  console.log("✅ Tests completed");
});
