import { z } from "zod";

import { pingSchema } from "./health.model";
import { nextTicksSchema } from "./requestPlanetarySystem.model";

export const clientMessageSchema = z.discriminatedUnion("action", [
  nextTicksSchema,
  pingSchema,
]);

export type ClientMessageType = z.infer<typeof clientMessageSchema>;
