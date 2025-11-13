import { z } from "zod";

import { connectedMessageSchema } from "./connected.model";
import { errorMessageSchema } from "./error.model";
import { responseInitSchema } from "./init.ws.model";
import { responseUpdateObjectSchema } from "./updateObject.ws.model";

export const ResponseWsSchema = z.union([
  responseInitSchema,
  connectedMessageSchema,
  errorMessageSchema,
  responseUpdateObjectSchema,
]);

export type ResponseWsType = z.infer<typeof ResponseWsSchema>;
