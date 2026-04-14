#!/usr/bin/env python3
from __future__ import annotations

import shutil
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PROTOTYPE_DIR = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/prototype")
BACKUP_DIR = PROTOTYPE_DIR / f"_backup_{date.today().isoformat()}"

REAL_DIR = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/section3-real-2026-04-07")
PROOF_DIR = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07")

TARGET_SIZE = (1440, 900)

REPLACEMENTS = {
    "01_buyer_home.png": REAL_DIR / "kvadrato_real_homepage_balanced.png",
    "02_buyer_listings.png": REAL_DIR / "kvadrato_real_listing_overview.png",
    "03_buyer_detail.png": REAL_DIR / "kvadrato_real_property_detail.png",
    "04_buyer_viewer3d.png": PROOF_DIR / "kvadrato_proof_3d_room_configuration.png",
    # Keep dashboard source from existing prototype backup to preserve seller-oriented mockup.
    "08_seller_dashboard.png": BACKUP_DIR / "08_seller_dashboard.png",
}


def cover_resize(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    resized = img.resize((int(src_w * scale), int(src_h * scale)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    return resized.crop((left, top, left + target_w, top + target_h))


def build_clean_flow_selector(path: Path) -> None:
    img = Image.new("RGB", TARGET_SIZE, "#f5f7fb")
    draw = ImageDraw.Draw(img)

    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 60)
        sub_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 30)
        card_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 34)
        card_sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 24)
    except OSError:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()
        card_title = ImageFont.load_default()
        card_sub = ImageFont.load_default()

    # Main container
    x0, y0, x1, y1 = 320, 170, 1120, 730
    draw.rounded_rectangle((x0, y0, x1, y1), radius=24, fill="white", outline="#d8dee9", width=2)

    draw.text((560, 240), "KVADRATO", fill="#1f2937", font=title_font)
    draw.text((470, 325), "Odaberite korisnicki tok za nastavak", fill="#4b5563", font=sub_font)

    # Two cards
    card_w, card_h = 250, 220
    cards = [
        (430, 410, "Kupac", "Pregled nekretnina"),
        (760, 410, "Prodavatelj", "Upravljanje oglasima"),
    ]
    for cx, cy, t1, t2 in cards:
        draw.rounded_rectangle((cx, cy, cx + card_w, cy + card_h), radius=16, fill="#fafafa", outline="#d1d5db", width=2)
        draw.text((cx + 72, cy + 75), t1, fill="#111827", font=card_title)
        draw.text((cx + 30, cy + 130), t2, fill="#6b7280", font=card_sub)

    img.save(path)


def main() -> None:
    if not PROTOTYPE_DIR.exists():
        raise FileNotFoundError(PROTOTYPE_DIR)

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    for png in sorted(PROTOTYPE_DIR.glob("*.png")):
        backup_file = BACKUP_DIR / png.name
        if not backup_file.exists():
            shutil.copy2(png, backup_file)

    # Update key visual screens to match improved UI quality.
    for target_name, source in REPLACEMENTS.items():
        if not source.exists():
            raise FileNotFoundError(source)
        with Image.open(source) as src:
            out = cover_resize(src.convert("RGB"), TARGET_SIZE)
            out.save(PROTOTYPE_DIR / target_name)

    # Replace flow-selector with a clean non-emoji variant.
    build_clean_flow_selector(PROTOTYPE_DIR / "00_flow_selector.png")

    print(f"Updated prototype images in: {PROTOTYPE_DIR}")
    print(f"Backup of originals: {BACKUP_DIR}")


if __name__ == "__main__":
    main()
