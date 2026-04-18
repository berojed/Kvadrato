#!/usr/bin/env python3
from __future__ import annotations

import re
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree


DOC_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_strict_formatirano.docx")
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}
W = f"{{{W_NS}}}"


def paragraph_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()


def make_paragraph(text: str, style: str | None = None) -> etree._Element:
    p = etree.Element(W + "p")
    if style:
        pPr = etree.SubElement(p, W + "pPr")
        pStyle = etree.SubElement(pPr, W + "pStyle")
        pStyle.set(W + "val", style)
    if text:
        r = etree.SubElement(p, W + "r")
        t = etree.SubElement(r, W + "t")
        t.text = text
    return p


def extract_captions(paragraphs: list[etree._Element]) -> tuple[list[str], list[str]]:
    table_entries: list[str] = []
    figure_entries: list[str] = []

    for p in paragraphs:
        t = paragraph_text(p)

        m_tab = re.match(r"^Tablica\s+(\d+)\s*:\s*(.+)$", t)
        if m_tab:
            number = m_tab.group(1)
            caption = m_tab.group(2)
            table_entries.append(f"Tablica {number}. {caption}")
            continue

        m_fig = re.match(r"^Slika\s+(\d+)\s*:\s*(.+)$", t)
        if m_fig:
            number = m_fig.group(1)
            caption = m_fig.group(2)
            figure_entries.append(f"Slika {number}. {caption}")

    return table_entries, figure_entries


def main() -> None:
    if not DOC_PATH.exists():
        raise FileNotFoundError(DOC_PATH)

    with tempfile.TemporaryDirectory(prefix="append_lists_") as td:
        temp_root = Path(td)
        with ZipFile(DOC_PATH, "r") as zf:
            zf.extractall(temp_root)

        document_xml = temp_root / "word" / "document.xml"
        parser = etree.XMLParser(remove_blank_text=False)
        tree = etree.parse(str(document_xml), parser)
        root = tree.getroot()
        body = root.xpath("//w:body", namespaces=NS)[0]
        paragraphs = body.xpath("./w:p", namespaces=NS)

        tables, figures = extract_captions(paragraphs)

        # Append ONLY at the end of body, before final sectPr.
        sectPr = body.find(W + "sectPr")
        if sectPr is None:
            raise RuntimeError("sectPr not found in document body")
        insert_at = body.index(sectPr)

        new_nodes: list[etree._Element] = []

        # 1) Popis tablica
        new_nodes.append(make_paragraph("Popis tablica", "Heading1"))
        for entry in tables:
            new_nodes.append(make_paragraph(entry))
        new_nodes.append(make_paragraph(""))

        # 2) Popis slika
        new_nodes.append(make_paragraph("Popis slika", "Heading1"))
        for entry in figures:
            new_nodes.append(make_paragraph(entry))
        new_nodes.append(make_paragraph(""))

        # 3) Popis priloga
        new_nodes.append(make_paragraph("Popis priloga", "Heading1"))
        new_nodes.append(make_paragraph("Prilog 1: Cjelovit programski kôd"))
        new_nodes.append(make_paragraph("Prilog 2: ..."))
        new_nodes.append(make_paragraph(""))

        # 4) Prilozi
        new_nodes.append(make_paragraph("Prilozi", "Heading1"))
        new_nodes.append(make_paragraph("Prilog 1: Cjelovit programski kôd"))
        # leave space for additional attachments
        new_nodes.append(make_paragraph(""))
        new_nodes.append(make_paragraph(""))

        for offset, node in enumerate(new_nodes):
            body.insert(insert_at + offset, node)

        tree.write(str(document_xml), xml_declaration=True, encoding="UTF-8", standalone=True)

        with ZipFile(DOC_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(temp_root).as_posix())

    print(f"ADDED_SECTIONS: 4")
    print(f"TABLES_DETECTED: {len(tables)}")
    print(f"FIGURES_DETECTED: {len(figures)}")


if __name__ == "__main__":
    main()
