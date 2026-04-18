#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree


SRC_DOC = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_strict_formatirano.docx")
OUT_DOC = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_strict_formatirano_skraceno.docx")

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}
W = f"{{{W_NS}}}"

FIG_RE = re.compile(r"^Slika\s+(\d+)\s*:\s*(.+)$")
TAB_RE = re.compile(r"^Tablica\s+(\d+)\s*:\s*(.+)$")
FIG_REF_RE = re.compile(r"\b([Ss]lika)\s+(\d+)\b")
TAB_REF_RE = re.compile(r"\b([Tt]ablica)\s+(\d+)\b")


@dataclass
class CaptionItem:
    paragraph: etree._Element
    old_number: int
    new_number: int
    caption: str
    line: str


def p_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()


def p_style(p: etree._Element) -> str:
    return (p.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS) or [""])[0]


def set_paragraph_text(p: etree._Element, text: str) -> None:
    p_pr = p.find(W + "pPr")
    for ch in list(p):
        if ch.tag != W + "pPr":
            p.remove(ch)
    r = etree.SubElement(p, W + "r")
    t = etree.SubElement(r, W + "t")
    t.text = text
    if p_pr is not None and p.index(p_pr) != 0:
        p.remove(p_pr)
        p.insert(0, p_pr)


def make_paragraph(text: str, style: str | None = None, hyperlink_anchor: str | None = None) -> etree._Element:
    p = etree.Element(W + "p")
    if style:
        p_pr = etree.SubElement(p, W + "pPr")
        p_style = etree.SubElement(p_pr, W + "pStyle")
        p_style.set(W + "val", style)

    if text:
        if hyperlink_anchor:
            h = etree.SubElement(p, W + "hyperlink")
            h.set(W + "anchor", hyperlink_anchor)
            h.set(W + "history", "1")
            r = etree.SubElement(h, W + "r")
            r_pr = etree.SubElement(r, W + "rPr")
            r_style = etree.SubElement(r_pr, W + "rStyle")
            r_style.set(W + "val", "Hyperlink")
            t = etree.SubElement(r, W + "t")
            t.text = text
        else:
            r = etree.SubElement(p, W + "r")
            t = etree.SubElement(r, W + "t")
            t.text = text
    return p


def heading_index(paragraphs: list[etree._Element], style: str, text: str) -> int:
    for i, p in enumerate(paragraphs):
        if p_style(p) == style and p_text(p) == text:
            return i
    raise RuntimeError(f"Heading not found: {style} {text}")


def next_heading1_index(paragraphs: list[etree._Element], start_idx: int) -> int:
    for i in range(start_idx + 1, len(paragraphs)):
        if p_style(paragraphs[i]) == "Heading1":
            return i
    return len(paragraphs)


def next_heading_index(paragraphs: list[etree._Element], start_idx: int, styles: tuple[str, ...]) -> int:
    for i in range(start_idx + 1, len(paragraphs)):
        if p_style(paragraphs[i]) in styles:
            return i
    return len(paragraphs)


def remove_paragraph_range(body: etree._Element, paragraphs: list[etree._Element], start: int, end_exclusive: int) -> list[etree._Element]:
    for p in paragraphs[start:end_exclusive]:
        body.remove(p)
    return body.xpath("./w:p", namespaces=NS)


def replace_section_content(
    body: etree._Element,
    paragraphs: list[etree._Element],
    heading_text: str,
    lines: list[str],
) -> list[etree._Element]:
    h_idx = heading_index(paragraphs, "Heading1", heading_text)
    end_idx = next_heading1_index(paragraphs, h_idx)
    for p in paragraphs[h_idx + 1 : end_idx]:
        body.remove(p)

    insert_pos = body.index(paragraphs[h_idx]) + 1
    nodes = [make_paragraph(line) for line in lines]
    for offset, node in enumerate(nodes):
        body.insert(insert_pos + offset, node)
    return body.xpath("./w:p", namespaces=NS)


