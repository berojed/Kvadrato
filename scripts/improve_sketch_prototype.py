#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import shutil
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

SOURCE_SKETCH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Kvadrato_Prototip.sketch")
BACKUP_SKETCH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Kvadrato_Prototip_backup_2026-04-08.sketch")
UPDATED_COPY = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Kvadrato_Prototip_updated_2026-04-08.sketch")

EMOJI_RE = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]")

REPLACEMENTS = {
    "Trziste nekretnina za 21. stoljece": "Mid-fidelity prototip uskladen s implementacijom",
    "Odaberite svoju ulogu": "Odaberite korisnicki tok",
    "Pregledaj nekretnine": "Pregled nekretnina",
    "Upravljaj oglasima": "Upravljanje oglasima",
    "Pronadi svoj dom": "Pronadi savrsen prostor",
    "Najveca ponuda nekretnina u Hrvatskoj": "Pregledaj tisucu nekretnina i kontaktiraj prodavatelje",
    "Pretrazi po gradu ili lokaciji...": "Grad ili mjesto...",
    "Nekretnina": "Aktivnih oglasa",
    "Kupaca": "Zadovoljnih kupaca",
    "Prodavaca": "Verificiranih prodavatelja",
    "Godina iskustva": "Godina iskustva na trzistu",
    "Kvadrato  -  Sve nekretnine na jednom mjestu": "Kvadrato - pronalazak nekretnina na jednom mjestu",
    "Pregled nekretnina": "Pregled dostupnih nekretnina",
    "Raspon cijena": "Cijena (EUR)",
    "Primijeni filtere": "Primijeni filtre",
    "Stan Ilica 42, Zagreb": "Moderan dvosoban stan s balkonom u centru Zagreba",
    "Lijepo renoviran stan u srcu Zagreba, idealan za obitelj ili investitore.": "Moderan dvosoban stan na atraktivnoj lokaciji, funkcionalnog rasporeda i renoviranog interijera.",
    "95 m2": "68 m²",
    "3 sobe": "2 sobe",
    "2 kupaonice": "1 kupaonica",
    "3/5": "3/6",
    "2008": "2016",
    "Obnovljeno": "Renovirano",
    "Centralno": "Centralno grijanje",
    "Namjesten": "Djelomicno namjesten",
    "Moderan stan u centru": "Moderan dvosoban stan s balkonom",
    "Zagreb, Gornji Grad": "Zagreb, Grad Zagreb",
    "65 m2  -  2 sobe  -  1 kupaonica": "68 m² • 2 sobe • 1 kupaonica",
    "145.000 EUR": "185.000 €",
    "Dobro dosli, Marko!": "Kontrolna ploca prodavatelja",
    "6. travnja 2026.": "Upravljajte oglasima, upitima i razgledavanjima",
    "Pogledajte sve oglase": "Pregled aktivnih oglasa",
    "Unesi naziv...": "Moderan dvosoban stan s balkonom u centru Zagreba",
    "145000": "185000",
    "95": "68",
    "Lijepo renoviran stan u srcu Zagreba...": "Moderan dvosoban stan na atraktivnoj lokaciji, funkcionalnog rasporeda i renoviranog interijera.",
    "Naziv nekretnine": "Naslov nekretnine",
    "Slika": "Fotografija",
}

# Targeted sizing for clearer typographic hierarchy.
FONT_OVERRIDES = {
    "Pronadi savrsen prostor": 64,
    "Odaberite korisnicki tok": 32,
    "Pregled dostupnih nekretnina": 42,
    "Moderan dvosoban stan s balkonom u centru Zagreba": 48,
    "Kontrolna ploca prodavatelja": 48,
    "Postavke": 44,
    "Profil": 44,
}

GROUP_HEIGHT_UPDATES = {
    "App/FlowSelector": 900,
    "Buyer/Home": 900,
    "Buyer/Listings": 980,
    "Buyer/PropertyDetail": 1250,
    "Buyer/Viewer3D": 900,
    "Seller/Dashboard": 900,
}

TRIM_RULES = {
    "Buyer/Listings": 950,
    "Buyer/PropertyDetail": 1200,
}


def clean_string(value: str) -> str:
    sanitized = EMOJI_RE.sub("", value).strip()
    return REPLACEMENTS.get(sanitized, sanitized)


