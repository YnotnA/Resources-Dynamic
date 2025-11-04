import { z } from "zod";

import { pingSchema } from "./health.model";
import { nextTicksSchema } from "./nextTicks.model";

export const RequestWsSchema = z.discriminatedUnion("action", [
  nextTicksSchema,
  pingSchema,
]);

export type RequestWsType = z.infer<typeof RequestWsSchema>;