def remove_custom_caption_bookmarks(root: etree._Element) -> None:
    starts = root.xpath("//w:bookmarkStart", namespaces=NS)
    for b in starts:
        name = b.get(W + "name") or ""
        if not (name.startswith("slika_") or name.startswith("tablica_")):
            continue
        bid = b.get(W + "id")
        parent = b.getparent()
        if parent is not None:
            parent.remove(b)
        if bid:
            ends = root.xpath(f"//w:bookmarkEnd[@w:id='{bid}']", namespaces=NS)
            for e in ends:
                p = e.getparent()
                if p is not None:
                    p.remove(e)


def next_bookmark_id(root: etree._Element) -> int:
    ids: list[int] = []
    for b in root.xpath("//w:bookmarkStart", namespaces=NS):
        raw = b.get(W + "id")
        if raw and raw.isdigit():
            ids.append(int(raw))
    return (max(ids) + 1) if ids else 1


def insert_bookmark_on_paragraph(p: etree._Element, name: str, bid: int) -> None:
    p_pr = p.find(W + "pPr")
    insert_at = 1 if p_pr is not None else 0
    b_start = etree.Element(W + "bookmarkStart")
    b_start.set(W + "id", str(bid))
    b_start.set(W + "name", name)
    b_end = etree.Element(W + "bookmarkEnd")
    b_end.set(W + "id", str(bid))
    p.insert(insert_at, b_start)
    p.append(b_end)


