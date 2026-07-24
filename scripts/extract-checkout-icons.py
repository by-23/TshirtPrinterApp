"""Split the verified icons-row into four bundled step assets + cash art."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

MOCKUP = Path("docs/ui-mockups/checkout.png")
OUT = Path("apps/kiosk-operator-app/src/assets/checkout")
PREV = Path(
    r"C:\Users\By23\.cursor\projects\c-Users-By23-Documents-TshirtPrinterApp\assets\checkout-crops"
)


def knockout(im: Image.Image, threshold: int = 55) -> Image.Image:
    out = im.convert("RGBA")
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if r + g + b < threshold:
                px[x, y] = (0, 0, 0, 0)
    return out


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    px = im.load()
    w, h = im.size
    min_x, min_y, max_x, max_y = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < 0:
        return im
    return im.crop(
        (
            max(0, min_x - pad),
            max(0, min_y - pad),
            min(w, max_x + 1 + pad),
            min(h, max_y + 1 + pad),
        )
    )


def upscale(im: Image.Image, size: int = 128) -> Image.Image:
    # Fit into square canvas preserving aspect.
    im = trim(im)
    scale = min(size / max(1, im.width), size / max(1, im.height))
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2), resized)
    return canvas


def save(name: str, im: Image.Image) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREV.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f"{name}.png")
    im.save(PREV / f"{name}.png")
    print(name, im.size)


def main() -> None:
    im = Image.open(MOCKUP).convert("RGBA")

    # Icon glyphs only — below title, above captions (validated via strip previews).
    row = knockout(im.crop((30, 468, 310, 492)))
    PREV.mkdir(parents=True, exist_ok=True)
    row.resize((row.width * 6, row.height * 6), Image.Resampling.NEAREST).save(PREV / "icons-row-final.png")

    names = [
        "checkout-step-openApp",
        "checkout-step-scanQr",
        "checkout-step-confirmPayment",
        "checkout-step-orderToPrint",
    ]
    slot_w = row.width // 4
    for i, name in enumerate(names):
        slot = row.crop((i * slot_w, 0, (i + 1) * slot_w, row.height))
        save(name, upscale(slot, 128))

    cash = knockout(im.crop((218, 360, 302, 398)), threshold=40)
    # Keep pink customer — don't knockout pink.
    cash = trim(cash)
    cash = cash.resize((cash.width * 6, cash.height * 6), Image.Resampling.NEAREST)
    save("checkout-cash-illustration", cash)


if __name__ == "__main__":
    main()
