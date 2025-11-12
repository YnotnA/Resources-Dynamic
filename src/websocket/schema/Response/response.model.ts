import { z } from "zod";

import { connectedMessageSchema } from "./connected.model";
import { errorMessageSchema } from "./error.model";
import { initMessageSchema } from "./init.model";
import { nextTicksMessageSchema } from "./nextTick.model";

export const ResponseWsSchema = z.union([
  initMessageSchema,
  connectedMessageSchema,
  errorMessageSchema,
  nextTicksMessageSchema,
]);

export type ResponseWsType = z.infer<typeof ResponseWsSchema>;
