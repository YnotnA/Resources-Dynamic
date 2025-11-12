import { z } from "zod";

import { requestInitSchema } from "./init.model";
import { nextTicksSchema } from "./nextTicks.model";

export const requestWsSchema = z.discriminatedUnion("event_type", [
  requestInitSchema,
  nextTicksSchema,
]);

export type RequestWsType = z.infer<typeof requestWsSchema>;
