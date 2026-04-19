import collections
import pathlib
import re


def main() -> None:
    root = pathlib.Path("src")
    pattern = re.compile(r"[Γ≡][^\s\"'`]{0,24}")
    counts: collections.Counter[str] = collections.Counter()

    for file_path in root.rglob("*.js"):
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        counts.update(pattern.findall(text))

    for token, count in counts.most_common(200):
        print(f"{token}\t{count}")


if __name__ == "__main__":
    main()
