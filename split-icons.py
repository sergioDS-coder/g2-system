#!/usr/bin/env python3
"""
Split the new quest-icons-source.png (816x1312, detailed hexagonal cards)
into individual quest icon files for G2 glasses display.

Grid layout (identified from brightness analysis):
  Columns:  x≈20-258, x≈311-518, x≈563-800
  Header:   y=0..~305
  Row 1:    y≈305..510  → corsa, flessioni, addominali
  Row 2:    y≈535..795  → plank, yoga, scale
  Row 3:    y≈810..1055 → fixed_camminata, meditazione, lettura
  Row 4:    y≈1075..1285→ studio, scrittura, fixed_sonno
"""

from PIL import Image, ImageFilter
import os

GRID = [
    ["corsa",          "flessioni",    "addominali"],
    ["plank",          "yoga",         "scale"],
    ["fixed_camminata","meditazione",  "lettura"],
    ["studio",         "scrittura",    "fixed_sonno"],
]

# Column x-ranges [start, end] (from brightness dip analysis)
COL_X = [(20, 258), (311, 518), (563, 800)]

# Row y-ranges [start, end] — exclude label bar (bottom ~20% of each row)
ROW_Y = [(305, 510), (535, 795), (810, 1055), (1075, 1285)]

SRC     = "quest-icons-source.png"
OUT_DIR = "public/quest-images"
OUT_W, OUT_H = 180, 288

def crop_icon(cell: Image.Image) -> Image.Image:
    """Remove label text area at the bottom of each hex card cell."""
    cw, ch = cell.size
    gray = cell.convert("L")
    pixels = gray.load()

    # Scan from bottom to find where label text ends and icon hex frame is
    # Label area typically: bright text rows, then a thin bar, then dark gap
    # Find the first substantial dark row (< 8% bright pixels) scanning up from 90%
    icon_bottom = int(ch * 0.82)
    for y in range(int(ch * 0.88), int(ch * 0.50), -1):
        bright = sum(1 for x in range(cw) if pixels[x, y] > 60) / cw
        if bright < 0.08:
            icon_bottom = y
            break

    # Tight bounding box on the icon area, add small padding
    icon_area = cell.crop((0, 0, cw, icon_bottom))
    bbox = icon_area.convert("L").point(lambda p: 255 if p > 30 else 0).getbbox()
    if bbox:
        pad = 8
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(cw, bbox[2] + pad)
        y1 = min(icon_bottom, bbox[3] + pad)
        icon_area = cell.crop((x0, y0, x1, y1))

    return icon_area

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    W, H = src.size
    print(f"Source: {W}x{H}")

    saved = set()
    for ri, (ry0, ry1) in enumerate(ROW_Y):
        for ci, (cx0, cx1) in enumerate(COL_X):
            name = GRID[ri][ci]
            cell = src.crop((cx0, ry0, cx1, ry1))
            icon = crop_icon(cell)

            iw, ih = icon.size
            scale = min(OUT_W / iw, OUT_H / ih)
            new_w = int(iw * scale)
            new_h = int(ih * scale)
            resized = icon.resize((new_w, new_h), Image.LANCZOS)

            final = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 255))
            px = (OUT_W - new_w) // 2
            py = (OUT_H - new_h) // 2
            if resized.mode == "RGBA":
                final.paste(resized, (px, py), resized.split()[3])
            else:
                final.paste(resized, (px, py))

            out_path = os.path.join(OUT_DIR, f"{name}.png")
            final.save(out_path)
            if name not in saved:
                print(f"  Saved {name}.png  ({iw}x{ih} → {new_w}x{new_h})")
                saved.add(name)

    print(f"\nDone. {len(saved)} icons → {OUT_DIR}/")

if __name__ == "__main__":
    main()