def update_text_layer(layer: dict) -> bool:
    changed = False
    attributed = layer.get("attributedString") or {}
    current = attributed.get("string", "")
    if not isinstance(current, str):
        return False

    updated = clean_string(current)
    if updated != current:
        layer["attributedString"]["string"] = updated
        if layer.get("name") == current:
            layer["name"] = updated[:60]
        changed = True

    length = len(layer["attributedString"]["string"])
    attrs = layer["attributedString"].get("attributes") or []
    for entry in attrs:
        if isinstance(entry, dict):
            entry["location"] = 0
            entry["length"] = length

    text_value = layer["attributedString"]["string"]
    if text_value in FONT_OVERRIDES:
        size = FONT_OVERRIDES[text_value]
        # Style font size
        encoded = (
            ((layer.get("style") or {}).get("textStyle") or {}).get("encodedAttributes") or {}
        )
        font_attr = encoded.get("MSAttributedStringFontAttribute") or {}
        font_desc = font_attr.get("attributes") or {}
        if font_desc.get("size") != size:
            font_desc["size"] = size
            font_attr["attributes"] = font_desc
            encoded["MSAttributedStringFontAttribute"] = font_attr
            layer["style"]["textStyle"]["encodedAttributes"] = encoded
            changed = True

        # Attributed range font size
        for entry in attrs:
            attr = (entry.get("attributes") or {}).get("MSAttributedStringFontAttribute") or {}
            attr_desc = attr.get("attributes") or {}
            if attr_desc.get("size") != size:
                attr_desc["size"] = size
                attr["attributes"] = attr_desc
                entry["attributes"]["MSAttributedStringFontAttribute"] = attr
                changed = True

    return changed


def walk_and_update(node: object, current_group: str = "") -> tuple[int, int]:
    """Returns (text_updates, hidden_layers)."""
    text_updates = 0
    hidden_layers = 0

    if isinstance(node, dict):
        node_class = node.get("_class")
        if node_class == "group" and node.get("name"):
            current_group = node["name"]
            if current_group in GROUP_HEIGHT_UPDATES and isinstance(node.get("frame"), dict):
                node["frame"]["height"] = GROUP_HEIGHT_UPDATES[current_group]

        if node_class == "text":
            if update_text_layer(node):
                text_updates += 1

        # Trim overscrolled content in specific long groups.
        if current_group in TRIM_RULES and isinstance(node.get("frame"), dict):
            y = node["frame"].get("y")
            if isinstance(y, (int, float)) and y > TRIM_RULES[current_group]:
                if node.get("_class") != "text" or (node.get("attributedString") or {}).get("string") != "":
                    node["isVisible"] = False
                    hidden_layers += 1

        for value in node.values():
            if isinstance(value, (dict, list)):
                t, h = walk_and_update(value, current_group)
                text_updates += t
                hidden_layers += h

    elif isinstance(node, list):
        for item in node:
            t, h = walk_and_update(item, current_group)
            text_updates += t
            hidden_layers += h

    return text_updates, hidden_layers


def main() -> None:
    if not SOURCE_SKETCH.exists():
        raise FileNotFoundError(SOURCE_SKETCH)

    if not BACKUP_SKETCH.exists():
        shutil.copy2(SOURCE_SKETCH, BACKUP_SKETCH)

    with tempfile.TemporaryDirectory(prefix="sketch_refine_") as tmp:
        temp_root = Path(tmp)
        with ZipFile(SOURCE_SKETCH, "r") as zf:
            zf.extractall(temp_root)

        page_files = sorted((temp_root / "pages").glob("*.json"))
        total_text_updates = 0
        total_hidden_layers = 0
        for page_file in page_files:
            page = json.loads(page_file.read_text(encoding="utf-8"))
            t, h = walk_and_update(page)
            total_text_updates += t
            total_hidden_layers += h
            page_file.write_text(
                json.dumps(page, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

        # Repack into original path and an explicit updated copy.
        for target in [SOURCE_SKETCH, UPDATED_COPY]:
            with ZipFile(target, "w", compression=ZIP_DEFLATED) as out_zip:
                for file_path in temp_root.rglob("*"):
                    if file_path.is_file():
                        out_zip.write(file_path, file_path.relative_to(temp_root).as_posix())

    print(f"Backup: {BACKUP_SKETCH}")
    print(f"Updated original: {SOURCE_SKETCH}")
    print(f"Updated copy: {UPDATED_COPY}")
    print(f"Text layers updated: {total_text_updates}")
    print(f"Layers hidden for layout cleanup: {total_hidden_layers}")


if __name__ == "__main__":
    main()
