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


FIG_CAPTION_RE = re.compile(r"^Slika\s+(\d+)\s*:\s*(.+)$")
TAB_CAPTION_RE = re.compile(r"^Tablica\s+(\d+)\s*:\s*(.+)$")
FIG_LIST_RE = re.compile(r"^Slika\s+(\d+)\.\s*(.+)$")
TAB_LIST_RE = re.compile(r"^Tablica\s+(\d+)\.\s*(.+)$")


def p_text(p: etree._Element) -> str:
    return "".join(p.xpath(".//w:t/text()", namespaces=NS)).strip()


def build_paragraph(text: str, style: str | None = None) -> etree._Element:
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


def clear_paragraph_content_keep_ppr(p: etree._Element) -> None:
    children = list(p)
    for child in children:
        if child.tag != W + "pPr":
            p.remove(child)


def set_paragraph_hyperlink(p: etree._Element, text: str, anchor: str) -> None:
    clear_paragraph_content_keep_ppr(p)
    hyperlink = etree.SubElement(p, W + "hyperlink")
    hyperlink.set(W + "anchor", anchor)
    hyperlink.set(W + "history", "1")

    r = etree.SubElement(hyperlink, W + "r")
    rPr = etree.SubElement(r, W + "rPr")
    rStyle = etree.SubElement(rPr, W + "rStyle")
    rStyle.set(W + "val", "Hyperlink")
    t = etree.SubElement(r, W + "t")
    t.text = text


def insert_bookmark_in_paragraph(
    p: etree._Element,
    bookmark_name: str,
    bookmark_id: int,
) -> None:
    ppr = p.find(W + "pPr")
    insert_idx = 1 if ppr is not None else 0

    b_start = etree.Element(W + "bookmarkStart")
    b_start.set(W + "id", str(bookmark_id))
    b_start.set(W + "name", bookmark_name)

    b_end = etree.Element(W + "bookmarkEnd")
    b_end.set(W + "id", str(bookmark_id))

    p.insert(insert_idx, b_start)
    p.append(b_end)


def find_heading_index(paragraphs: list[etree._Element], heading_text: str) -> int:
    for i, p in enumerate(paragraphs):
        if p_text(p) == heading_text:
            style = (p.xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS) or [""])[0]
            if style == "Heading1":
                return i
    raise RuntimeError(f"Heading not found: {heading_text}")


def replace_section_body(
    body: etree._Element,
    paragraphs: list[etree._Element],
    start_heading_idx: int,
    end_heading_idx: int,
    lines: list[str],
) -> None:
    # Remove all existing paragraphs between headings.
    to_remove = [paragraphs[i] for i in range(start_heading_idx + 1, end_heading_idx)]
    for p in to_remove:
        body.remove(p)

    # Insert required lines right after start heading.
    heading_elem = paragraphs[start_heading_idx]
    insert_pos = body.index(heading_elem) + 1
    for offset, line in enumerate(lines):
        body.insert(insert_pos + offset, build_paragraph(line))


