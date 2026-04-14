#!/usr/bin/env python3
from __future__ import annotations

import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image, ImageDraw

DOCX_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Section_3_Prototip_UIUX_standalone.docx")


def patch_image1(path: Path) -> None:
    """Remove emoji icons on flow selector cards (Slika 1) while preserving layout."""
    img = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Card backgrounds around former emoji spots.
    card_bg = (245, 245, 245)
    icon_color = (156, 163, 175)

    # Left card icon area (replace former house emoji)
    draw.rectangle((500, 385, 560, 450), fill=card_bg)
    draw.ellipse((520, 404, 542, 426), fill=icon_color)

    # Right card icon area (replace former clipboard emoji)
    draw.rectangle((706, 385, 768, 450), fill=card_bg)
    draw.ellipse((726, 404, 748, 426), fill=icon_color)

    img.save(path)


def patch_image5(path: Path) -> None:
    """Remove center emoji marker from 3D prototype screen (Slika 5)."""
    img = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Background block in center (match surrounding canvas gray)
    bg = (237, 237, 240)
    draw.rectangle((578, 334, 648, 416), fill=bg)

    # Add neutral minimalist square icon
    border = (156, 163, 175)
    draw.rectangle((603, 360, 623, 380), outline=border, width=2)
    draw.line((603, 370, 623, 370), fill=border, width=2)
    draw.line((613, 360, 613, 380), fill=border, width=2)

    img.save(path)


def main() -> None:
    if not DOCX_PATH.exists():
        raise FileNotFoundError(DOCX_PATH)

    with tempfile.TemporaryDirectory(prefix="section3_fix_") as tmp:
        temp_root = Path(tmp)
        with ZipFile(DOCX_PATH, "r") as zf:
            zf.extractall(temp_root)

        image1 = temp_root / "word" / "media" / "image1.png"
        image5 = temp_root / "word" / "media" / "image5.png"
        if not image1.exists() or not image5.exists():
            raise FileNotFoundError("Expected prototype media files image1.png and image5.png not found.")

        patch_image1(image1)
        patch_image5(image5)

        # Repack in-place, preserving document structure/relations.
        with ZipFile(DOCX_PATH, "w", compression=ZIP_DEFLATED) as zf:
            for file_path in temp_root.rglob("*"):
                if file_path.is_file():
                    zf.write(file_path, file_path.relative_to(temp_root).as_posix())

    print(f"Patched prototype emojis in: {DOCX_PATH}")
    print("Updated media: word/media/image1.png, word/media/image5.png")


if __name__ == "__main__":
    main()
