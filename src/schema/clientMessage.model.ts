import { z } from "zod";

import { pingSchema } from "./health.model";
import { nextTicksSchema } from "./planetarySystem/requestPlanetarySystem.ws";

export const clientMessageSchema = z.discriminatedUnion("action", [
  nextTicksSchema,
  pingSchema,
]);

export type ClientMessageType = z.infer<typeof clientMessageSchema>;
