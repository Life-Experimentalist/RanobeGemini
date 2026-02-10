/**
 * Fix mojibake emojis in popup.html
 * Run with: node dev/fix-emoji.js
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "popup", "popup.html");
const buf = fs.readFileSync(filePath);
const t = buf.toString("utf8");

// Step 1: Detailed diagnosis - dump all non-ASCII characters with their byte positions
const report = [];
for (let byteOff = 0; byteOff < buf.length; byteOff++) {
	if (buf[byteOff] > 0x7f) {
		// Check what UTF-8 sequence this is
		const b = buf[byteOff];
		let seqLen = 1;
		if (b >= 0xf0) seqLen = 4;
		else if (b >= 0xe0) seqLen = 3;
		else if (b >= 0xc0) seqLen = 2;

		const seqBytes = Array.from(buf.slice(byteOff, byteOff + seqLen));
		const hex = seqBytes
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		const decoded = Buffer.from(seqBytes).toString("utf8");
		const cp = decoded.codePointAt(0);

		// Get surrounding context
		const ctxStart = Math.max(0, byteOff - 10);
		const ctxEnd = Math.min(buf.length, byteOff + seqLen + 20);
		const ctx = buf
			.slice(ctxStart, ctxEnd)
			.toString("utf8")
			.replace(/\n/g, "\\n")
			.substring(0, 40);

		report.push(
			`@${byteOff} [${hex}] U+${cp.toString(16).padStart(4, "0")} '${decoded}' ctx: ...${ctx}...`,
		);
		byteOff += seqLen - 1; // skip rest of sequence
	}
}

fs.writeFileSync(
	path.join(__dirname, "emoji-report.txt"),
	report.join("\n"),
	"utf8",
);
console.log(
	"Wrote " + report.length + " non-ASCII entries to dev/emoji-report.txt",
);

// ========== FIX ==========
// The corruption: UTF-8 bytes were read as CP1252 then re-encoded as UTF-8
// Some bytes in 0x80-0x9F range may have been mapped via CP1252 OR via Latin-1
// We need to handle BOTH cases

// Unicode → CP1252 byte value reverse map (for 0x80-0x9F CP1252 specials)
const cp1252reverse = new Map([
	[0x20ac, 0x80],
	[0x201a, 0x82],
	[0x0192, 0x83],
	[0x201e, 0x84],
	[0x2026, 0x85],
	[0x2020, 0x86],
	[0x2021, 0x87],
	[0x02c6, 0x88],
	[0x2030, 0x89],
	[0x0160, 0x8a],
	[0x2039, 0x8b],
	[0x0152, 0x8c],
	[0x017d, 0x8e],
	[0x2018, 0x91],
	[0x2019, 0x92],
	[0x201c, 0x93],
	[0x201d, 0x94],
	[0x2022, 0x95],
	[0x2013, 0x96],
	[0x2014, 0x97],
	[0x02dc, 0x98],
	[0x2122, 0x99],
	[0x0161, 0x9a],
	[0x203a, 0x9b],
	[0x0153, 0x9c],
	[0x017e, 0x9e],
	[0x0178, 0x9f],
]);

function charToByte(ch) {
	const cp = ch.codePointAt(0);
	if (cp <= 0xff) return cp; // Covers 0x00-0xFF (Latin-1 range including C1 controls)
	if (cp1252reverse.has(cp)) return cp1252reverse.get(cp);
	return null;
}

const chars = [...t];
let result = "";
let i = 0;
let fixCount = 0;

while (i < chars.length) {
	const b = charToByte(chars[i]);

	if (b !== null && b >= 0xc0) {
		// Potential start of a double-encoded UTF-8 sequence
		let seqLen = 0;
		if (b >= 0xf0 && b <= 0xf7) seqLen = 4;
		else if (b >= 0xe0 && b <= 0xef) seqLen = 3;
		else if (b >= 0xc0 && b <= 0xdf) seqLen = 2;

		if (seqLen > 0) {
			const bytes = [b];
			let j = i + 1;
			let valid = true;

			while (bytes.length < seqLen && j < chars.length) {
				const nb = charToByte(chars[j]);
				if (nb === null || nb < 0x80 || nb > 0xbf) {
					valid = false;
					break;
				}
				bytes.push(nb);
				j++;
			}

			if (valid && bytes.length === seqLen) {
				const decoded = Buffer.from(bytes).toString("utf8");
				// Verify it decoded to a single valid character (not replacement char)
				if (!decoded.includes("\uFFFD") && [...decoded].length === 1) {
					const decodedCp = decoded.codePointAt(0);
					// Only replace if the decoded char is meaningfully different
					// (i.e., it's an emoji or symbol, not just a regular accented char)
					if (decodedCp > 0xff) {
						result += decoded;
						i = j;
						fixCount++;
						continue;
					}
				}
			}
		}
	}

	result += chars[i];
	i++;
}

console.log("Fixed " + fixCount + " mojibake sequences");

// Verify emojis
const emojiRegex =
	/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{00A9}\u{00AE}\u{2934}\u{2935}\u{2139}\u{200D}\u{20E3}\u{FE0F}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{25FF}\u{2B00}-\u{2BFF}\u{0080}-\u{00FF}]/gu;
const allNonAscii = [...result].filter((c) => c.codePointAt(0) > 127);
console.log(
	"Non-ASCII chars in result: " +
		[...new Set(allNonAscii)]
			.map((c) => c + " (U+" + c.codePointAt(0).toString(16) + ")")
			.join(", "),
);

if (fixCount > 0) {
	fs.writeFileSync(filePath, result, "utf8");
	console.log("File saved!");
} else {
	console.log("No fixes applied.");
}
