"""Package the self-contained media page, vectors, PNGs and source files."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1] / "easy1staking/public/brand"
archive = root / "easy1staking-brand-kit.zip"
files = sorted(p for p in root.rglob("*") if p.is_file() and p != archive)
with ZipFile(archive, "w", ZIP_DEFLATED) as kit:
    for item in files:
        kit.write(item, Path("easy1staking-brand-kit") / item.relative_to(root))
with ZipFile(archive) as kit:
    assert kit.testzip() is None, "Invalid ZIP entry"
print(f"Packaged {len(files)} files; {archive.stat().st_size:,} bytes.")
