/**
 * ИИ-раздел (Этап 9) — default seed for the `ai_styles` table (see
 * `db/schema.ts`), matching the labels/descriptions on the "Выберите стиль"
 * reference screen. `promptTemplate` is sent to Pollinations as-is (see
 * `pollinations.ts`) — kept simple/English since image models tend to
 * follow English prompts more reliably.
 */
export interface DefaultAiStyle {
  key: string;
  label: string;
  description: string;
  promptTemplate: string;
  sortOrder: number;
}

export const DEFAULT_AI_STYLES: DefaultAiStyle[] = [
  {
    key: "gta",
    label: "ГТА",
    description: "Уличный комикс, яркие цвета",
    promptTemplate:
      "Restyle this photo as GTA video game cover art: bold comic-book outlines, vibrant saturated colors, dramatic urban night background, painterly poster illustration. Keep the person's face, pose and framing recognizable.",
    sortOrder: 0,
  },
  {
    key: "anime",
    label: "АНИМЕ",
    description: "Японская анимация, чистые линии",
    promptTemplate:
      "Restyle this photo as Japanese anime illustration: clean line art, cel-shading, soft anime lighting, detailed anime-style eyes. Keep the person's face, pose and framing recognizable.",
    sortOrder: 1,
  },
  {
    key: "noir",
    label: "НУАР",
    description: "Чёрно-белый детектив, кинематограф",
    promptTemplate:
      "Restyle this photo as a black and white film noir detective illustration: high contrast monochrome, dramatic shadows, cinematic lighting, 1940s detective movie poster style. Keep the person's face, pose and framing recognizable.",
    sortOrder: 2,
  },
];
