#!/usr/bin/env python3
from __future__ import annotations

import re
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree


DOC_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_strict_formatirano_skraceno.docx")
W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W_NS}
W = f"{{{W_NS}}}"

FIG_CAP_RE = re.compile(r"^Slika\s+(\d+)\s*:\s*(.+)$")
TAB_CAP_RE = re.compile(r"^Tablica\s+(\d+)\s*:\s*(.+)$")
FIG_REF_RE = re.compile(r"\b([Ss]lika)\s+(\d+)\b")
TAB_REF_RE = re.compile(r"\b([Tt]ablica)\s+(\d+)\b")


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


def heading_index(paragraphs: list[etree._Element], text: str) -> int:
    for i, p in enumerate(paragraphs):
        if p_style(p) == "Heading1" and p_text(p) == text:
            return i
    raise RuntimeError(f"Heading not found: {text}")


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
            for e in root.xpath(f"//w:bookmarkEnd[@w:id='{bid}']", namespaces=NS):
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


def add_bookmark_to_paragraph(p: etree._Element, name: str, bid: int) -> None:
    p_pr = p.find(W + "pPr")
    insert_at = 1 if p_pr is not None else 0
    bs = etree.Element(W + "bookmarkStart")
    bs.set(W + "id", str(bid))
    bs.set(W + "name", name)
    be = etree.Element(W + "bookmarkEnd")
    be.set(W + "id", str(bid))
    p.insert(insert_at, bs)
    p.append(be)


def page_number_for_paragraph(p: etree._Element) -> int:
    # Approximate rendered page from lastRenderedPageBreak markers saved by Word.
    br_count = int(p.xpath("count(preceding::w:lastRenderedPageBreak)", namespaces=NS))
    return br_count + 1


