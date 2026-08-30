#!/usr/bin/env python3
"""Turn a square logo into a macOS-style app icon (rounded tile + margin).

Usage: python3 scripts/make-icon.py <source-image> <out-png-1024>
"""
import sys
from PIL import Image, ImageDraw, ImageOps

SRC, OUT = sys.argv[1], sys.argv[2]

CANVAS = 1024
TILE = 824          # Apple's icon grid: artwork ~80% of the canvas
RADIUS = 185        # ~22.5% of the tile — the macOS "squircle-ish" corner
MARGIN = (CANVAS - TILE) // 2

logo = Image.open(SRC).convert("RGB")
logo = ImageOps.fit(logo, (TILE, TILE), Image.LANCZOS)

# rounded-rect mask for the tile
mask = Image.new("L", (TILE, TILE), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, TILE - 1, TILE - 1], radius=RADIUS, fill=255)

tile = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
tile.paste(logo, (0, 0), mask)

canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
canvas.paste(tile, (MARGIN, MARGIN), tile)
canvas.save(OUT)
print(f"  icon -> {OUT}")
