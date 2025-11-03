import { z } from "zod";

export const pingSchema = z.object({
  action: z.literal("ping"),
});
