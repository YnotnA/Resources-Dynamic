import { z } from "zod";

export const errorMessageSchema = z.object({
  error: z.string(),
  message: z.string(),
});

export type ErrorMessageType = z.infer<typeof errorMessageSchema>;
