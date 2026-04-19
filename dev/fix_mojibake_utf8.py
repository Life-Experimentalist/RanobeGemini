import re
from pathlib import Path

import ftfy

ROOTS = [Path("src"), Path("landing"), Path("docs")]
EXTENSIONS = {".js", ".html", ".css", ".md", ".json"}
SKIP_DIRS = {".git", "node_modules", "dist", "releases", "graphify-out"}


def decode_codepoint_escapes(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        codepoint = int(match.group(1), 16)
        if 0 <= codepoint <= 0x10FFFF:
            return chr(codepoint)
        return match.group(0)

    return re.sub(r"\\\\u\{([0-9A-Fa-f]{1,6})\}", repl, text)


def repair_text(text: str) -> str:
    repaired = text.lstrip("\ufeff")
    repaired = decode_codepoint_escapes(repaired)

    for _ in range(4):
        next_text = ftfy.fix_text(repaired)
        if next_text == repaired:
            break
        repaired = next_text

    # Deterministic final pass for tokens that survive generic mojibake repair.
    replacements = {
        "ΓÇö": "—",
        "ΓÇô": "–",
        "ΓÇó": "·",
        "ΓÇª": "…",
        "ΓǪ": "…",
        "Γ£¿": "✨",
        "Γ¥î": "❌",
        "Γ£ô": "✅",
        "Γ₧ò": "➕",
        "Γ¡É": "❤️",
        "ΓÜí": "👁",
        "ΓÖ╗": "🔄",
    }
    for bad, good in replacements.items():
        repaired = repaired.replace(bad, good)

    # Clean repeated corrupted line-art fragments used in comment separators.
    repaired = repaired.replace("ΓöÇ", "─")

    return repaired


def iter_files():
    for root in ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix.lower() in EXTENSIONS:
                yield path


def main() -> None:
    changed = 0
    for file_path in iter_files():
        try:
            original = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            # Skip non-UTF8 files instead of risking destructive rewrites.
            continue

        repaired = repair_text(original)
        if repaired != original:
            file_path.write_text(repaired, encoding="utf-8", newline="")
            print(f"Fixed: {file_path}")
            changed += 1

    print(f"Done. Files fixed: {changed}")


if __name__ == "__main__":
    main()
