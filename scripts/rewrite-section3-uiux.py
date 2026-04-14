#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree

INPUT_DOCX = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_screenshots_inserted.docx")
OUTPUT_DOCX = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_screenshots_inserted_uiux.docx")
MAPPING_OUT = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_screenshots_inserted_uiux.mapping.txt")

PROTOTYPE_DIR = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/prototype")
APP_SCREENSHOT_DIR = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/slike/prikaz-softverskog-rjesenja-2026-04-07")

NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main"
NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture"
NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"

NSMAP = {"w": NS_W}
NSMAP_DRAWING = {"a": NS_A, "pic": NS_PIC, "r": NS_R}

# ~6.0in width
MAX_WIDTH_EMU = 5_500_000


def qname(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def get_paragraph_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NSMAP)).strip()


def read_png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as f:
        header = f.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Expected PNG image: {path}")
    w = int.from_bytes(header[16:20], "big")
    h = int.from_bytes(header[20:24], "big")
    return w, h


def make_paragraph(text: str, bold: bool = False, italic: bool = False) -> etree._Element:
    p = etree.Element(qname(NS_W, "p"))
    r = etree.SubElement(p, qname(NS_W, "r"))
    rpr = None
    if bold or italic:
        rpr = etree.SubElement(r, qname(NS_W, "rPr"))
    if bold:
        etree.SubElement(rpr, qname(NS_W, "b"))
    if italic:
        etree.SubElement(rpr, qname(NS_W, "i"))
    t = etree.SubElement(r, qname(NS_W, "t"))
    t.text = text
    return p


def make_centered_paragraph_with_spacing(before: str, after: str) -> etree._Element:
    p = etree.Element(qname(NS_W, "p"))
    ppr = etree.SubElement(p, qname(NS_W, "pPr"))
    jc = etree.SubElement(ppr, qname(NS_W, "jc"))
    jc.set(qname(NS_W, "val"), "center")
    spacing = etree.SubElement(ppr, qname(NS_W, "spacing"))
    spacing.set(qname(NS_W, "before"), before)
    spacing.set(qname(NS_W, "after"), after)
    return p


def make_image_paragraph(rel_id: str, image_name: str, docpr_id: int, cx: int, cy: int) -> etree._Element:
    p = make_centered_paragraph_with_spacing("140", "80")
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
    doc_pr.set("name", f"Section3UIUX{docpr_id}")

    c_nv = etree.SubElement(inline, qname(NS_WP, "cNvGraphicFramePr"))
    locks = etree.SubElement(c_nv, qname(NS_A, "graphicFrameLocks"))
    locks.set("noChangeAspect", "1")

    graphic = etree.SubElement(inline, qname(NS_A, "graphic"), nsmap=NSMAP_DRAWING)
    gdata = etree.SubElement(graphic, qname(NS_A, "graphicData"))
    gdata.set("uri", NS_PIC)

    pic = etree.SubElement(gdata, qname(NS_PIC, "pic"))
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


def make_caption_paragraph(caption: str) -> etree._Element:
    p = make_centered_paragraph_with_spacing("0", "220")
    r = etree.SubElement(p, qname(NS_W, "r"))
    t = etree.SubElement(r, qname(NS_W, "t"))
    t.text = caption
    return p


def next_figure_number(body: etree._Element) -> int:
    numbers: list[int] = []
    for p in body.findall(qname(NS_W, "p")):
        txt = get_paragraph_text(p)
        for m in re.finditer(r"Slika\s+(\d+)", txt):
            numbers.append(int(m.group(1)))
    return max(numbers) + 1 if numbers else 1


def ensure_png_content_type(content_types_path: Path) -> None:
    parser = etree.XMLParser(remove_blank_text=False)
    tree = etree.parse(str(content_types_path), parser)
    root = tree.getroot()
    has_png = any(el.get("Extension") == "png" for el in root.findall(qname(NS_CT, "Default")))
    if not has_png:
        el = etree.SubElement(root, qname(NS_CT, "Default"))
        el.set("Extension", "png")
        el.set("ContentType", "image/png")
        tree.write(str(content_types_path), xml_declaration=True, encoding="UTF-8", standalone=True)


