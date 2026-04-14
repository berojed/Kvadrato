#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree

DOCX_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni.docx")
OUTPUT_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_screenshots_inserted.docx")
SCREENSHOT_DIR = Path(
    "/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/proof-softversko-rjesenje-2026-04-07"
)

NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"

NSMAP_DRAWING = {"a": NS_A, "pic": NS_PIC, "r": NS_R}
NSMAP = {"w": NS_W}

# Keep figure width consistent across all inserted images.
MAX_WIDTH_EMU = 5_600_000  # ~6.12 in
SPACING_BEFORE = "120"
SPACING_AFTER_IMAGE = "80"
SPACING_AFTER_CAPTION = "220"

PLACEMENTS = [
    {
        "pattern": "u protivnom se dodaje na kraj",
        "image": "kvadrato_proof_3d_room_configuration.png",
        "caption": "Prikaz konfiguracije 3D modela prostorija u aplikaciji Kvadrato",
        "section": "2.4. Upravljanje konfiguracijom prostorija",
    },
    {
        "pattern": "emitira novu poziciju putem onDragEnd",
        "image": "kvadrato_proof_cartographic_picker.png",
        "caption": "Prikaz kartografskog odabira lokacije nekretnine",
        "section": "2.5. Kartografski prikaz",
    },
    {
        "pattern": "izbjegava dvostruko čitanje localStorage-a",
        "image": "kvadrato_proof_ui_preferences.png",
        "caption": "Prikaz primjene korisničkih sučeljnih preferencija iz lokalne pohrane",
        "section": "2.6. Upravljanje globalnim stanjem aplikacije",
    },
    {
        "pattern": "prikaz jednog od tri vizualna stanja",
        "image": "kvadrato_proof_message_edge_function.png",
        "caption": "Prikaz slanja poruka putem Edge Function mehanizma",
        "section": "2.7. Komunikacija: poruke i zahtjevi za razgledavanje",
    },
    {
        "pattern": "kod prikazuje korisniku razumljivu poruku",
        "image": "kvadrato_proof_visit_request_flow.png",
        "caption": "Prikaz tijeka podnošenja zahtjeva za razgledavanje nekretnine",
        "section": "2.7. Komunikacija: poruke i zahtjevi za razgledavanje",
    },
]


def qname(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def paragraph_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NSMAP)).strip()


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as f:
        header = f.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a valid PNG file: {path}")
    width = int.from_bytes(header[16:20], "big")
    height = int.from_bytes(header[20:24], "big")
    return width, height


def make_centered_p(spacing_before: str = "0", spacing_after: str = "0") -> etree._Element:
    p = etree.Element(qname(NS_W, "p"))
    p_pr = etree.SubElement(p, qname(NS_W, "pPr"))
    jc = etree.SubElement(p_pr, qname(NS_W, "jc"))
    jc.set(qname(NS_W, "val"), "center")
    spacing = etree.SubElement(p_pr, qname(NS_W, "spacing"))
    spacing.set(qname(NS_W, "before"), spacing_before)
    spacing.set(qname(NS_W, "after"), spacing_after)
    return p


