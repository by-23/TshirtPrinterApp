/**
 * ИИ-раздел (Этап 9) — default seed for the `ai_styles` table (see
 * `db/schema.ts`), inserted only once when the table is first empty. From
 * then on the "ИИ-стили" operator panel (see `routes.ts` admin routes) is
 * the source of truth — editing this file has no effect on an already
 * running point.
 *
 * `promptTemplate` is sent to Pollinations as-is (see `pollinations.ts`) —
 * kept simple/English since image models tend to follow English prompts
 * more reliably. `engineKey` picks the offline fallback engine used when
 * Pollinations is unavailable (no internet, rate-limited, etc.) — see
 * `modules/ai/local/index.ts` for the `{kind}:{variant}` format.
 *
 * AnimeGANv2 weights (`animegan:*`) are distributed under a non-commercial
 * license (see `modules/ai/local/engines/animegan.ts`) — included here on
 * explicit request, but worth reviewing before relying on them for a
 * for-profit kiosk.
 */
export interface DefaultAiStyle {
  key: string;
  label: string;
  description: string;
  promptTemplate: string;
  engineKey: string;
  sortOrder: number;
}

export const DEFAULT_AI_STYLES: DefaultAiStyle[] = [
  {
    key: "anime_hayao",
    label: "АНИМЕ (ГИБЛИ)",
    description: "Японская анимация, мягкий свет",
    promptTemplate:
      "Restyle this photo as Japanese anime illustration in the style of Studio Ghibli: clean line art, cel-shading, soft warm lighting, painterly backgrounds. Keep the person's face, pose and framing recognizable.",
    engineKey: "animegan:hayao",
    sortOrder: 0,
  },
  {
    key: "anime_shinkai",
    label: "АНИМЕ (СИНКАЙ)",
    description: "Кинематографичное аниме, яркое небо",
    promptTemplate:
      "Restyle this photo as Japanese anime illustration in the style of Makoto Shinkai: vivid saturated skies, dramatic cinematic lighting, detailed backgrounds, clean line art. Keep the person's face, pose and framing recognizable.",
    engineKey: "animegan:shinkai",
    sortOrder: 1,
  },
  {
    key: "anime_paprika",
    label: "АНИМЕ (ЯРКОЕ)",
    description: "Насыщенные цвета, комикс-вайб",
    promptTemplate:
      "Restyle this photo as vibrant Japanese anime illustration: bold saturated colors, energetic comic-style shading, dynamic lighting. Keep the person's face, pose and framing recognizable.",
    engineKey: "animegan:paprika",
    sortOrder: 2,
  },
  {
    key: "manga_portrait",
    label: "МАНГА-ПОРТРЕТ",
    description: "Чистые линии, портретный фокус",
    promptTemplate:
      "Restyle this photo as a clean anime portrait illustration: detailed anime-style eyes, soft cel-shading, simple background, portrait-focused framing. Keep the person's face, pose and framing recognizable.",
    engineKey: "animegan:facepaint",
    sortOrder: 3,
  },
  {
    key: "mosaic",
    label: "МОЗАИКА",
    description: "Дробная мозаичная текстура",
    promptTemplate:
      "Restyle this photo as a mosaic-tile artwork: fragmented geometric color patches, stained-glass-like texture, bold outlines. Keep the person's face, pose and framing recognizable.",
    engineKey: "fast-neural-style:mosaic",
    sortOrder: 4,
  },
  {
    key: "candy",
    label: "КОНФЕТТИ",
    description: "Яркая палитра, декоративный узор",
    promptTemplate:
      "Restyle this photo as a bright decorative painting with candy-like saturated colors and playful patterned texture. Keep the person's face, pose and framing recognizable.",
    engineKey: "fast-neural-style:candy",
    sortOrder: 5,
  },
  {
    key: "rain_princess",
    label: "ДОЖДЛИВАЯ ПРИНЦЕССА",
    description: "Живописный, приглушённые тона",
    promptTemplate:
      "Restyle this photo as an impressionist oil painting with muted romantic tones and visible brushstroke texture. Keep the person's face, pose and framing recognizable.",
    engineKey: "fast-neural-style:rain-princess",
    sortOrder: 6,
  },
  {
    key: "udnie",
    label: "УДНИ",
    description: "Абстрактный, кубистичный",
    promptTemplate:
      "Restyle this photo as an abstract cubist-inspired painting with fragmented shapes and bold color blocks. Keep the person's face, pose and framing recognizable.",
    engineKey: "fast-neural-style:udnie",
    sortOrder: 7,
  },
  {
    key: "pointilism",
    label: "ПУАНТИЛИЗМ",
    description: "Точечная техника, живопись",
    promptTemplate:
      "Restyle this photo as a pointillist painting made of small distinct dots of color, in the style of Georges Seurat. Keep the person's face, pose and framing recognizable.",
    engineKey: "fast-neural-style:pointilism",
    sortOrder: 8,
  },
  {
    key: "noir",
    label: "НУАР",
    description: "Чёрно-белый детектив, кинематограф",
    promptTemplate:
      "Restyle this photo as a black and white film noir detective illustration: high contrast monochrome, dramatic shadows, cinematic lighting, 1940s detective movie poster style. Keep the person's face, pose and framing recognizable.",
    engineKey: "filter:noir",
    sortOrder: 9,
  },
  {
    key: "sepia",
    label: "ВИНТАЖ",
    description: "Тёплая сепия, старое фото",
    promptTemplate:
      "Restyle this photo as a vintage sepia-toned photograph from the early 20th century, with warm brown tones and soft aged texture. Keep the person's face, pose and framing recognizable.",
    engineKey: "filter:sepia",
    sortOrder: 10,
  },
  {
    key: "comic",
    label: "КОМИКС",
    description: "Уличный комикс, яркие цвета",
    promptTemplate:
      "Restyle this photo as GTA video game cover art: bold comic-book outlines, vibrant saturated colors, dramatic urban night background, painterly poster illustration. Keep the person's face, pose and framing recognizable.",
    engineKey: "filter:popArt",
    sortOrder: 11,
  },
  {
    key: "sketch",
    label: "СКЕТЧ",
    description: "Карандашный набросок",
    promptTemplate:
      "Restyle this photo as a detailed pencil sketch drawing: crosshatched shading, graphite texture, monochrome line art on paper. Keep the person's face, pose and framing recognizable.",
    engineKey: "filter:pencilSketch",
    sortOrder: 12,
  },
];
