/**
 * Premium AI styles (ChatGPT / Gemini) — seed for `ai_styles` with `tier: "premium"`.
 * Inserted when missing (see `styles.ts` `ensurePremiumSeeded`). No `engineKey`
 * — these never fall back to local ONNX; quality is the point of the surcharge.
 */
export interface DefaultPremiumAiStyle {
  key: string;
  label: string;
  description: string;
  promptTemplate: string;
  sortOrder: number;
}

export const DEFAULT_PREMIUM_AI_STYLES: DefaultPremiumAiStyle[] = [
  {
    key: "premium_gta_vice_city",
    label: "GTA VICE CITY",
    description: "Неоновый Майами 80-х, постер GTA",
    promptTemplate:
      "Restyle this photo as Grand Theft Auto: Vice City cover art: neon pink and teal 1980s Miami night, bold comic-book outlines, retro sunset palms, dramatic cinematic lighting, painterly video-game poster illustration. Keep the person's face, pose and framing recognizable.",
    sortOrder: 0,
  },
  {
    key: "premium_anime",
    label: "АНИМЕ",
    description: "Яркая японская анимация",
    promptTemplate:
      "Restyle this photo as a high-quality Japanese anime character illustration: clean line art, expressive eyes, soft cel-shading, vivid colors, detailed hair. Keep the person's face, pose and framing recognizable.",
    sortOrder: 1,
  },
  {
    key: "premium_ghibli",
    label: "СТУДИЯ ГИБЛИ",
    description: "Мягкий свет, живописный фон",
    promptTemplate:
      "Restyle this photo as a Studio Ghibli anime still: soft warm lighting, painterly watercolor backgrounds, gentle cel-shading, whimsical atmosphere, Hayao Miyazaki style. Keep the person's face, pose and framing recognizable.",
    sortOrder: 2,
  },
  {
    key: "premium_cyberpunk",
    label: "КИБЕРПАНК",
    description: "Неон, дождь, футуризм",
    promptTemplate:
      "Restyle this photo as a cyberpunk portrait: neon magenta and cyan city lights, rainy reflective streets, futuristic tech wear, high contrast cinematic lighting, blade-runner atmosphere. Keep the person's face, pose and framing recognizable.",
    sortOrder: 3,
  },
  {
    key: "premium_disney",
    label: "ДИСНЕЙ",
    description: "Классическая диснеевская анимация",
    promptTemplate:
      "Restyle this photo as a classic Disney animated character portrait: soft rounded features, big expressive eyes, smooth cel shading, warm magical lighting, fairy-tale illustration style. Keep the person's face, pose and framing recognizable.",
    sortOrder: 4,
  },
  {
    key: "premium_pixel_art",
    label: "ПИКСЕЛЬ-АРТ",
    description: "Ретро 16-bit пиксели",
    promptTemplate:
      "Restyle this photo as detailed 16-bit pixel art: crisp pixel grid, limited retro game palette, sprite-like portrait suitable for a classic RPG character, readable facial features. Keep the person's face, pose and framing recognizable.",
    sortOrder: 5,
  },
  {
    key: "premium_simpsons",
    label: "СИМПСОНЫ",
    description: "Жёлтый мультстиль The Simpsons",
    promptTemplate:
      "Restyle this photo as a The Simpsons cartoon character: yellow skin, overbitten smile style, thick black outlines, flat cel colors, Matt Groening illustration look. Keep the person's face, pose and framing recognizable.",
    sortOrder: 6,
  },
  {
    key: "premium_renaissance",
    label: "РЕНЕССАНС",
    description: "Масляная живопись эпохи Возрождения",
    promptTemplate:
      "Restyle this photo as a Renaissance oil painting portrait in the style of Rembrandt and Leonardo da Vinci: dramatic chiaroscuro lighting, rich earthy colors, fine brushwork, classical canvas texture. Keep the person's face, pose and framing recognizable.",
    sortOrder: 7,
  },
];
