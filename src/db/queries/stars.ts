import { eq } from "drizzle-orm";

import { db } from "../connection";
import { type Star, stars } from "../schema";

export const getAllStars = async (): Promise<Star[]> => {
  return await db.select().from(stars);
};

export const getStarsBySystemId = async (systemId: number) => {
  return await db.query.planets.findMany({
    where: eq(stars.systemId, systemId),
    with: {
      moons: true,
    },
  });
};
