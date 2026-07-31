import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  Bell,
  Bot,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clapperboard,
  Clock,
  Crown,
  Crop,
  Diamond,
  Droplet,
  Flame,
  Gamepad2,
  Gift,
  GripVertical,
  HardDrive,
  Headset,
  Heart,
  History,
  Image,
  LayoutGrid,
  Layers,
  ListOrdered,
  Loader2,
  Lock,
  LockOpen,
  Monitor,
  Paintbrush,
  Palette,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Redo2,
  RotateCw,
  Ruler,
  Search,
  Settings,
  Share2,
  Shirt,
  ShoppingCart,
  SlidersHorizontal,
  SlidersVertical,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Tag,
  Target,
  Trash2,
  Type,
  Undo2,
  Upload,
  Users,
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
export const StarOutlineIcon = createIcon(Star);
export const FlameIcon = createFilledIcon(Flame);
export const BoltIcon = createFilledIcon(Zap);
export const CrownIcon = createFilledIcon(Crown);
export const SmileyIcon = createIcon(Smile, { strokeWidth: 1.6 });
export const SearchIcon = createIcon(Search, { strokeWidth: 2 });
export const SpinnerIcon = createIcon(Loader2, { strokeWidth: 2 });

/**
 * Four-pointed neon sparkle (✦) for banners — solid fill, not Lucide's
 * multi-glyph Sparkles. Matches the home "Популярные принты" mock.
 */
export function SparkleStar({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
      {...props}
    >
      {/* Curved 4-point sparkle: thick center, sharp tips, concave sides */}
      <path d="M12 0C12.85 6.5 17.5 11.15 24 12C17.5 12.85 12.85 17.5 12 24C11.15 17.5 6.5 12.85 0 12C6.5 11.15 11.15 6.5 12 0Z" />
    </svg>
  );
}

/** Default size for icons inside buttons/rails that scale via `font-size`. */
export const RAIL_ICON_CLASS = "h-[1em] w-[1em]";

export {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  Bell,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Crop,
  Diamond,
  Droplet,
  Gift,
  GripVertical,
  HardDrive,
  Headset,
  Heart,
  History,
  Image,
  LayoutGrid,
  Layers,
  ListOrdered,
  Lock,
  LockOpen,
  Monitor,
  Palette,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Redo2,
  RotateCw,
  Ruler,
  Settings,
  Share2,
  SlidersHorizontal,
  SlidersVertical,
  Smartphone,
  Smile,
  Sparkles,
  Tag,
  Target,
  Trash2,
  Type,
  Undo2,
  Upload,
  Users,
};