def main() -> None:
    if not DOC_PATH.exists():
        raise FileNotFoundError(DOC_PATH)

    with tempfile.TemporaryDirectory(prefix="fix_lists_appendices_") as td:
        root_dir = Path(td)
        with ZipFile(DOC_PATH, "r") as zf:
            zf.extractall(root_dir)

        doc_xml = root_dir / "word" / "document.xml"
        tree = etree.parse(str(doc_xml))
        root = tree.getroot()
        body = root.xpath("//w:body", namespaces=NS)[0]
        paragraphs = body.xpath("./w:p", namespaces=NS)

        # Existing bookmark state.
        existing_bookmarks = root.xpath("//w:bookmarkStart", namespaces=NS)
        used_names = {
            b.get(W + "name")
            for b in existing_bookmarks
            if b.get(W + "name")
        }
        used_ids = [
            int(b.get(W + "id"))
            for b in existing_bookmarks
            if (b.get(W + "id") or "").isdigit()
        ]
        next_bm_id = (max(used_ids) + 1) if used_ids else 1

        # Build target anchor map from actual caption paragraphs.
        anchor_for_list_line: dict[str, str] = {}
        fig_count = 0
        tab_count = 0

        for p in paragraphs:
            line = p_text(p)
            m_tab = TAB_CAPTION_RE.match(line)
            if m_tab:
                num, cap = m_tab.group(1), m_tab.group(2)
                tab_count += 1
                anchor = f"tablica_{num}_{tab_count}"
                while anchor in used_names:
                    tab_count += 1
                    anchor = f"tablica_{num}_{tab_count}"
                insert_bookmark_in_paragraph(p, anchor, next_bm_id)
                used_names.add(anchor)
                next_bm_id += 1
                anchor_for_list_line[f"Tablica {num}. {cap}"] = anchor
                continue

            m_fig = FIG_CAPTION_RE.match(line)
            if m_fig:
                num, cap = m_fig.group(1), m_fig.group(2)
                fig_count += 1
                anchor = f"slika_{num}_{fig_count}"
                while anchor in used_names:
                    fig_count += 1
                    anchor = f"slika_{num}_{fig_count}"
                insert_bookmark_in_paragraph(p, anchor, next_bm_id)
                used_names.add(anchor)
                next_bm_id += 1
                anchor_for_list_line[f"Slika {num}. {cap}"] = anchor

        # Refresh paragraph list after bookmark insertion.
        paragraphs = body.xpath("./w:p", namespaces=NS)

        # Section boundaries.
        idx_popis_tablica = find_heading_index(paragraphs, "Popis tablica")
        idx_popis_slika = find_heading_index(paragraphs, "Popis slika")
        idx_popis_priloga = find_heading_index(paragraphs, "Popis priloga")
        idx_prilozi = find_heading_index(paragraphs, "Prilozi")

        # 1) Hyperlinks in Popis tablica.
        tab_links = 0
        for i in range(idx_popis_tablica + 1, idx_popis_slika):
            p = paragraphs[i]
            line = p_text(p)
            m = TAB_LIST_RE.match(line)
            if not m:
                continue
            anchor = anchor_for_list_line.get(line)
            if anchor:
                set_paragraph_hyperlink(p, line, anchor)
                tab_links += 1

        # 2) Hyperlinks in Popis slika.
        fig_links = 0
        for i in range(idx_popis_slika + 1, idx_popis_priloga):
            p = paragraphs[i]
            line = p_text(p)
            m = FIG_LIST_RE.match(line)
            if not m:
                continue
            anchor = anchor_for_list_line.get(line)
            if anchor:
                set_paragraph_hyperlink(p, line, anchor)
                fig_links += 1

        # Refresh paragraphs before replacing section bodies.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_popis_priloga = find_heading_index(paragraphs, "Popis priloga")
        idx_prilozi = find_heading_index(paragraphs, "Prilozi")

        # 3) Complete section 12: Popis priloga.
        replace_section_body(
            body=body,
            paragraphs=paragraphs,
            start_heading_idx=idx_popis_priloga,
            end_heading_idx=idx_prilozi,
            lines=[
                "Prilog 1: Cjelovit programski kôd (GitHub repozitorij)",
                "https://github.com/berojed/Kvadrato",
                "Prilog 2: ...",
                "",
            ],
        )

        # Refresh and complete section 13: Prilozi.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_prilozi = find_heading_index(paragraphs, "Prilozi")
        # find end as next heading1 or sectPr
        end_idx = len(paragraphs)
        for j in range(idx_prilozi + 1, len(paragraphs)):
            style = (paragraphs[j].xpath("./w:pPr/w:pStyle/@w:val", namespaces=NS) or [""])[0]
            if style == "Heading1":
                end_idx = j
                break

        replace_section_body(
            body=body,
            paragraphs=paragraphs,
            start_heading_idx=idx_prilozi,
            end_heading_idx=end_idx,
            lines=[
                "Prilog 1: Cjelovit programski kôd",
                "(Napomena: izvorni kod dostupan je putem GitHub repozitorija navedenog u popisu priloga)",
                "",
            ],
        )

        tree.write(str(doc_xml), xml_declaration=True, encoding="UTF-8", standalone=True)

        with ZipFile(DOC_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in root_dir.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(root_dir).as_posix())

    print(f"TAB_LINKS: {tab_links}")
    print(f"FIG_LINKS: {fig_links}")
    print(f"TOTAL_LINKS: {tab_links + fig_links}")


if __name__ == "__main__":
    main()
