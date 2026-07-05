import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Bot,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Crown,
  Crop,
  Diamond,
  Flame,
  Gamepad2,
  Heart,
  Image,
  Paintbrush,
  Plus,
  Redo2,
  Settings,
  Shapes,
  Shirt,
  ShoppingCart,
  SlidersHorizontal,
  SlidersVertical,
  Smile,
  Sparkles,
  Star,
  Target,
  Type,
  Undo2,
  Upload,
  Zap,
} from "lucide-react";

/**
 * Lucide icons (https://lucide.dev) — consistent SVG glyphs that render
 * identically on every OS, unlike color emoji or hand-drawn placeholders.
 */
export type IconProps = LucideProps;

function createIcon(Icon: LucideIcon, defaults: LucideProps = {}) {
  function Wrapped(props: IconProps) {
    return <Icon aria-hidden strokeWidth={1.5} {...defaults} {...props} />;
  }
  Wrapped.displayName = Icon.displayName ?? Icon.name;
  return Wrapped;
}

function createFilledIcon(Icon: LucideIcon) {
  return createIcon(Icon, { fill: "currentColor", strokeWidth: 0 });
}

export const TshirtIcon = createIcon(Shirt);
export const PhotoIcon = createIcon(Image);
export const FilmIcon = createIcon(Clapperboard);
export const GamepadIcon = createIcon(Gamepad2);
export const BrushIcon = createIcon(Paintbrush);
export const UploadIcon = createIcon(Upload, { strokeWidth: 2 });
export const RobotIcon = createIcon(Bot);
export const CartIcon = createIcon(ShoppingCart, { strokeWidth: 1.8 });
export const StarIcon = createFilledIcon(Star);
export const FlameIcon = createFilledIcon(Flame);
export const BoltIcon = createFilledIcon(Zap);
export const CrownIcon = createFilledIcon(Crown);
export const SmileyIcon = createIcon(Smile, { strokeWidth: 1.6 });

/** Default size for icons inside buttons/rails that scale via `font-size`. */
export const RAIL_ICON_CLASS = "h-[1em] w-[1em]";

export {
  ArrowLeft,
  ArrowUpLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  Crop,
  Diamond,
  Heart,
  Image,
  Plus,
  Redo2,
  Settings,
  Shapes,
  SlidersHorizontal,
  SlidersVertical,
  Smile,
  Sparkles,
  Target,
  Type,
  Undo2,
  Upload,
};
