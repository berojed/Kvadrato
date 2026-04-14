#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import tempfile
import uuid
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


SKETCH_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Kvadrato_Prototip.sketch")
BUYER_PAGE = Path("pages/2ACF6575-3E5D-4D3F-AE11-CE13EA23B924.json")
SOURCE_GROUP_NAME = "App/FlowSelector"
NEW_GROUP_NAME = "Početni odabir korisničkog toka"


def new_id() -> str:
    return str(uuid.uuid4()).upper()


def regenerate_ids(node: object) -> None:
    if isinstance(node, dict):
        if "do_objectID" in node:
            node["do_objectID"] = new_id()
        for value in node.values():
            regenerate_ids(value)
    elif isinstance(node, list):
        for item in node:
            regenerate_ids(item)


def set_text(layer: dict, value: str) -> None:
    layer["name"] = value[:64]
    attributed = layer.get("attributedString") or {}
    attributed["string"] = value
    attrs = attributed.get("attributes") or []
    for item in attrs:
        if isinstance(item, dict):
            item["location"] = 0
            item["length"] = len(value)
    layer["attributedString"] = attributed


def set_frame(layer: dict, *, x: float, y: float, width: float, height: float) -> None:
    frame = layer.get("frame") or {}
    frame["x"] = x
    frame["y"] = y
    frame["width"] = width
    frame["height"] = height
    layer["frame"] = frame


def find_layer(group: dict, name: str, klass: str | None = None) -> dict:
    for layer in group.get("layers", []):
        if layer.get("name") == name and (klass is None or layer.get("_class") == klass):
            return layer
    raise ValueError(f"Layer not found: {name}")


def clone_text(template: dict, text: str, x: float, y: float, width: float, height: float) -> dict:
    layer = copy.deepcopy(template)
    regenerate_ids(layer)
    set_text(layer, text)
    set_frame(layer, x=x, y=y, width=width, height=height)
    return layer


def clone_rect(template: dict, name: str, x: float, y: float, width: float, height: float) -> dict:
    layer = copy.deepcopy(template)
    regenerate_ids(layer)
    layer["name"] = name
    set_frame(layer, x=x, y=y, width=width, height=height)
    return layer


def ensure_absent(page: dict, name: str) -> None:
    for layer in page.get("layers", []):
        if layer.get("name") == name:
            raise RuntimeError(f"Screen already exists: {name}")


def main() -> None:
    if not SKETCH_PATH.exists():
        raise FileNotFoundError(SKETCH_PATH)

    with tempfile.TemporaryDirectory(prefix="add_flow_screen_") as td:
        temp_root = Path(td)
        with ZipFile(SKETCH_PATH, "r") as zf:
            zf.extractall(temp_root)

        page_path = temp_root / BUYER_PAGE
        page = json.loads(page_path.read_text(encoding="utf-8"))
        ensure_absent(page, NEW_GROUP_NAME)

        source_group = None
        for layer in page.get("layers", []):
            if layer.get("name") == SOURCE_GROUP_NAME and layer.get("_class") == "group":
                source_group = layer
                break
        if source_group is None:
            raise RuntimeError(f"Source group not found: {SOURCE_GROUP_NAME}")

        new_group = copy.deepcopy(source_group)
        regenerate_ids(new_group)
        new_group["name"] = NEW_GROUP_NAME

        # Place the new frame to the right of existing buyer flow screens.
        set_frame(new_group, x=18040, y=0, width=1440, height=900)

        # Existing layers used as templates.
        text_brand = find_layer(new_group, "Kvadrato", "text")
        text_title = find_layer(new_group, "Odaberite svoju ulogu", "text")
        rect_center = find_layer(new_group, "center-card", "rectangle")
        rect_divider = find_layer(new_group, "divider", "rectangle")
        rect_buyer = find_layer(new_group, "buyer-card", "rectangle")
        rect_seller = find_layer(new_group, "seller-card", "rectangle")
        text_buyer_title = find_layer(new_group, "Kupac", "text")
        text_buyer_desc = find_layer(new_group, "Pregledaj nekretnine", "text")
        text_seller_title = find_layer(new_group, "Prodavač", "text")
        text_seller_desc = find_layer(new_group, "Upravljaj oglasima", "text")

        # Main container and hierarchy.
        set_frame(rect_center, x=300, y=170, width=840, height=560)
        set_frame(text_brand, x=633, y=210, width=175, height=42)
        set_text(text_title, "Kako želite koristiti aplikaciju?")
        set_frame(text_title, x=470, y=275, width=500, height=30)
        set_frame(rect_divider, x=500, y=320, width=440, height=1)

        # Subtitle.
        subtitle = clone_text(
            text_buyer_desc,
            "Odaberite ulogu kako biste nastavili",
            533,
            336,
            374,
            22,
        )

        # Buyer card.
        set_frame(rect_buyer, x=370, y=390, width=320, height=230)
        set_text(text_buyer_title, "Kupac")
        set_frame(text_buyer_title, x=490, y=428, width=90, height=28)
        set_text(text_buyer_desc, "Pregledajte i pretražujte nekretnine")
        set_frame(text_buyer_desc, x=400, y=470, width=260, height=22)

        # Seller card.
        set_frame(rect_seller, x=750, y=390, width=320, height=230)
        set_text(text_seller_title, "Prodavatelj")
        set_frame(text_seller_title, x=850, y=428, width=120, height=28)
        set_text(text_seller_desc, "Objavite i upravljajte oglasima")
        set_frame(text_seller_desc, x=785, y=470, width=250, height=22)

        # CTA buttons (prototype style using card rectangles).
        buyer_btn = clone_rect(rect_buyer, "buyer-cta", 430, 520, 200, 44)
        seller_btn = clone_rect(rect_seller, "seller-cta", 810, 520, 200, 44)

        buyer_btn_text = clone_text(
            text_buyer_desc,
            "Nastavi kao kupac",
            470,
            533,
            140,
            20,
        )
        seller_btn_text = clone_text(
            text_seller_desc,
            "Nastavi kao prodavatelj",
            835,
            533,
            170,
            20,
        )

        # Flow hint labels.
        buyer_hint = clone_text(
            text_buyer_desc,
            "Tok: početna / pregled nekretnina",
            398,
            578,
            270,
            20,
        )
        seller_hint = clone_text(
            text_seller_desc,
            "Tok: dashboard / novi oglas",
            805,
            578,
            220,
            20,
        )

        # Append new layers near the end so existing layer order remains untouched.
        new_group["layers"].extend(
            [
                subtitle,
                buyer_btn,
                seller_btn,
                buyer_btn_text,
                seller_btn_text,
                buyer_hint,
                seller_hint,
            ]
        )

        page["layers"].append(new_group)
        page_path.write_text(
            json.dumps(page, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

        with ZipFile(SKETCH_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(temp_root).as_posix())

    print(f"Added screen: {NEW_GROUP_NAME}")


if __name__ == "__main__":
    main()
