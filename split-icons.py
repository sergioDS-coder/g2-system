#!/usr/bin/env python3
"""
Split quest-icons-source.png into individual quest icon files.
Detects the grid automatically using white-pixel row/column analysis.
Output: public/quest-images/<name>.png (180x288 each)
"""

from PIL import Image
import os, sys

# Grid layout as shown in the source image (row-major order)
GRID = [
    ["corsa",           "flessioni",    "addominali"],
    ["plank",           "yoga",         "scale"],
    ["scale",           "fixed_camminata", "meditazione"],
    ["lettura",         "studio",       "scrittura"],
    ["noscreen",        "noscreen",     "fixed_sonno"],
]
# "scale" appears twice — row 3 col 0 overwrites row 2 col 2 (same name), that's fine.
# "noscreen" appears twice — same icon, col 1 is kept.

SRC = "quest-icons-source.png"
OUT_DIR = "public/quest-images"
OUT_W, OUT_H = 180, 288   # target size for each icon

def detect_rows_cols(img):
    """Find row/col boundaries by looking for black separator bands."""
    w, h = img.size
    gray = img.convert("L")
    pixels = gray.load()

    # Compute average brightness per row
    row_avg = []
    for y in range(h):
        total = sum(pixels[x, y] for x in range(w))
        row_avg.append(total / w)

    # Compute average brightness per column
    col_avg = []
    for x in range(w):
        total = sum(pixels[x, y] for y in range(h))
        col_avg.append(total / h)

    THRESHOLD = 12   # rows/cols with avg < threshold are "black separators"

    def find_bands(avgs, n_expected):
        """Split into n_expected content bands by finding dark separator regions."""
        in_content = False
        bands = []
        start = 0
        for i, v in enumerate(avgs):
            if not in_content and v > THRESHOLD:
                in_content = True
                start = i
            elif in_content and v <= THRESHOLD:
                in_content = False
                bands.append((start, i))
        if in_content:
            bands.append((start, len(avgs)))
        return bands

    row_bands = find_bands(row_avg, len(GRID))
    col_bands = find_bands(col_avg, len(GRID[0]))

    # Merge any over-split bands
    def merge_bands(bands, n):
        while len(bands) > n:
            # merge the pair with smallest gap
            min_gap = float("inf")
            idx = 0
            for i in range(len(bands) - 1):
                gap = bands[i+1][0] - bands[i][1]
                if gap < min_gap:
                    min_gap = gap
                    idx = i
            bands[idx] = (bands[idx][0], bands[idx+1][1])
            bands.pop(idx + 1)
        return bands

    row_bands = merge_bands(row_bands, len(GRID))
    col_bands = merge_bands(col_bands, len(GRID[0]))

    print(f"  Detected {len(row_bands)} row bands, {len(col_bands)} col bands")
    for i, (a, b) in enumerate(row_bands):
        print(f"    row {i}: y={a}..{b}")
    for j, (a, b) in enumerate(col_bands):
        print(f"    col {j}: x={a}..{b}")

    return row_bands, col_bands

def remove_label(img_crop):
    """
    Remove the text label at the bottom of each cell.
    Strategy: scan from the bottom up to find where white pixels stop being
    "text-like" and the icon body begins, then trim + keep icon area only.
    """
    gray = img_crop.convert("L")
    w, h = gray.size
    pixels = gray.load()

    # Find the lowest row that has significant white content (part of the icon)
    # Labels are thin text rows; the icon body has denser white fills.
    # Scan from bottom, skip rows with sparse content (text baseline), then trim.
    # Simple heuristic: find the last row from bottom where >5% of pixels are >200.

    cutoff = h
    for y in range(h - 1, -1, -1):
        bright = sum(1 for x in range(w) if pixels[x, y] > 200)
        if bright / w > 0.05:
            cutoff = y + 1
            break

    # Now scan upward from cutoff to find where icon ends (last dense row)
    # Then go a bit further to find where label starts (first sparse zone above cutoff)
    # Simpler: just drop the bottom 20% which typically contains only the label text
    icon_bottom = int(h * 0.78)

    # Find actual icon bottom by scanning from icon_bottom upward looking for content
    for y in range(icon_bottom, cutoff):
        bright = sum(1 for x in range(w) if pixels[x, y] > 200)
        if bright / w < 0.01:   # very sparse = gap between icon and label
            icon_bottom = y
            break

    # Trim margins
    # Find bounding box of white content in icon area only
    icon_region = img_crop.crop((0, 0, w, icon_bottom))
    bbox = icon_region.convert("L").point(lambda p: 255 if p > 50 else 0).getbbox()
    if bbox is None:
        return icon_region  # nothing found, return as-is
    # Add small padding
    pad = 12
    x0 = max(0, bbox[0] - pad)
    y0 = max(0, bbox[1] - pad)
    x1 = min(w, bbox[2] + pad)
    y1 = min(icon_bottom, bbox[3] + pad)
    return img_crop.crop((x0, y0, x1, y1))

def main():
    if not os.path.exists(SRC):
        print(f"ERROR: {SRC} not found. Save the source image there and retry.")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    img = Image.open(SRC).convert("RGBA")
    print(f"Source image: {img.size[0]}x{img.size[1]}")

    row_bands, col_bands = detect_rows_cols(img)

    if len(row_bands) != len(GRID) or len(col_bands) != len(GRID[0]):
        print(f"WARNING: expected {len(GRID)}x{len(GRID[0])} grid, "
              f"got {len(row_bands)}x{len(col_bands)}. Check THRESHOLD or image.")

    saved = set()
    for ri, (ry0, ry1) in enumerate(row_bands):
        for ci, (cx0, cx1) in enumerate(col_bands):
            name = GRID[ri][ci]
            cell = img.crop((cx0, ry0, cx1, ry1))
            icon = remove_label(cell)

            # Convert to black-background RGBA
            bg = Image.new("RGBA", icon.size, (0, 0, 0, 255))
            if icon.mode == "RGBA":
                bg.paste(icon, mask=icon.split()[3])
            else:
                bg.paste(icon)

            # Resize to target (maintain aspect ratio, pad with black)
            iw, ih = bg.size
            scale = min(OUT_W / iw, OUT_H / ih)
            new_w = int(iw * scale)
            new_h = int(ih * scale)
            resized = bg.resize((new_w, new_h), Image.LANCZOS)

            final = Image.new("RGBA", (OUT_W, OUT_H), (0, 0, 0, 255))
            paste_x = (OUT_W - new_w) // 2
            paste_y = (OUT_H - new_h) // 2
            final.paste(resized, (paste_x, paste_y))

            out_path = os.path.join(OUT_DIR, f"{name}.png")
            final.save(out_path)
            if name not in saved:
                print(f"  Saved: {out_path}  ({OUT_W}x{OUT_H})")
                saved.add(name)
            else:
                print(f"  Skip duplicate: {name} (row {ri}, col {ci})")

    print(f"\nDone. {len(saved)} unique icons saved to {OUT_DIR}/")

if __name__ == "__main__":
    main()