def main() -> None:
    if not DOC_PATH.exists():
        raise FileNotFoundError(DOC_PATH)

    with tempfile.TemporaryDirectory(prefix="repair_shortened_") as td:
        root_dir = Path(td)
        with ZipFile(DOC_PATH, "r") as zf:
            zf.extractall(root_dir)

        doc_xml = root_dir / "word" / "document.xml"
        tree = etree.parse(str(doc_xml))
        root = tree.getroot()
        body = root.xpath("//w:body", namespaces=NS)[0]
        paragraphs = body.xpath("./w:p", namespaces=NS)

        # Identify list sections first.
        idx_popis_tablica = heading_index(paragraphs, "Popis tablica")
        idx_popis_slika = heading_index(paragraphs, "Popis slika")
        idx_popis_priloga = heading_index(paragraphs, "Popis priloga")

        # Renumber captions sequentially.
        fig_map: dict[int, int] = {}
        tab_map: dict[int, int] = {}
        figure_items: list[tuple[int, str, etree._Element]] = []
        table_items: list[tuple[int, str, etree._Element]] = []
        caption_paragraph_ids: set[int] = set()

        fig_num = 0
        tab_num = 0
        for p in paragraphs:
            line = p_text(p)
            mf = FIG_CAP_RE.match(line)
            if mf:
                old = int(mf.group(1))
                cap = mf.group(2)
                fig_num += 1
                set_paragraph_text(p, f"Slika {fig_num}: {cap}")
                fig_map.setdefault(old, fig_num)
                figure_items.append((fig_num, cap, p))
                caption_paragraph_ids.add(id(p))
                continue

            mt = TAB_CAP_RE.match(line)
            if mt:
                old = int(mt.group(1))
                cap = mt.group(2)
                tab_num += 1
                set_paragraph_text(p, f"Tablica {tab_num}: {cap}")
                tab_map.setdefault(old, tab_num)
                table_items.append((tab_num, cap, p))
                caption_paragraph_ids.add(id(p))

        # Update text references, excluding caption paragraphs and list sections.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_popis_tablica = heading_index(paragraphs, "Popis tablica")
        idx_popis_slika = heading_index(paragraphs, "Popis slika")
        idx_popis_priloga = heading_index(paragraphs, "Popis priloga")

        def in_lists(i: int) -> bool:
            return (idx_popis_tablica <= i < idx_popis_priloga)

        for i, p in enumerate(paragraphs):
            if id(p) in caption_paragraph_ids:
                continue
            if in_lists(i):
                continue
            line = p_text(p)
            if not line:
                continue

            def repl_fig(m: re.Match[str]) -> str:
                w, n = m.group(1), int(m.group(2))
                return f"{w} {fig_map.get(n, n)}"

            def repl_tab(m: re.Match[str]) -> str:
                w, n = m.group(1), int(m.group(2))
                return f"{w} {tab_map.get(n, n)}"

            updated = FIG_REF_RE.sub(repl_fig, line)
            updated = TAB_REF_RE.sub(repl_tab, updated)
            if updated != line:
                set_paragraph_text(p, updated)

        # Rebuild caption bookmarks.
        remove_custom_caption_bookmarks(root)
        bm_id = next_bookmark_id(root)
        fig_anchor: dict[int, str] = {}
        tab_anchor: dict[int, str] = {}

        for n, _, p in table_items:
            name = f"tablica_{n}"
            add_bookmark_to_paragraph(p, name, bm_id)
            bm_id += 1
            tab_anchor[n] = name

        for n, _, p in figure_items:
            name = f"slika_{n}"
            add_bookmark_to_paragraph(p, name, bm_id)
            bm_id += 1
            fig_anchor[n] = name

        # Rebuild Popis tablica content.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_popis_tablica = heading_index(paragraphs, "Popis tablica")
        idx_popis_slika = heading_index(paragraphs, "Popis slika")
        for p in paragraphs[idx_popis_tablica + 1 : idx_popis_slika]:
            body.remove(p)

        insert_pos = body.index(paragraphs[idx_popis_tablica]) + 1
        tab_nodes = [
            make_paragraph(f"Tablica {n}. {cap}", hyperlink_anchor=tab_anchor[n])
            for n, cap, _ in table_items
        ]
        tab_nodes.append(make_paragraph(""))
        for off, node in enumerate(tab_nodes):
            body.insert(insert_pos + off, node)

        # Rebuild Popis slika content.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_popis_slika = heading_index(paragraphs, "Popis slika")
        idx_popis_priloga = heading_index(paragraphs, "Popis priloga")
        for p in paragraphs[idx_popis_slika + 1 : idx_popis_priloga]:
            body.remove(p)

        insert_pos = body.index(paragraphs[idx_popis_slika]) + 1
        fig_nodes = [
            make_paragraph(f"Slika {n}. {cap}", hyperlink_anchor=fig_anchor[n])
            for n, cap, _ in figure_items
        ]
        fig_nodes.append(make_paragraph(""))
        for off, node in enumerate(fig_nodes):
            body.insert(insert_pos + off, node)

        # Rebuild TOC text block (TOC1/2/3 paragraphs between "Sadržaj" and next Heading1).
        paragraphs = body.xpath("./w:p", namespaces=NS)
        idx_sadrzaj = heading_index(paragraphs, "Sadržaj")
        idx_prvi_h1_nakon_sadrzaja = None
        for i in range(idx_sadrzaj + 1, len(paragraphs)):
            if p_style(paragraphs[i]) == "Heading1":
                idx_prvi_h1_nakon_sadrzaja = i
                break
        if idx_prvi_h1_nakon_sadrzaja is None:
            raise RuntimeError("Cannot locate first heading after Sadržaj")

        # Remove old TOC paragraph block.
        for p in paragraphs[idx_sadrzaj + 1 : idx_prvi_h1_nakon_sadrzaja]:
            body.remove(p)

        # Compose new TOC rows from current headings.
        paragraphs = body.xpath("./w:p", namespaces=NS)
        toc_rows: list[tuple[str, str]] = []
        sec = 0
        sub = 0
        subsub = 0

        # Sadržaj entry
        page_sadrzaj = page_number_for_paragraph(paragraphs[idx_sadrzaj])
        toc_rows.append(("TOC1", f"Sadržaj{page_sadrzaj}"))

        started = False
        for p in paragraphs:
            s = p_style(p)
            t = p_text(p)
            if s not in ("Heading1", "Heading2", "Heading3"):
                continue
            if t == "Sadržaj" and s == "Heading1":
                started = True
                continue
            if not started:
                continue

            page = page_number_for_paragraph(p)
            if s == "Heading1":
                sec += 1
                sub = 0
                subsub = 0
                toc_rows.append(("TOC1", f"{sec}.{t}{page}"))
            elif s == "Heading2":
                sub += 1
                subsub = 0
                toc_rows.append(("TOC2", f"{sec}.{sub}.{t}{page}"))
            elif s == "Heading3":
                subsub += 1
                toc_rows.append(("TOC3", f"{sec}.{sub}.{subsub}.{t}{page}"))

        insert_pos = body.index(paragraphs[idx_sadrzaj]) + 1
        toc_nodes = [make_paragraph(text=row_text, style=row_style) for row_style, row_text in toc_rows]
        for off, node in enumerate(toc_nodes):
            body.insert(insert_pos + off, node)

        tree.write(str(doc_xml), xml_declaration=True, encoding="UTF-8", standalone=True)
        with ZipFile(DOC_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in root_dir.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(root_dir).as_posix())

    print("REPAIRED")


if __name__ == "__main__":
    main()
