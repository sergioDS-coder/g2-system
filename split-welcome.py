#!/usr/bin/env python3
"""
Process Welcome/<rank>.png anime rank cards (566x666) into
public/welcome-images/<rank>.png (180x288) for the G2 greeting screen.

Steps per card:
  1. crop away bottom title bar + corner badge + frame border
  2. center-crop to 180x288 aspect (fill, no letterbox)
  3. grayscale + autocontrast + gamma brighten + contrast + unsharp
"""

from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import os

RANKS = ["F", "E", "D", "C", "B", "A", "S", "SS", "SSS"]
SRC_DIR = "Welcome"
OUT_DIR = "public/welcome-images"
OUT_W, OUT_H = 180, 288

# Card layout (566x666): title bar at bottom, thin frame border
BORDER      = 10          # frame border to trim on all sides
TITLE_BAR_H = 96          # bottom title bar height to remove

# Enhancement (anime art tolerates a bit less aggression than the line icons)
AUTOCONTRAST_CUTOFF = 1
GAMMA               = 0.85
CONTRAST_FACTOR     = 1.25
SHARPEN_RADIUS      = 2
SHARPEN_PERCENT     = 110

def apply_gamma(img, gamma):
    inv = 1.0 / gamma
    lut = [min(255, int((i / 255.0) ** inv * 255 + 0.5)) for i in range(256)]
    return img.point(lut)

def enhance(img):
    g = img.convert("L")
    g = ImageOps.autocontrast(g, cutoff=AUTOCONTRAST_CUTOFF)
    g = apply_gamma(g, GAMMA)
    g = ImageEnhance.Contrast(g).enhance(CONTRAST_FACTOR)
    g = g.filter(ImageFilter.UnsharpMask(radius=SHARPEN_RADIUS, percent=SHARPEN_PERCENT))
    return g

def center_crop_fill(img, tw, th):
    iw, ih = img.size
    scale = max(tw / iw, th / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    img = img.resize((nw, nh), Image.LANCZOS)
    left = (nw - tw) // 2
    top  = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for rank in RANKS:
        src_path = os.path.join(SRC_DIR, f"{rank}.png")
        if not os.path.exists(src_path):
            print(f"  MISSING {src_path}")
            continue
        card = Image.open(src_path).convert("RGB")
        W, H = card.size

        # crop frame border + bottom title bar (keep character art)
        art = card.crop((BORDER, BORDER, W - BORDER, H - TITLE_BAR_H))

        filled = center_crop_fill(art, OUT_W, OUT_H)
        final = enhance(filled)
        out = os.path.join(OUT_DIR, f"{rank}.png")
        final.convert("RGBA").save(out)
        print(f"  Saved welcome-images/{rank}.png  (from {W}x{H} art {art.size[0]}x{art.size[1]})")

    print(f"\nDone. → {OUT_DIR}/")

if __name__ == "__main__":
    main()
