#!/usr/bin/env python3
"""
Split quest-icons-source.png (816x1312, detailed hexagonal cards) into
individual quest icons, enhanced for the G2 glasses' 16-level green display.

Pipeline per icon:
  1. crop the hex card cell, drop the label bar
  2. tight bounding box on bright content
  3. grayscale + autocontrast (stretch histogram)
  4. gamma brighten midtones (lift the subject)
  5. contrast boost + unsharp mask for crisp edges
  6. center on black 180x288 canvas
"""

from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import os

GRID = [
    ["corsa",          "flessioni",    "addominali"],
    ["plank",          "yoga",         "scale"],
    ["fixed_camminata","meditazione",  "lettura"],
    ["studio",         "scrittura",    "fixed_sonno"],
]

COL_X = [(20, 258), (311, 518), (563, 800)]
ROW_Y = [(305, 510), (535, 795), (810, 1055), (1075, 1285)]

SRC     = "quest-icons-source.png"
OUT_DIR = "public/quest-images"
OUT_W, OUT_H = 180, 288

# Enhancement parameters
AUTOCONTRAST_CUTOFF = 1   # clip % of darkest/brightest pixels before stretch
GAMMA               = 0.72  # < 1 brightens midtones
CONTRAST_FACTOR     = 1.45
SHARPEN_RADIUS      = 2
SHARPEN_PERCENT     = 150

def apply_gamma(img: Image.Image, gamma: float) -> Image.Image:
    inv = 1.0 / gamma
    lut = [min(255, int((i / 255.0) ** inv * 255 + 0.5)) for i in range(256)]
    return img.point(lut)

def find_icon_bottom(cell: Image.Image) -> int:
    cw, ch = cell.size
    px = cell.convert("L").load()
    icon_bottom = int(ch * 0.82)
    for y in range(int(ch * 0.88), int(ch * 0.50), -1):
        bright = sum(1 for x in range(cw) if px[x, y] > 60) / cw
        if bright < 0.08:
            icon_bottom = y
            break
    return icon_bottom

def enhance(icon: Image.Image) -> Image.Image:
    g = icon.convert("L")
    g = ImageOps.autocontrast(g, cutoff=AUTOCONTRAST_CUTOFF)
    g = apply_gamma(g, GAMMA)
    g = ImageEnhance.Contrast(g).enhance(CONTRAST_FACTOR)
    g = g.filter(ImageFilter.UnsharpMask(radius=SHARPEN_RADIUS, percent=SHARPEN_PERCENT))
    return g

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    print(f"Source: {src.size[0]}x{src.size[1]}")

    saved = set()
    for ri, (ry0, ry1) in enumerate(ROW_Y):
        for ci, (cx0, cx1) in enumerate(COL_X):
            name = GRID[ri][ci]
            cell = src.crop((cx0, ry0, cx1, ry1))

            icon_bottom = find_icon_bottom(cell)
            cw, ch = cell.size
            area = cell.crop((0, 0, cw, icon_bottom))
            bbox = area.convert("L").point(lambda p: 255 if p > 30 else 0).getbbox()
            if bbox:
                pad = 6
                x0 = max(0, bbox[0] - pad)
                y0 = max(0, bbox[1] - pad)
                x1 = min(cw, bbox[2] + pad)
                y1 = min(icon_bottom, bbox[3] + pad)
                icon = cell.crop((x0, y0, x1, y1))
            else:
                icon = area

            enhanced = enhance(icon)   # returns "L" mode

            iw, ih = enhanced.size
            scale = min(OUT_W / iw, OUT_H / ih)
            new_w, new_h = int(iw * scale), int(ih * scale)
            resized = enhanced.resize((new_w, new_h), Image.LANCZOS)

            final = Image.new("L", (OUT_W, OUT_H), 0)
            px = (OUT_W - new_w) // 2
            py = (OUT_H - new_h) // 2
            final.paste(resized, (px, py))

            out_path = os.path.join(OUT_DIR, f"{name}.png")
            final.convert("RGBA").save(out_path)
            if name not in saved:
                print(f"  Saved {name}.png  (crop {iw}x{ih})")
                saved.add(name)

    print(f"\nDone. {len(saved)} icons → {OUT_DIR}/")

if __name__ == "__main__":
    main()
