#!/usr/bin/env python3
"""
Split quest-icons-source.png (816x1312) into 13 individual quest icon files.
Uses fixed grid: 3 cols × 5 rows, then crops label text at bottom of each cell.
"""

from PIL import Image
import os

GRID = [
    ["corsa",        "flessioni",       "addominali"],
    ["plank",        "yoga",            "scale"],
    ["scale",        "fixed_camminata", "meditazione"],
    ["lettura",      "studio",          "scrittura"],
    ["noscreen",     "noscreen",        "fixed_sonno"],
]

SRC     = "quest-icons-source.png"
OUT_DIR = "public/quest-images"
OUT_W, OUT_H = 180, 288

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    W, H = src.size
    print(f"Source: {W}x{H}")

    ROWS = len(GRID)
    COLS = len(GRID[0])
    cell_w = W // COLS   # 272
    cell_h = H // ROWS   # 262

    saved = set()
    for ri in range(ROWS):
        for ci in range(COLS):
            name = GRID[ri][ci]

            # Cell boundaries (slight inward crop to avoid grid artifacts)
            x0 = ci * cell_w + 4
            y0 = ri * cell_h + 4
            x1 = x0 + cell_w - 8
            y1 = y0 + cell_h - 8

            cell = src.crop((x0, y0, x1, y1))
            cw, ch = cell.size
            gray = cell.convert("L")
            pixels = gray.load()

            # Find the gap between icon and label: scan from bottom,
            # first find the label rows (sparse white text), then the icon end.
            # Strategy: row brightness profile, find significant low-content gap.
            row_bright = []
            for y in range(ch):
                cnt = sum(1 for x in range(cw) if pixels[x, y] > 128)
                row_bright.append(cnt / cw)

            # Find icon bottom: the last high-content row before the label gap.
            # Labels start roughly at 78-85% of cell height.
            # Look for a dark gap (< 2% bright pixels) below 65% mark.
            search_from = int(ch * 0.62)
            icon_bottom = int(ch * 0.88)   # default
            for y in range(search_from, ch):
                if row_bright[y] < 0.02:
                    icon_bottom = y
                    break

            # Crop to icon only (tight bounding box + padding)
            icon_crop = cell.crop((0, 0, cw, icon_bottom))
            bbox = icon_crop.convert("L").point(lambda p: 255 if p > 40 else 0).getbbox()
            if bbox:
                pad = 14
                bx0 = max(0, bbox[0] - pad)
                by0 = max(0, bbox[1] - pad)
                bx1 = min(cw, bbox[2] + pad)
                by1 = min(icon_bottom, bbox[3] + pad)
                icon_crop = cell.crop((bx0, by0, bx1, by1))

            # Place on black background, scale to fit OUT_W × OUT_H
            iw, ih = icon_crop.size
            scale = min(OUT_W / iw, OUT_H / ih)
            new_w = int(iw * scale)
            new_h = int(ih * scale)
            resized = icon_crop.resize((new_w, new_h), Image.LANCZOS)

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
                print(f"  Saved {name}.png  (icon crop: {iw}x{ih})")
                saved.add(name)
            else:
                print(f"  Skip  {name} (duplicate at row {ri}, col {ci})")

    print(f"\nDone. {len(saved)} icons → {OUT_DIR}/")

if __name__ == "__main__":
    main()
