"""Re-encode public comic art to display-sized WebP and generate responsive variants.

Originals are copied to vibe_images/pre-optimize-20261023 before any in-place rewrite;
the script reads from that backup when present, so re-running is lossless and idempotent.
"""
from __future__ import annotations

import pathlib
import re
import shutil
from PIL import Image

ROOT = pathlib.Path("public/images")
BACKUP = pathlib.Path("vibe_images/pre-optimize-20261023/images")
VARIANT_RE = re.compile(r"-\d+\.webp$")

PLANS = [
    # folder, prefix filter, max width, quality, [(suffix width, quality)]
    (ROOT, "scene-", 1200, 80, [(960, 79), (720, 78)]),
    (ROOT, "identity-", 800, 80, [(640, 78), (320, 76)]),
    (ROOT / "endings", "", 1200, 80, [(800, 78)]),
    (ROOT / "choices", "", 1000, 80, [(800, 78)]),
]

def source_path(path: pathlib.Path) -> pathlib.Path:
    rel = path.relative_to(ROOT)
    backed = BACKUP / rel
    return backed if backed.exists() else path

def backup(path: pathlib.Path) -> None:
    rel = path.relative_to(ROOT)
    target = BACKUP / rel
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)

def encode(im: Image.Image, path: pathlib.Path, quality: int) -> int:
    tmp = path.with_name(path.stem + ".tmp.webp")
    im.save(tmp, "WEBP", quality=quality, method=6)
    size = tmp.stat().st_size
    tmp.replace(path)
    return size

def resize(im: Image.Image, width: int) -> Image.Image:
    if im.width <= width:
        return im
    height = round(im.height * width / im.width)
    return im.resize((width, height), Image.Resampling.LANCZOS)

def run() -> None:
    before = after = 0
    written = 0
    for folder, prefix, width, quality, variants in PLANS:
        for path in sorted(folder.glob(f"{prefix}*.webp")):
            if VARIANT_RE.search(path.name):
                continue
            if folder.name == "choices" and path.parent.name == "thumbs":
                continue
            backup(path)
            src = source_path(path)
            with Image.open(src) as raw:
                im = raw.convert("RGB")
                full = resize(im, width)
                before += path.stat().st_size
                after += encode(full, path, quality)
                written += 1
                for small_width, small_quality in variants:
                    small = resize(im, small_width)
                    target = path.with_name(f"{path.stem}-{small_width}.webp")
                    after += encode(small, target, small_quality)
    # Choice thumbnails render at 48-54px; 200px covers high-density screens.
    thumbs = sorted((ROOT / "choices" / "thumbs").glob("*.webp"))
    for path in thumbs:
        backup(path)
        with Image.open(source_path(path)) as raw:
            im = raw.convert("RGB")
            before += path.stat().st_size
            after += encode(resize(im, 200), path, 80)
            written += 1
    print(f"files={written} originals_before={before/1048576:.2f}MB after_full+variants={after/1048576:.2f}MB")

if __name__ == "__main__":
    run()
