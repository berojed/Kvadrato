#!/usr/bin/env python3
from __future__ import annotations

import tempfile
from collections import Counter
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


DOC_PATH = Path("/Users/bernard/Desktop/Kvadrato/Dokumentacija/Zavrsni_strict_formatirano.docx")

# Order matters: longest forms first.
REPLACEMENTS = [
    ("Prodavačima", "Prodavateljima"),
    ("prodavačima", "prodavateljima"),
    ("Prodavačem", "Prodavateljem"),
    ("prodavačem", "prodavateljem"),
    ("Prodavaču", "Prodavatelju"),
    ("prodavaču", "prodavatelju"),
    ("Prodavača", "Prodavatelja"),
    ("prodavača", "prodavatelja"),
    ("Prodavači", "Prodavatelji"),
    ("prodavači", "prodavatelji"),
    ("Prodavač", "Prodavatelj"),
    ("prodavač", "prodavatelj"),
]


def main() -> None:
    if not DOC_PATH.exists():
        raise FileNotFoundError(DOC_PATH)

    changes = Counter()

    with tempfile.TemporaryDirectory(prefix="replace_prodavatelj_") as td:
        temp_root = Path(td)
        with ZipFile(DOC_PATH, "r") as zf:
            zf.extractall(temp_root)

        xml_files = [p for p in temp_root.rglob("*.xml")]

        for xml_path in xml_files:
            original = xml_path.read_text(encoding="utf-8")
            updated = original
            for src, dst in REPLACEMENTS:
                updated, count = updated.replace(src, dst), updated.count(src)
                if count:
                    changes[f"{src} -> {dst}"] += count
            if updated != original:
                xml_path.write_text(updated, encoding="utf-8")

        with ZipFile(DOC_PATH, "w", compression=ZIP_DEFLATED) as out_zip:
            for fp in temp_root.rglob("*"):
                if fp.is_file():
                    out_zip.write(fp, fp.relative_to(temp_root).as_posix())

    total = sum(changes.values())
    print(f"TOTAL_CHANGES: {total}")
    if not changes:
        print("NO_CHANGES")
    else:
        for k, v in changes.most_common():
            print(f"{k}: {v}")


if __name__ == "__main__":
    main()
