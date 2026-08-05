import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { designCategorySchema, type DesignCategory } from "@tshirt/shared-types";
import { getCategoryRoute } from "../lib/categoryLabels.js";
import { getCategoryHomeLabel } from "../lib/homeLabels.js";
import { categoryImageKey, useKioskImage } from "../lib/kioskImages.js";
import { BrushIcon, FilmIcon, GamepadIcon, PhotoIcon, RobotIcon, UploadIcon } from "./icons.js";
import { homeThemeSection } from "../routes/kiosk/themeSectionsHome.js";

interface CategoryImageVars {
  scale: string;
  offsetX: string;
  offsetY: string;
}

const CATEGORY_IMAGE_VAR: Record<DesignCategory, CategoryImageVars> = {
  memes: {
    scale: "--cat-memes-image-scale",
    offsetX: "--cat-memes-image-offset-x",
    offsetY: "--cat-memes-image-offset-y",
  },
  anime_movies: {
    scale: "--cat-anime-image-scale",
    offsetX: "--cat-anime-image-offset-x",
    offsetY: "--cat-anime-image-offset-y",
  },
  games: {
    scale: "--cat-games-image-scale",
    offsetX: "--cat-games-image-offset-x",
    offsetY: "--cat-games-image-offset-y",
  },
  text: {
    scale: "--cat-text-image-scale",
    offsetX: "--cat-text-image-offset-x",
    offsetY: "--cat-text-image-offset-y",
  },
  custom: {
    scale: "--cat-custom-image-scale",
    offsetX: "--cat-custom-image-offset-x",
    offsetY: "--cat-custom-image-offset-y",
  },
  ai_style: {
    scale: "--cat-ai-image-scale",
    offsetX: "--cat-ai-image-offset-x",
    offsetY: "--cat-ai-image-offset-y",
  },
};

interface CategoryGradientVars {
  start: string;
  middle: string;
  end: string;
  border: string;
}

const CATEGORY_GRADIENT_VAR: Record<DesignCategory, CategoryGradientVars> = {
  memes: {
    start: "--cat-memes-start",
    middle: "--cat-memes-middle",
    end: "--cat-memes-end",
    border: "--cat-memes-border",
  },
  anime_movies: {
    start: "--cat-anime-start",
    middle: "--cat-anime-middle",
    end: "--cat-anime-end",
    border: "--cat-anime-border",
  },
  games: {
    start: "--cat-games-start",
    middle: "--cat-games-middle",
    end: "--cat-games-end",
    border: "--cat-games-border",
  },
  text: {
    start: "--cat-text-start",
    middle: "--cat-text-middle",
    end: "--cat-text-end",
    border: "--cat-text-border",
  },
  custom: {
    start: "--cat-custom-start",
    middle: "--cat-custom-middle",
    end: "--cat-custom-end",
    border: "--cat-custom-border",
  },
  ai_style: {
    start: "--cat-ai-start",
    middle: "--cat-ai-middle",
    end: "--cat-ai-end",
    border: "--cat-ai-border",
  },
};

// Light text tint per card so headings/icons stay readable against every accent hue.
const CATEGORY_ACCENT_TEXT: Record<DesignCategory, string> = {
  memes: "text-violet-100",
  anime_movies: "text-fuchsia-100",
  games: "text-blue-100",
  text: "text-teal-100",
  custom: "text-amber-100",
  ai_style: "text-purple-100",
};

function CategoryArt({ category, accent }: { category: DesignCategory; accent: string }) {
  const imageUrl = useKioskImage(categoryImageKey(category));

  let content: ReactNode;

  if (imageUrl) {
    content = (
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        className="h-[128px] w-[128px] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.35)]"
      />
    );
  } else {
    switch (category) {
      case "memes":
        content = <PhotoIcon aria-hidden className={`h-[104px] w-[104px] ${accent}`} />;
        break;
      case "anime_movies":
        content = <FilmIcon aria-hidden className={`h-[104px] w-[104px] ${accent}`} />;
        break;
      case "games":
        content = <GamepadIcon aria-hidden className={`h-[104px] w-[104px] ${accent}`} />;
        break;
      case "text":
        content = (
          <div
            className={`flex h-[128px] w-[128px] items-center justify-center rounded-[var(--radius-card-sm)] border-[3px] border-dashed border-current text-[60px] font-black ${accent}`}
          >
            T
          </div>
        );
        break;
      case "custom":
        content = (
          <div
            className={`relative flex h-[128px] w-[128px] items-center justify-center rounded-[var(--radius-card-sm)] border-[3px] border-dashed border-current ${accent}`}
          >
            <BrushIcon aria-hidden className="h-14 w-14" />
            <span
              aria-hidden
              style={{ backgroundColor: "var(--brand-secondary)" }}
              className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-pill text-white"
            >
              <UploadIcon className="h-6 w-6" />
            </span>
          </div>
        );
        break;
      case "ai_style":
        content = (
          <div className="relative flex h-[128px] w-[128px] items-center justify-center rounded-pill bg-gradient-to-br from-slate-300 via-slate-500 to-ink-900">
            <RobotIcon aria-hidden className="h-[58px] w-[58px] text-ink-900" />
            <span
              aria-hidden
              style={{ backgroundColor: "var(--brand-primary)", boxShadow: "var(--brand-pill-glow)" }}
              className="absolute -right-1 -top-1 flex h-10 w-10 items-center justify-center rounded-pill text-sm font-black text-white"
            >
              AI
            </span>
          </div>
        );
        break;
    }
  }

  return (
    <div className="category-art-wrap">
      <div className="category-art-scale">{content}</div>
    </div>
  );
}

export function CategoryGrid() {
  const { i18n } = useTranslation();
  const categories = designCategorySchema.options;

  return (
    <div className="grid grid-cols-3 gap-6" {...homeThemeSection("categories")}>
      {categories.map((category) => {
        const label = getCategoryHomeLabel(category, i18n.language);
        const accent = CATEGORY_ACCENT_TEXT[category];
        const gradient = CATEGORY_GRADIENT_VAR[category];
        const imageLayout = CATEGORY_IMAGE_VAR[category];
        const cardStyle = {
          "--cat-gradient-start": `var(${gradient.start})`,
          "--cat-gradient-middle": `var(${gradient.middle})`,
          "--cat-gradient-end": `var(${gradient.end})`,
          "--cat-border-color": `var(${gradient.border})`,
          "--cat-image-scale": `var(${imageLayout.scale})`,
          "--cat-image-offset-x": `var(${imageLayout.offsetX})`,
          "--cat-image-offset-y": `var(${imageLayout.offsetY})`,
        } as CSSProperties;

        return (
          <Link
            key={category}
            to={getCategoryRoute(category)}
            style={cardStyle}
            className="category-card flex h-[460px] flex-col items-center gap-4 overflow-hidden rounded-[var(--radius-card)] border-2 px-4 py-7 transition-transform active:scale-[0.98]"
          >
            <div className="category-card-labels">
              <span className="category-card-title">{label.main}</span>
              <span className="category-card-subtitle">{label.sub}</span>
            </div>
            <div className="flex w-full flex-1 items-end justify-center">
              <CategoryArt category={category} accent={accent} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
