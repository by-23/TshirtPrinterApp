import { z } from "zod";

export const designCategorySchema = z.enum([
  "memes",
  "anime_movies",
  "games",
  "text",
  "custom",
  "ai_style",
]);
export type DesignCategory = z.infer<typeof designCategorySchema>;

export const designSchema = z.object({
  id: z.string(),
  category: designCategorySchema,
  title: z.string(),
  imageUrl: z.string(),
  isFeatured: z.boolean().default(false),
});
export type Design = z.infer<typeof designSchema>;
