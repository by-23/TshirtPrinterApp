import { z } from "zod";

export const uploadModeSchema = z.enum(["relay", "wifi"]);
export type UploadMode = z.infer<typeof uploadModeSchema>;

export const pointStatusSchema = z.enum(["open", "closed"]);
export type PointStatus = z.infer<typeof pointStatusSchema>;

export const pointSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: pointStatusSchema,
  uploadMode: uploadModeSchema,
});
export type Point = z.infer<typeof pointSchema>;
