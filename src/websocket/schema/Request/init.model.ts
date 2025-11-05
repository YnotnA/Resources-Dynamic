import { z } from "zod";

export const initSchema = z.object({
  action: z.literal("init"),
});
