#!/usr/bin/env python3
"""
Split artifacts-source.png into individual class and artifact icons.

Expected layout (3 rows x 6 columns):
  Row 0 – class icons:    combattente, assassino, mago, carro_armato, ranger, guaritore
  Row 1 – class artifacts: gauntlets_warrior, shadow_cloak, ancient_tome,
                            iron_shield, dual_scope, elixir_flask
  Row 2 – universal:      exp_crystal, endurance_ring, focus_stone, (empty x3)

Output dirs:
  public/class-images/    → 180x180 PNG (square, for web)
  public/artifact-images/ → 180x180 PNG (square, for web + glasses)
"""

from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import os, sys

SRC = "artifacts-source.png"

GRID = [
    # row 0 – classes
    ["combattente", "assassino", "mago", "carro_armato", "ranger", "guaritore"],
    # row 1 – class artifacts
    ["gauntlets_warrior", "shadow_cloak", "ancient_tome",
     "iron_shield", "dual_scope", "elixir_flask"],
    # row 2 – universal artifacts (only first 3 filled)
    ["exp_crystal", "endurance_ring", "focus_stone", None, None, None],
]

OUT_DIRS = {
    0: "public/class-images",
    1: "public/artifact-images",
    2: "public/artifact-images",
}

OUT_SIZE = (180, 180)

AUTOCONTRAST_CUTOFF = 1
GAMMA               = 0.72
CONTRAST_FACTOR     = 1.40
SHARPEN_RADIUS      = 2
SHARPEN_PERCENT     = 140


def apply_gamma(img: Image.Image, gamma: float) -> Image.Image:
    inv = 1.0 / gamma
    lut = [min(255, int((i / 255.0) ** inv * 255 + 0.5)) for i in range(256)]
    return img.point(lut)


def enhance(icon: Image.Image) -> Image.Image:
    g = icon.convert("L")
    g = ImageOps.autocontrast(g, cutoff=AUTOCONTRAST_CUTOFF)
    g = apply_gamma(g, GAMMA)
    g = ImageEnhance.Contrast(g).enhance(CONTRAST_FACTOR)
    g = g.filter(ImageFilter.UnsharpMask(radius=SHARPEN_RADIUS, percent=SHARPEN_PERCENT))
    return g


def place_on_canvas(icon: Image.Image, out_size: tuple) -> Image.Image:
    iw, ih = icon.size
    ow, oh = out_size
    scale = min(ow / iw, oh / ih) * 0.88          # slight margin
    new_w, new_h = max(1, int(iw * scale)), max(1, int(ih * scale))
    resized = icon.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("L", out_size, 0)
    canvas.paste(resized, ((ow - new_w) // 2, (oh - new_h) // 2))
    return canvas


def split(src_path: str):
    img = Image.open(src_path).convert("RGBA")
    W, H = img.size
    print(f"Source: {W}x{H}")

    rows = len(GRID)
    cols = max(len(row) for row in GRID)

    # Auto-detect cell size from image dimensions
    # Try to find the icon area (skip label rows below icons)
    # Row height: we estimate the icon portion is ~75% of each row
    row_h = H // rows
    col_w = W // cols

    print(f"Estimated cell: {col_w}x{row_h}px")

    for ri, row in enumerate(GRID):
        out_dir = OUT_DIRS[ri]
        os.makedirs(out_dir, exist_ok=True)

        for ci, name in enumerate(row):
            if name is None:
                continue

            # Cell boundaries
            x0 = ci * col_w
            y0 = ri * row_h
            x1 = x0 + col_w
            y1 = y0 + row_h

            cell = img.crop((x0, y0, x1, y1))
            cw, ch = cell.size

            # Use top 72% of cell (skip label text at bottom)
            icon_area = cell.crop((0, 0, cw, int(ch * 0.72)))

            # Tight bounding box on bright content
            gray = icon_area.convert("L")
            bbox = gray.point(lambda p: 255 if p > 25 else 0).getbbox()
            if bbox:
                pad = 8
                bx0 = max(0, bbox[0] - pad)
                by0 = max(0, bbox[1] - pad)
                bx1 = min(cw, bbox[2] + pad)
                by1 = min(int(ch * 0.72), bbox[3] + pad)
                cropped = icon_area.crop((bx0, by0, bx1, by1))
            else:
                cropped = icon_area

            enhanced = enhance(cropped)
            final = place_on_canvas(enhanced, OUT_SIZE)

            # Save both grayscale (glasses) and color RGBA (web)
            out_path = os.path.join(out_dir, f"{name}.png")
            final.convert("RGBA").save(out_path)
            print(f"  [{ri},{ci}] {name}.png → {out_dir}/")

    print("\nDone.")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else SRC
    if not os.path.exists(src):
        print(f"ERROR: source image not found: {src}")
        print("Save the artifacts image as 'artifacts-source.png' in the project root.")
        sys.exit(1)
    split(src)
