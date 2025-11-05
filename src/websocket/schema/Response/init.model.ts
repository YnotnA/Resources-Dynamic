import { z } from "zod";

import { vector3Schema } from "../vector3.model";

export const initMessageSchema = z.object({
  type: z.literal("init"),
  data: z.array(
    z.object({
      uuid: z.uuidv4(),
      name: z.string(),
      internalName: z.string(),
      position: vector3Schema,
      rotation: vector3Schema,
    }),
  ),
});

export type InitMessageType = z.infer<typeof initMessageSchema>;