def make_image_paragraph(rel_id: str, image_name: str, docpr_id: int, cx: int, cy: int) -> etree._Element:
    p = make_centered_p(SPACING_BEFORE, SPACING_AFTER_IMAGE)
    r = etree.SubElement(p, qname(NS_W, "r"))
    drawing = etree.SubElement(r, qname(NS_W, "drawing"))

    inline = etree.SubElement(drawing, qname(NS_WP, "inline"))
    inline.set("distT", "0")
    inline.set("distB", "0")
    inline.set("distL", "0")
    inline.set("distR", "0")

    extent = etree.SubElement(inline, qname(NS_WP, "extent"))
    extent.set("cx", str(cx))
    extent.set("cy", str(cy))

    effect_extent = etree.SubElement(inline, qname(NS_WP, "effectExtent"))
    effect_extent.set("l", "0")
    effect_extent.set("t", "0")
    effect_extent.set("r", "0")
    effect_extent.set("b", "0")

    doc_pr = etree.SubElement(inline, qname(NS_WP, "docPr"))
    doc_pr.set("id", str(docpr_id))
    doc_pr.set("name", f"Proof {docpr_id}")

    c_nv = etree.SubElement(inline, qname(NS_WP, "cNvGraphicFramePr"))
    locks = etree.SubElement(c_nv, qname(NS_A, "graphicFrameLocks"))
    locks.set("noChangeAspect", "1")

    graphic = etree.SubElement(inline, qname(NS_A, "graphic"), nsmap=NSMAP_DRAWING)
    graphic_data = etree.SubElement(graphic, qname(NS_A, "graphicData"))
    graphic_data.set("uri", NS_PIC)

    pic = etree.SubElement(graphic_data, qname(NS_PIC, "pic"))
    nv_pic_pr = etree.SubElement(pic, qname(NS_PIC, "nvPicPr"))
    c_nv_pr = etree.SubElement(nv_pic_pr, qname(NS_PIC, "cNvPr"))
    c_nv_pr.set("id", "0")
    c_nv_pr.set("name", image_name)
    etree.SubElement(nv_pic_pr, qname(NS_PIC, "cNvPicPr"))

    blip_fill = etree.SubElement(pic, qname(NS_PIC, "blipFill"))
    blip = etree.SubElement(blip_fill, qname(NS_A, "blip"))
    blip.set(qname(NS_R, "embed"), rel_id)
    stretch = etree.SubElement(blip_fill, qname(NS_A, "stretch"))
    etree.SubElement(stretch, qname(NS_A, "fillRect"))

    sp_pr = etree.SubElement(pic, qname(NS_PIC, "spPr"))
    xfrm = etree.SubElement(sp_pr, qname(NS_A, "xfrm"))
    off = etree.SubElement(xfrm, qname(NS_A, "off"))
    off.set("x", "0")
    off.set("y", "0")
    ext = etree.SubElement(xfrm, qname(NS_A, "ext"))
    ext.set("cx", str(cx))
    ext.set("cy", str(cy))
    prst_geom = etree.SubElement(sp_pr, qname(NS_A, "prstGeom"))
    prst_geom.set("prst", "rect")
    etree.SubElement(prst_geom, qname(NS_A, "avLst"))

    return p


def make_caption_paragraph(text: str) -> etree._Element:
    p = make_centered_p("0", SPACING_AFTER_CAPTION)
    r = etree.SubElement(p, qname(NS_W, "r"))
    t = etree.SubElement(r, qname(NS_W, "t"))
    t.text = text
    return p


def next_figure_number(body_paragraphs: list[etree._Element]) -> int:
    numbers: list[int] = []
    for p in body_paragraphs:
        text = paragraph_text(p)
        for match in re.finditer(r"Slika\s+(\d+)", text):
            numbers.append(int(match.group(1)))
    return max(numbers) + 1 if numbers else 1


