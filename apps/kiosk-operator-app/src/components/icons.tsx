import type { LucideIcon, LucideProps } from "lucide-react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  Bell,
  Bot,
  Calendar,
  Camera,
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
  Paintbrush,
  Palette,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Redo2,
  Ruler,
  Search,
  Settings,
  Shapes,
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

/** Default size for icons inside buttons/rails that scale via `font-size`. */
export const RAIL_ICON_CLASS = "h-[1em] w-[1em]";

export {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  Bell,
  Calendar,
  Camera,
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
  Palette,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Redo2,
  Ruler,
  Settings,
  Shapes,
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
