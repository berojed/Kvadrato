#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import tempfile
from collections import Counter
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from lxml import etree

SKETCH_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Kvadrato_Prototip.sketch")
DOCX_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Section_3_Prototip_UIUX_standalone.docx")

RULES = [
    (r"\bClan\b", "Član"),
    (r"\bclan\b", "član"),
    (r"\bozujka\b", "ožujka"),
    (r"\bOzujka\b", "Ožujka"),
    (r"\bKovacevic\b", "Kovačević"),
    (r"\bkovacevic\b", "kovačević"),
    (r"\bVidovic\b", "Vidović"),
    (r"\bvidovic\b", "vidović"),
    (r"\bGarazno\b", "Garažno"),
    (r"\bgarazno\b", "garažno"),
    (r"\bIstice\b", "Ističe"),
    (r"\bistice\b", "ističe"),
    (r"\bObrisi\b", "Obriši"),
    (r"\bobrisi\b", "obriši"),
    (r"\bOtkazi\b", "Otkaži"),
    (r"\botkazi\b", "otkaži"),
    (r"\bNadolazeca\b", "Nadolazeća"),
    (r"\bnadolazeca\b", "nadolazeća"),
    (r"\bProsnih\b", "Prošlih"),
    (r"\bprosnih\b", "prošlih"),
    (r"\bPredstojeću\b", "Predstojeći"),
    (r"\bTrziste\b", "Tržište"),
    (r"\bstoljece\b", "stoljeće"),
    (r"\bkorisnicki\b", "korisnički"),
    (r"\bPocetna\b", "Početna"),
    (r"\bPretrazi\b", "Pretraži"),
    (r"\bpretrazi\b", "pretraži"),
    (r"\bPronadi\b", "Pronađi"),
    (r"\bpronadi\b", "pronađi"),
    (r"\bVase\b", "Vaše"),
    (r"\bvasih\b", "vaših"),
    (r"\bNiste jos\b", "Niste još"),
    (r"\bDobro dosli\b", "Dobro došli"),
    (r"\bPosalji\b", "Pošalji"),
    (r"\bposalji\b", "pošalji"),
    (r"\bOpisite\b", "Opišite"),
    (r"\bNajveca\b", "Najveća"),
    (r"\bProdavac\b", "Prodavač"),
    (r"\bprodavac\b", "prodavač"),
    (r"\bprodavacu\b", "prodavaču"),
    (r"\bProdavaca\b", "Prodavača"),
    (r"\bprodavaca\b", "prodavača"),
    (r"\bSpavaca\b", "Spavaća"),
    (r"\bspavaca\b", "spavaća"),
    (r"\bKuca\b", "Kuća"),
    (r"\bkuca\b", "kuća"),
    (r"\bKucni\b", "Kućni"),
    (r"\bkucni\b", "kućni"),
    (r"\bPovrsina\b", "Površina"),
    (r"\bpovrsina\b", "površina"),
    (r"\bNamjestaj\b", "Namještaj"),
    (r"\bnamjestaj\b", "namještaj"),
    (r"\bNamjesten\b", "Namješten"),
    (r"\bnamjesten\b", "namješten"),
    (r"\bPostanski\b", "Poštanski"),
    (r"\bpostanski\b", "poštanski"),
    (r"\bZupanija\b", "Županija"),
    (r"\bzupanija\b", "županija"),
    (r"\bsijecnja\b", "siječnja"),
    (r"\bNapisite\b", "Napišite"),
    (r"\bvasu\b", "vašu"),
    (r"\bce\b", "će"),
    (r"\bvise\b", "više"),
    (r"\bcekanju\b", "čekanju"),
    (r"\bpotvrdeno\b", "potvrđeno"),
    (r"\bUcitajte\b", "Učitajte"),
    (r"\bucitajte\b", "učitajte"),
    (r"\bUcitaj\b", "Učitaj"),
    (r"\bucitaj\b", "učitaj"),
    (r"\bSljedece\b", "Sljedeće"),
    (r"\bZakazi\b", "Zakaži"),
    (r"\bzakazi\b", "zakaži"),
    (r"\bUspjesno\b", "Uspješno"),
    (r"\buspjesno\b", "uspješno"),
    (r"\bPotvrdeno\b", "Potvrđeno"),
    (r"\bpotvrdeno\b", "potvrđeno"),
    (r"\bPodrucje\b", "Područje"),
    (r"\bpodrucje\b", "područje"),
    (r"\bProsli\b", "Prošli"),
    (r"\bproshli\b", "prošli"),
    (r"\bProshli\b", "Prošli"),
    (r"\bSto\b", "Što"),
    (r"\bsto\b", "što"),
    (r"\bPredstojecu\b", "Predstojeću"),
    (r"\bpredstojecu\b", "predstojeću"),
    (r"\bPredstojecu pregledi\b", "Predstojeći pregledi"),
    (r"\bPredstojeću pregledi\b", "Predstojeći pregledi"),
    (r"Nema prosnih pregleda\.", "Nema prošlih pregleda."),
    (r"Nema vise prosnih pregleda\.", "Nema više prošlih pregleda."),
    (r"\bkuce\b", "kuće"),
    (r"\bKuce\b", "Kuće"),
]

