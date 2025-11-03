import { z } from "zod";
import { nextTicksSchema } from "../features/planet/schema/requestPlanet.model";

export const clientMessageSchema = z.discriminatedUnion("action", [
  nextTicksSchema,
]);

export type ClientMessageType = z.infer<typeof clientMessageSchema>;