def main() -> None:
    if not INPUT_DOCX.exists():
        raise FileNotFoundError(INPUT_DOCX)

    visual_plan = [
        {
            "feature": "Prototip početnog zaslona",
            "path": PROTOTYPE_DIR / "01_buyer_home.png",
            "caption_text": "Prikaz početnog dizajna korisničkog sučelja izrađenog u alatu Sketch",
            "explanation": "Slika prikazuje ranu definiciju hijerarhije sadržaja i rasporeda ključnih navigacijskih elemenata. Ovakav prikaz omogućio je validaciju informacijske arhitekture prije implementacije u React okruženju.",
            "section": "3.1 Prototip aplikacije",
        },
        {
            "feature": "Prototip pregleda oglasa",
            "path": PROTOTYPE_DIR / "02_buyer_listings.png",
            "caption_text": "Prikaz prototipskog pregleda oglasa i korisničkog toka pretraživanja",
            "explanation": "Na slici je vidljiva struktura pregleda nekretnina s fokusom na tok od pretraživanja do otvaranja pojedinog oglasa. Time je u ranoj fazi smanjena vjerojatnost kasnijih izmjena navigacijskog modela.",
            "section": "3.1 Prototip aplikacije",
        },
        {
            "feature": "Implementirani početni zaslon",
            "path": APP_SCREENSHOT_DIR / "kvadrato_homepage_full.png",
            "caption_text": "Početni zaslon implementirane aplikacije Kvadrato u javnom korisničkom modu",
            "explanation": "Početna stranica omogućuje brzu orijentaciju korisnika kroz istaknute elemente ponude i ulaznu pretragu. Ovakav pristup poboljšava početnu upotrebljivost i smanjuje vrijeme do prve relevantne interakcije.",
            "section": "3.2 UI/UX gotovog produkta",
        },
        {
            "feature": "Autentikacija i odabir uloge",
            "path": APP_SCREENSHOT_DIR / "kvadrato_login_role_selection_full.png",
            "caption_text": "Prikaz autentikacijskog toka s odabirom korisničke uloge",
            "explanation": "Autentikacijski ekran eksplicitno odvaja tok kupca i prodavatelja, čime se osigurava kontekstualno prilagođena funkcionalnost nakon prijave. Takav dizajn smanjuje kognitivno opterećenje i broj pogrešnih navigacijskih odluka.",
            "section": "3.2 UI/UX gotovog produkta",
        },
        {
            "feature": "Pregled oglasa i filtriranje",
            "path": APP_SCREENSHOT_DIR / "kvadrato_map_view.png",
            "caption_text": "Prikaz pregleda oglasa s kartografskim i filtracijskim sučeljem",
            "explanation": "Kombinacija listanja i kartografskog prikaza omogućuje korisniku paralelnu procjenu lokacije i sadržaja oglasa. Filtracijski mehanizam skraćuje put do relevantnih rezultata i povećava učinkovitost pretraživanja.",
            "section": "3.2 UI/UX gotovog produkta",
        },
        {
            "feature": "Detaljni prikaz nekretnine",
            "path": APP_SCREENSHOT_DIR / "kvadrato_listing_detail_full.png",
            "caption_text": "Prikaz detaljnog pregleda nekretnine u implementiranoj aplikaciji",
            "explanation": "Detaljni prikaz integrira tehničke podatke, vizualni sadržaj i akcijske elemente (upit/razgledavanje) u jedinstvenom kontekstu. Time se podržava donošenje informirane odluke bez potrebe za dodatnim prebacivanjem između stranica.",
            "section": "3.2 UI/UX gotovog produkta",
        },
    ]

    for entry in visual_plan:
        if not entry["path"].exists():
            raise FileNotFoundError(entry["path"])

    with tempfile.TemporaryDirectory(prefix="rewrite_s3_") as tmp:
        temp_root = Path(tmp)
        with ZipFile(INPUT_DOCX, "r") as zf:
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
            raise RuntimeError("No body in document.xml")

        paragraphs = body.findall(qname(NS_W, "p"))

        start_p = None
        end_p = None
        for p in paragraphs:
            txt = get_paragraph_text(p)
            if start_p is None and txt == "3. Opis funkcionalnosti prototipa":
                start_p = p
            if txt == "Model baze podataka za tržište nekretnina":
                end_p = p
                break

        if start_p is None:
            raise RuntimeError("Start section heading not found: 3. Opis funkcionalnosti prototipa")
        if end_p is None:
            raise RuntimeError("End marker not found: Model baze podataka za tržište nekretnina")

        start_idx = body.index(start_p)
        end_idx = body.index(end_p)
        if end_idx <= start_idx:
            raise RuntimeError("Invalid section boundaries for replacement")

        # Remove old section 3 content.
        to_remove = [body[i] for i in range(start_idx, end_idx)]
        for el in to_remove:
            body.remove(el)

        rels_tree = etree.parse(str(rels_path), parser)
        rels_root = rels_tree.getroot()
        rel_elements = rels_root.findall(qname(NS_REL, "Relationship"))
        max_rid = 0
        for rel in rel_elements:
            rid = rel.get("Id", "")
            if rid.startswith("rId") and rid[3:].isdigit():
                max_rid = max(max_rid, int(rid[3:]))

        existing_docpr_ids = [
            int(v)
            for v in doc_root.xpath("//wp:docPr/@id", namespaces={"wp": NS_WP})
            if str(v).isdigit()
        ]
        docpr_id = max(existing_docpr_ids) + 1 if existing_docpr_ids else 1

        next_fig = next_figure_number(body)
        mapping_rows = []

        new_nodes: list[etree._Element] = []
        new_nodes.append(make_paragraph("3. Prototip i UI/UX implementacija aplikacije", bold=True))
        new_nodes.append(
            make_paragraph(
                "Ovaj odjeljak sažeto prikazuje prijelaz od dizajnerskog prototipa do završne implementacije aplikacije Kvadrato, s naglaskom na UX odluke koje su potvrđene u produkcijskom sučelju."
            )
        )

        new_nodes.append(make_paragraph("3.1 Prototip aplikacije", bold=True))
        new_nodes.append(
            make_paragraph(
                "Prototip izrađen u datoteci Kvadrato_Prototip.sketch korišten je za validaciju rasporeda elemenata, toka korisničkih radnji i ranih odluka o navigaciji prije kodiranja. Takav pristup smanjio je rizik naknadnih strukturnih izmjena sučelja."
            )
        )

        # 3.1 visuals
        for entry in visual_plan[:2]:
            width_px, height_px = read_png_size(entry["path"])
            cx = MAX_WIDTH_EMU
            cy = max(1, int(MAX_WIDTH_EMU * (height_px / width_px)))

            max_rid += 1
            rel_id = f"rId{max_rid}"
            media_name = f"s3_{entry['path'].name}"
            shutil.copy2(entry["path"], media_dir / media_name)

            rel_el = etree.SubElement(rels_root, qname(NS_REL, "Relationship"))
            rel_el.set("Id", rel_id)
            rel_el.set(
                "Type",
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
            )
            rel_el.set("Target", f"media/{media_name}")

            caption = f"Slika {next_fig}: {entry['caption_text']}"
            new_nodes.append(make_image_paragraph(rel_id, media_name, docpr_id, cx, cy))
            new_nodes.append(make_caption_paragraph(caption))
            new_nodes.append(make_paragraph(entry["explanation"]))
            mapping_rows.append((next_fig, entry["feature"], entry["section"], entry["path"].name))
            docpr_id += 1
            next_fig += 1

        new_nodes.append(make_paragraph("3.2 UI/UX gotovog produkta", bold=True))
        new_nodes.append(
            make_paragraph(
                "Implementirani sustav razvijen je u React okruženju te operacionalizira ključne korisničke tokove: početnu orijentaciju, autentikaciju, pretraživanje s filtriranjem i detaljni pregled nekretnine. U nastavku su prikazani reprezentativni ekrani završnog produkta."
            )
        )

        # 3.2 visuals
        for entry in visual_plan[2:]:
            width_px, height_px = read_png_size(entry["path"])
            cx = MAX_WIDTH_EMU
            cy = max(1, int(MAX_WIDTH_EMU * (height_px / width_px)))

            max_rid += 1
            rel_id = f"rId{max_rid}"
            media_name = f"s3_{entry['path'].name}"
            shutil.copy2(entry["path"], media_dir / media_name)

            rel_el = etree.SubElement(rels_root, qname(NS_REL, "Relationship"))
            rel_el.set("Id", rel_id)
            rel_el.set(
                "Type",
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
            )
            rel_el.set("Target", f"media/{media_name}")

            caption = f"Slika {next_fig}: {entry['caption_text']}"
            new_nodes.append(make_image_paragraph(rel_id, media_name, docpr_id, cx, cy))
            new_nodes.append(make_caption_paragraph(caption))
            new_nodes.append(make_paragraph(entry["explanation"]))
            mapping_rows.append((next_fig, entry["feature"], entry["section"], entry["path"].name))
            docpr_id += 1
            next_fig += 1

        new_nodes.append(make_paragraph("3.3 Usporedba prototipa i implementacije", bold=True))
        new_nodes.append(
            make_paragraph(
                "Prototip i završna implementacija zadržavaju istu temeljnu informacijsku arhitekturu: jasnu početnu točku, centralni pregled oglasa i detaljni prikaz kao ključni konverzijski korak. Time je potvrđena ispravnost ranih UX pretpostavki."
            )
        )
        new_nodes.append(
            make_paragraph(
                "Najvažnije razlike proizlaze iz tehničke operacionalizacije. U implementaciji su uvedeni autentikacijski tokovi po ulogama, dinamičko filtriranje i kartografski prikaz podataka, što u prototipu postoji samo na konceptualnoj razini. Ove nadogradnje povećavaju funkcionalnu dubinu sustava i upotrebljivost u realnim scenarijima."
            )
        )
        new_nodes.append(
            make_paragraph(
                "Također, produkcijska verzija uključuje ograničenja i optimizacije koje prototip ne modelira (sinkronizacija sa stvarnim podacima, validacija korisničkog unosa i kontrola stanja sučelja). Posljedično, finalna aplikacija predstavlja metodološki dosljedan nastavak prototipa, ali s većom robusnošću, performansama i operativnom vrijednošću."
            )
        )

        for offset, node in enumerate(new_nodes):
            body.insert(start_idx + offset, node)

        ensure_png_content_type(content_types_path)
        doc_tree.write(str(doc_xml_path), xml_declaration=True, encoding="UTF-8", standalone=True)
        rels_tree.write(str(rels_path), xml_declaration=True, encoding="UTF-8", standalone=True)

        with ZipFile(OUTPUT_DOCX, "w", compression=ZIP_DEFLATED) as zf:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    zf.write(fp, fp.relative_to(temp_root).as_posix())

    lines = [
        "Section rewrite mapping: 3. Prototip i UI/UX implementacija aplikacije",
        f"Input: {INPUT_DOCX}",
        f"Output: {OUTPUT_DOCX}",
        "",
    ]
    for fig_no, feature, section, filename in mapping_rows:
        lines.append(
            f"Slika {fig_no} | {feature} | {section} | source file: {filename}"
        )
    MAPPING_OUT.write_text("\n".join(lines), encoding="utf-8")

    print(f"Created: {OUTPUT_DOCX}")
    print(f"Mapping: {MAPPING_OUT}")


if __name__ == "__main__":
    main()