COMPILED_RULES = [(re.compile(pattern), repl, pattern) for pattern, repl in RULES]


def apply_diacritic_rules(text: str, changes: Counter) -> str:
    value = text
    for regex, repl, key in COMPILED_RULES:
        value, count = regex.subn(repl, value)
        if count:
            changes[f"{regex.pattern} -> {repl}"] += count
    return value


def update_sketch() -> Counter:
    if not SKETCH_PATH.exists():
        raise FileNotFoundError(SKETCH_PATH)
    changes: Counter = Counter()

    with tempfile.TemporaryDirectory(prefix="diacritics_sketch_") as td:
        temp_root = Path(td)
        with ZipFile(SKETCH_PATH, "r") as zf:
            zf.extractall(temp_root)

        for page_path in (temp_root / "pages").glob("*.json"):
            page = json.loads(page_path.read_text(encoding="utf-8"))
            stack = [page]
            while stack:
                node = stack.pop()
                if isinstance(node, dict):
                    if node.get("_class") == "text":
                        attributed = node.get("attributedString") or {}
                        source = attributed.get("string")
                        if isinstance(source, str) and source:
                            updated = apply_diacritic_rules(source, changes)
                            if updated != source:
                                node["attributedString"]["string"] = updated
                                attrs = node["attributedString"].get("attributes") or []
                                for item in attrs:
                                    if isinstance(item, dict):
                                        item["location"] = 0
                                        item["length"] = len(updated)
                                if node.get("name") == source:
                                    node["name"] = updated[:64]
                    for v in node.values():
                        if isinstance(v, (dict, list)):
                            stack.append(v)
                elif isinstance(node, list):
                    stack.extend(node)

            page_path.write_text(
                json.dumps(page, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )

        with ZipFile(SKETCH_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(temp_root).as_posix())

    return changes


def update_docx() -> Counter:
    if not DOCX_PATH.exists():
        raise FileNotFoundError(DOCX_PATH)
    changes: Counter = Counter()

    with tempfile.TemporaryDirectory(prefix="diacritics_docx_") as td:
        temp_root = Path(td)
        with ZipFile(DOCX_PATH, "r") as zf:
            zf.extractall(temp_root)

        doc_xml = temp_root / "word" / "document.xml"
        parser = etree.XMLParser(remove_blank_text=False)
        tree = etree.parse(str(doc_xml), parser)
        root = tree.getroot()
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

        text_nodes = root.xpath("//w:t", namespaces=ns)
        for t in text_nodes:
            if t.text:
                updated = apply_diacritic_rules(t.text, changes)
                if updated != t.text:
                    t.text = updated

        tree.write(str(doc_xml), xml_declaration=True, encoding="UTF-8", standalone=True)

        with ZipFile(DOCX_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(temp_root).as_posix())

    return changes


def main() -> None:
    sketch_changes = update_sketch()
    docx_changes = update_docx()

    print("SKETCH_CHANGES")
    if sketch_changes:
        for k, v in sketch_changes.most_common():
            print(f"{k}: {v}")
    else:
        print("none")

    print("DOCX_CHANGES")
    if docx_changes:
        for k, v in docx_changes.most_common():
            print(f"{k}: {v}")
    else:
        print("none")


if __name__ == "__main__":
    main()
