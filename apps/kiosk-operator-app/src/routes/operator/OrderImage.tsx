import { useState, type CSSProperties } from "react";
import { TshirtIcon } from "../../components/icons.js";

/**
 * Order mockup/design thumbnail — if the PNG is missing on disk (common after
 * packaging a DB seed without `data/orders/`), fall back to the t-shirt icon
 * instead of the browser's broken-image glyph.
 */
export function OrderImage({
  src,
  alt,
  className,
  style,
  iconClassName,
  iconStyle,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  iconClassName?: string;
  iconStyle?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  if (!showImage) {
    return <TshirtIcon className={iconClassName} style={iconStyle} />;
  }

  return (
    <img
      src={src!}
      alt={alt ?? ""}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