def main() -> None:
    if not SRC_DOC.exists():
        raise FileNotFoundError(SRC_DOC)

    # Keep original untouched: copy first, mutate copy only.
    shutil.copy2(SRC_DOC, OUT_DOC)

    with tempfile.TemporaryDirectory(prefix="shorten_phase1_") as td:
        temp_root = Path(td)
        with ZipFile(OUT_DOC, "r") as zf:
            zf.extractall(temp_root)

        doc_xml = temp_root / "word" / "document.xml"
        tree = etree.parse(str(doc_xml))
        root = tree.getroot()
        body = root.xpath("//w:body", namespaces=NS)[0]
        paragraphs = body.xpath("./w:p", namespaces=NS)

        removed_sections: list[str] = []
        removed_figures: list[str] = []
        removed_tables: list[str] = []

        # Remove entire section: 7. Testiranje (Heading1 and all until next Heading1).
        idx_test = heading_index(paragraphs, "Heading1", "Testiranje")
        idx_after_test = next_heading1_index(paragraphs, idx_test)
        for p in paragraphs[idx_test:idx_after_test]:
            line = p_text(p)
            mf = FIG_RE.match(line)
            mt = TAB_RE.match(line)
            if mf:
                removed_figures.append(line)
            if mt:
                removed_tables.append(line)
        paragraphs = remove_paragraph_range(body, paragraphs, idx_test, idx_after_test)
        removed_sections.append("7. Testiranje")

        # Remove subsection: 4.2.3 Tokovi podataka i funkcionalnosti
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_tokovi = heading_index(paragraphs, "Heading3", "Tokovi podataka i funkcionalnosti")
        idx_after_tokovi = next_heading_index(paragraphs, idx_tokovi, ("Heading3", "Heading2", "Heading1"))
        for p in paragraphs[idx_tokovi:idx_after_tokovi]:
            line = p_text(p)
            mf = FIG_RE.match(line)
            mt = TAB_RE.match(line)
            if mf:
                removed_figures.append(line)
            if mt:
                removed_tables.append(line)
        paragraphs = remove_paragraph_range(body, paragraphs, idx_tokovi, idx_after_tokovi)
        removed_sections.append("4.2.3 Tokovi podataka i funkcionalnosti")

        # Renumber figure/table captions sequentially.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        figures: list[CaptionItem] = []
        tables: list[CaptionItem] = []

        fig_counter = 0
        tab_counter = 0
        fig_number_map: dict[int, int] = {}
        tab_number_map: dict[int, int] = {}

        for p in paragraphs:
            line = p_text(p)
            mf = FIG_RE.match(line)
            if mf:
                old = int(mf.group(1))
                cap = mf.group(2)
                fig_counter += 1
                new = fig_counter
                set_paragraph_text(p, f"Slika {new}: {cap}")
                figures.append(CaptionItem(p, old, new, cap, f"Slika {new}: {cap}"))
                fig_number_map.setdefault(old, new)
                continue

            mt = TAB_RE.match(line)
            if mt:
                old = int(mt.group(1))
                cap = mt.group(2)
                tab_counter += 1
                new = tab_counter
                set_paragraph_text(p, f"Tablica {new}: {cap}")
                tables.append(CaptionItem(p, old, new, cap, f"Tablica {new}: {cap}"))
                tab_number_map.setdefault(old, new)

        # Fix textual references: Slika X / Tablica X
        paragraphs = body.xpath("./w:p", namespaces=NS)
        for p in paragraphs:
            line = p_text(p)
            if not line:
                continue

            def repl_fig(m: re.Match[str]) -> str:
                word, num = m.group(1), int(m.group(2))
                mapped = fig_number_map.get(num, num)
                return f"{word} {mapped}"

            def repl_tab(m: re.Match[str]) -> str:
                word, num = m.group(1), int(m.group(2))
                mapped = tab_number_map.get(num, num)
                return f"{word} {mapped}"

            updated = FIG_REF_RE.sub(repl_fig, line)
            updated = TAB_REF_RE.sub(repl_tab, updated)
            if updated != line:
                set_paragraph_text(p, updated)

        # Rebuild Popis tablica and Popis slika with hyperlink anchors.
        remove_custom_caption_bookmarks(root)
        bm_id = next_bookmark_id(root)
        table_anchor_by_number: dict[int, str] = {}
        figure_anchor_by_number: dict[int, str] = {}

        for t in tables:
            anchor = f"tablica_{t.new_number}"
            insert_bookmark_on_paragraph(t.paragraph, anchor, bm_id)
            bm_id += 1
            table_anchor_by_number[t.new_number] = anchor

        for f in figures:
            anchor = f"slika_{f.new_number}"
            insert_bookmark_on_paragraph(f.paragraph, anchor, bm_id)
            bm_id += 1
            figure_anchor_by_number[f.new_number] = anchor

        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_popis_tablica = heading_index(paragraphs, "Heading1", "Popis tablica")
        idx_popis_slika = heading_index(paragraphs, "Heading1", "Popis slika")
        idx_popis_priloga = heading_index(paragraphs, "Heading1", "Popis priloga")

        # Replace Popis tablica body.
        for p in paragraphs[idx_popis_tablica + 1 : idx_popis_slika]:
            body.remove(p)
        insert_pos = body.index(paragraphs[idx_popis_tablica]) + 1
        tab_nodes = [
            make_paragraph(
                f"Tablica {t.new_number}. {t.caption}",
                hyperlink_anchor=table_anchor_by_number[t.new_number],
            )
            for t in tables
        ]
        tab_nodes.append(make_paragraph(""))
        for offset, node in enumerate(tab_nodes):
            body.insert(insert_pos + offset, node)

        # Refresh indices for Popis slika and Popis priloga after insertions.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_popis_slika = heading_index(paragraphs, "Heading1", "Popis slika")
        idx_popis_priloga = heading_index(paragraphs, "Heading1", "Popis priloga")

        # Replace Popis slika body.
        for p in paragraphs[idx_popis_slika + 1 : idx_popis_priloga]:
            body.remove(p)
        insert_pos = body.index(paragraphs[idx_popis_slika]) + 1
        fig_nodes = [
            make_paragraph(
                f"Slika {f.new_number}. {f.caption}",
                hyperlink_anchor=figure_anchor_by_number[f.new_number],
            )
            for f in figures
        ]
        fig_nodes.append(make_paragraph(""))
        for offset, node in enumerate(fig_nodes):
            body.insert(insert_pos + offset, node)

        # Save updated XML.
        tree.write(str(doc_xml), xml_declaration=True, encoding="UTF-8", standalone=True)

        with ZipFile(OUT_DOC, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(temp_root).as_posix())

    print("OUTPUT_FILE:", OUT_DOC)
    print("REMOVED_SECTIONS:")
    for s in removed_sections:
        print("-", s)
    print("REMOVED_FIGURES:", len(removed_figures))
    for rf in removed_figures:
        print("  ", rf)
    print("REMOVED_TABLES:", len(removed_tables))
    for rt in removed_tables:
        print("  ", rt)
    print("FINAL_COUNTS:", f"FIGURES={len(figures)}", f"TABLES={len(tables)}")


if __name__ == "__main__":
    main()
