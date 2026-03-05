"""Fix garbled emoji in library-settings.html."""
path = r"v:\Code\ProjectCode\RanobesGemini\src\library\library-settings.html"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Garbled sequences: UTF-8 emoji bytes misread as cp1252, then re-encoded as UTF-8
replacements = [
    ("\u00f0\u0178\x8d\u201a", "\U0001F342"),           # falling-leaves 🍂
    ("\u00e2\x9d\u201e\u00ef\u00b8\x8f", "\u2744\ufe0f"),  # snow ❄️
    ("\u00f0\u0178\u0152\u0160", "\U0001F30A"),          # waves 🌊
    ("\u00f0\u0178\x8d\u0192", "\U0001F343"),            # leaves-forest 🍃
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
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"\nWritten {replaced} replacements back to file")
else:
    print("No changes needed")
