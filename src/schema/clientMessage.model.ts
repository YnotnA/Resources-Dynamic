import { z } from "zod";

import { nextTicksSchema } from "../features/planet/schema/requestPlanet.model";
import { pingSchema } from "./health.model";

export const clientMessageSchema = z.discriminatedUnion("action", [
  nextTicksSchema,
  pingSchema,
]);

export type ClientMessageType = z.infer<typeof clientMessageSchema>;
