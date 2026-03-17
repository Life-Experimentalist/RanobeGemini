"""Fix garbled emoji in library-settings.html."""

path = r"v:\Code\ProjectCode\RanobesGemini\src\library\library-settings.html"
with open(path, "r", encoding="utf-8") as file_handle:
    content = file_handle.read()

replacements = [
    ("\u00f0\u0178\x8d\u201a", "\U0001f342"),
    ("\u00e2\x9d\u201e\u00ef\u00b8\x8f", "\u2744\ufe0f"),
    ("\u00f0\u0178\u0152\u0160", "\U0001f30a"),
    ("\u00f0\u0178\x8d\u0192", "\U0001f343"),
]

replaced = 0
for old, new in replacements:
    count = content.count(old)
    if count:
        content = content.replace(old, new)
        print(f"Replaced {count}x: {repr(old[:6])} -> {new}")
        replaced += count
    else:
        print(f"NOT FOUND: {repr(old[:6])}")

if replaced:
    with open(path, "w", encoding="utf-8") as file_handle:
        file_handle.write(content)
    print(f"\nWritten {replaced} replacements back to file")
else:
    print("No changes needed")
