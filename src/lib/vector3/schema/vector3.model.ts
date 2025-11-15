import { z } from "zod";

export const vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export type Vector3Type = z.infer<typeof vector3Schema>;

export const quaternionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
});

export type QuaternionType = z.infer<typeof quaternionSchema>;