def main() -> None:
    if not DOCX_PATH.exists():
        raise FileNotFoundError(f"Document not found: {DOCX_PATH}")

    for item in PLACEMENTS:
        image_path = SCREENSHOT_DIR / item["image"]
        if not image_path.exists():
            raise FileNotFoundError(f"Screenshot not found: {image_path}")

    with tempfile.TemporaryDirectory(prefix="docx_insert_") as tmp:
        temp_root = Path(tmp)
        with ZipFile(DOCX_PATH, "r") as zf:
            zf.extractall(temp_root)

        doc_xml_path = temp_root / "word" / "document.xml"
        rels_path = temp_root / "word" / "_rels" / "document.xml.rels"
        content_types_path = temp_root / "[Content_Types].xml"
        media_dir = temp_root / "word" / "media"
        media_dir.mkdir(parents=True, exist_ok=True)

        parser = etree.XMLParser(remove_blank_text=False)
        doc_tree = etree.parse(str(doc_xml_path), parser)
        doc_root = doc_tree.getroot()
        body = doc_root.find(qname(NS_W, "body"))
        if body is None:
            raise RuntimeError("word/document.xml has no <w:body> element")

        paragraphs = [el for el in body if el.tag == qname(NS_W, "p")]
        figure_num = next_figure_number(paragraphs)

        rels_tree = etree.parse(str(rels_path), parser)
        rels_root = rels_tree.getroot()
        rel_elements = rels_root.findall(qname(NS_REL, "Relationship"))
        max_rid = 0
        for rel in rel_elements:
            rid = rel.get("Id", "")
            if rid.startswith("rId") and rid[3:].isdigit():
                max_rid = max(max_rid, int(rid[3:]))

        # Keep docPr ids unique for inserted drawings.
        existing_docpr_ids = [
            int(v)
            for v in doc_root.xpath("//wp:docPr/@id", namespaces={"wp": NS_WP})
            if str(v).isdigit()
        ]
        docpr_id = max(existing_docpr_ids) + 1 if existing_docpr_ids else 1

        # Find anchors first.
        anchor_map: list[dict] = []
        for item in PLACEMENTS:
            anchor = None
            for p in paragraphs:
                if item["pattern"] in paragraph_text(p):
                    anchor = p
                    break
            if anchor is None:
                raise RuntimeError(f"Anchor not found for pattern: {item['pattern']}")
            anchor_map.append({"anchor": anchor, **item})

        # Assign figure numbers in natural document order.
        anchor_map.sort(key=lambda x: body.index(x["anchor"]))
        figure_by_pattern: dict[str, int] = {}
        next_figure = figure_num
        for entry in anchor_map:
            figure_by_pattern[entry["pattern"]] = next_figure
            next_figure += 1

        # Insert in reverse body order to preserve target positions while
        # keeping numbering tied to natural reading order.
        anchor_map.sort(key=lambda x: body.index(x["anchor"]), reverse=True)

        insertion_results = []
        for entry in anchor_map:
            image_path = SCREENSHOT_DIR / entry["image"]
            width_px, height_px = read_png_size(image_path)
            ratio = height_px / width_px
            cx = MAX_WIDTH_EMU
            cy = max(1, int(MAX_WIDTH_EMU * ratio))

            max_rid += 1
            rel_id = f"rId{max_rid}"
            media_name = f"proof_{entry['image']}"
            target_media_path = media_dir / media_name
            shutil.copy2(image_path, target_media_path)

            rel_el = etree.SubElement(rels_root, qname(NS_REL, "Relationship"))
            rel_el.set("Id", rel_id)
            rel_el.set(
                "Type",
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
            )
            rel_el.set("Target", f"media/{media_name}")

            image_p = make_image_paragraph(rel_id, media_name, docpr_id, cx, cy)
            docpr_id += 1
            assigned_figure = figure_by_pattern[entry["pattern"]]
            caption_text = f"Slika {assigned_figure}: {entry['caption']}"
            caption_p = make_caption_paragraph(caption_text)

            anchor = entry["anchor"]
            insert_pos = body.index(anchor) + 1
            body.insert(insert_pos, image_p)
            body.insert(insert_pos + 1, caption_p)

            insertion_results.append(
                {
                    "figure": assigned_figure,
                    "image": entry["image"],
                    "caption": caption_text,
                    "section": entry["section"],
                    "anchor_pattern": entry["pattern"],
                }
            )

        # Ensure png is registered in content types.
        ct_tree = etree.parse(str(content_types_path), parser)
        ct_root = ct_tree.getroot()
        png_default_exists = any(
            el.get("Extension") == "png" for el in ct_root.findall(qname(NS_CT, "Default"))
        )
        if not png_default_exists:
            default_el = etree.SubElement(ct_root, qname(NS_CT, "Default"))
            default_el.set("Extension", "png")
            default_el.set("ContentType", "image/png")
            ct_tree.write(
                str(content_types_path),
                xml_declaration=True,
                encoding="UTF-8",
                standalone=True,
            )

        doc_tree.write(str(doc_xml_path), xml_declaration=True, encoding="UTF-8", standalone=True)
        rels_tree.write(str(rels_path), xml_declaration=True, encoding="UTF-8", standalone=True)

        with ZipFile(OUTPUT_PATH, "w", compression=ZIP_DEFLATED) as zf:
            for file_path in temp_root.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_root).as_posix()
                    zf.write(file_path, arcname)

        mapping_out = OUTPUT_PATH.with_suffix(".screenshot-mapping.txt")
        lines = [
            "Umetanje screenshots u Zavrsni_screenshots_inserted.docx",
            "",
        ]
        for row in sorted(insertion_results, key=lambda x: x["figure"]):
            lines.append(
                f"Slika {row['figure']} | {row['image']} | sekcija: {row['section']} | anchor: {row['anchor_pattern']}"
            )
        mapping_out.write_text("\n".join(lines), encoding="utf-8")

        print(f"Created: {OUTPUT_PATH}")
        print(f"Mapping: {mapping_out}")


if __name__ == "__main__":
    main()
