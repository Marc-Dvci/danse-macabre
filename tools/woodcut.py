"""Turn a scanned woodcut (black ink on paper) into bone-white lines on ink black, for the app and the film.

    python tools/woodcut.py IN.jpg OUT.webp [--height 900]
"""

from __future__ import annotations

import argparse

from PIL import Image, ImageOps

INK = (13, 11, 10)
BONE = (236, 230, 214)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--height", type=int, default=900)
    args = ap.parse_args()

    img = Image.open(args.src).convert("L")
    img = ImageOps.autocontrast(img, cutoff=1)
    # Crop the paper margin: keep the box that holds the printed block.
    dark = img.point(lambda v: 255 if v < 110 else 0)
    box = dark.getbbox()
    if box:
        pad = 6
        img = img.crop((max(box[0] - pad, 0), max(box[1] - pad, 0), box[2] + pad, box[3] + pad))
    inv = ImageOps.invert(img)
    # Paper goes fully black, ink lines go bright: a steep curve with a soft knee.
    inv = inv.point(lambda v: 0 if v < 70 else min(255, int((v - 70) * 255 / 120)))
    w = round(inv.width * args.height / inv.height)
    inv = inv.resize((w, args.height), Image.LANCZOS)
    out = ImageOps.colorize(inv, black=INK, white=BONE)
    out.save(args.dst, quality=82, method=6)
    print(args.dst, out.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
