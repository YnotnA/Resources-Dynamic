import { z } from "zod";

import { connectedMessageSchema } from "./connected.model";
import { errorMessageSchema } from "./error.model";
import { nextTicksMessageSchema } from "./nextTick.model";
import { pongMessageSchema } from "./pong.model";

export const ResponseWsSchema = z.union([
  connectedMessageSchema,
  pongMessageSchema,
  errorMessageSchema,
  nextTicksMessageSchema,
]);

export type ResponseWsType = z.infer<typeof ResponseWsSchema>;
