/**
 * mini-dom — a tiny, dependency-free markup reader.
 *
 * WHY THIS EXISTS
 * ---------------
 * A Chromium MV3 background script is a *service worker*: it has no `document`
 * and no `DOMParser`. A Firefox MV3 background script is an *event page* and
 * has both. Any code shared between the two that reached for `DOMParser` worked
 * on Firefox and threw on Chromium — silently, because most of those call sites
 * were wrapped in try/catch.
 *
 * This module covers the shallow "find these tags, read their text / slice out
 * their source" cases (WebDAV PROPFIND XML, HTML block extraction) so they no
 * longer need a real DOM. It is deliberately NOT a spec-compliant parser and is
 * not a substitute for `DOMParser` where CSS selectors, layout or live-node
 * behaviour matter — for those, see `background/dom-sandbox.js`.
 *
 * Element nodes carry source offsets, so `outerHTML(node)` returns the exact
 * original substring rather than a lossy re-serialisation.
 */

/** HTML elements that never have a closing tag. */
const VOID_ELEMENTS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
]);

/** Elements whose content is text, not markup. */
const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title"]);

/**
 * Start tags that implicitly close an open `<p>`. Chapter markup routinely omits
 * `</p>`, and without this rule `<p>a<p>b` parses as one nested paragraph
 * instead of two siblings.
 */
const CLOSES_OPEN_P = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"details",
	"div",
	"dl",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"main",
	"menu",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"table",
	"ul",
]);

/**
 * The remaining implied-end-tag pairs: opening tag -> open tags it closes.
 */
const IMPLIED_END_TAGS = {
	li: new Set(["li"]),
	dt: new Set(["dt", "dd"]),
	dd: new Set(["dt", "dd"]),
	option: new Set(["option"]),
	tr: new Set(["tr", "td", "th"]),
	td: new Set(["td", "th"]),
	th: new Set(["td", "th"]),
};

const ATTR_RE = /([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>`]*))?/g;

const ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

/**
 * Decode the handful of entities that actually show up in the markup we read.
 * @param {string} text
 * @returns {string}
 */
export function decodeEntities(text) {
	if (!text || text.indexOf("&") === -1) return text;
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body) => {
		if (body[0] === "#") {
			const code =
				body[1] === "x" || body[1] === "X"
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : match;
		}
		const named = ENTITIES[body.toLowerCase()];
		return named === undefined ? match : named;
	});
}

function parseAttributes(raw) {
	const attrs = {};
	if (!raw) return attrs;
	ATTR_RE.lastIndex = 0;
	let match;
	while ((match = ATTR_RE.exec(raw)) !== null) {
		const name = match[1];
		if (!name || name === "/") continue;
		let value = match[2];
		if (value === undefined) {
			value = "";
		} else if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		attrs[name.toLowerCase()] = decodeEntities(value);
	}
	return attrs;
}

function makeElement(tag, attrs, start) {
	const colon = tag.indexOf(":");
	return {
		type: "element",
		tag,
		/** Tag name without its namespace prefix, lower-cased (`d:href` -> `href`). */
		local: (colon === -1 ? tag : tag.slice(colon + 1)).toLowerCase(),
		attrs,
		children: [],
		parent: null,
		start,
		end: start,
	};
}

/**
 * Parse HTML or XML into a lightweight node tree.
 *
 * @param {string} source
 * @returns {{type: "root", children: Array<object>, source: string}} Root node.
 */
export function parseMarkup(source) {
	const root = { type: "root", children: [], parent: null, source };
	if (!source) return root;

	let node = root;
	let index = 0;
	const length = source.length;

	const pushText = (text, decode) => {
		if (!text) return;
		node.children.push({
			type: "text",
			text: decode ? decodeEntities(text) : text,
			parent: node,
		});
	};

	while (index < length) {
		const lt = source.indexOf("<", index);
		if (lt === -1) {
			pushText(source.slice(index), true);
			break;
		}
		if (lt > index) pushText(source.slice(index, lt), true);

		// Comment / CDATA / doctype / processing instruction — skipped wholesale.
		if (source.startsWith("<!--", lt)) {
			const close = source.indexOf("-->", lt + 4);
			index = close === -1 ? length : close + 3;
			continue;
		}
		if (source.startsWith("<![CDATA[", lt)) {
			const close = source.indexOf("]]>", lt + 9);
			const end = close === -1 ? length : close;
			pushText(source.slice(lt + 9, end), false);
			index = close === -1 ? length : close + 3;
			continue;
		}
		if (source.startsWith("<!", lt) || source.startsWith("<?", lt)) {
			const close = source.indexOf(">", lt + 2);
			index = close === -1 ? length : close + 1;
			continue;
		}

		// Closing tag: unwind to the nearest matching open element. Unmatched
		// closers are dropped, which is what browsers do for stray `</div>`.
		if (source.startsWith("</", lt)) {
			const close = source.indexOf(">", lt + 2);
			const end = close === -1 ? length : close + 1;
			const name = source
				.slice(lt + 2, close === -1 ? length : close)
				.trim();
			const lower = name.toLowerCase();
			let candidate = node;
			while (candidate && candidate.type === "element") {
				if (candidate.tag.toLowerCase() === lower) {
					candidate.end = end;
					node = candidate.parent;
					break;
				}
				candidate = candidate.parent;
			}
			index = end;
			continue;
		}

		// Opening tag.
		const close = source.indexOf(">", lt + 1);
		if (close === -1) {
			pushText(source.slice(lt), true);
			break;
		}
		const inner = source.slice(lt + 1, close);
		const nameMatch = /^([^\s/>]+)/.exec(inner);
		if (!nameMatch) {
			pushText(source.slice(lt, close + 1), false);
			index = close + 1;
			continue;
		}
		const tag = nameMatch[1];
		const lower = tag.toLowerCase();

		// Implied end tags. Namespaced names never take part: `lower` keeps its
		// prefix so it misses the sets, and prefixed open elements are skipped.
		const implicitlyCloses = IMPLIED_END_TAGS[lower];
		while (node.type === "element" && node.tag.indexOf(":") === -1) {
			const open = node.local;
			const closed =
				(open === "p" && CLOSES_OPEN_P.has(lower)) ||
				(implicitlyCloses ? implicitlyCloses.has(open) : false);
			if (!closed) break;
			node.end = lt;
			node = node.parent;
		}

		const selfClosing = inner.endsWith("/");
		const element = makeElement(
			tag,
			parseAttributes(inner.slice(nameMatch[1].length)),
			lt,
		);
		element.parent = node;
		node.children.push(element);
		index = close + 1;

		if (selfClosing || VOID_ELEMENTS.has(lower)) {
			element.end = index;
			continue;
		}

		if (RAW_TEXT_ELEMENTS.has(lower)) {
			const closeTag = new RegExp(`</${lower}\\s*>`, "i");
			closeTag.lastIndex = 0;
			const rest = source.slice(index);
			const found = closeTag.exec(rest);
			const textEnd = found ? index + found.index : length;
			if (textEnd > index) {
				element.children.push({
					type: "text",
					text: source.slice(index, textEnd),
					parent: element,
				});
			}
			element.end = found ? textEnd + found[0].length : length;
			index = element.end;
			continue;
		}

		node = element;
	}

	// Anything still open at EOF ends at EOF.
	while (node && node.type === "element") {
		if (node.end <= node.start) node.end = length;
		node = node.parent;
	}

	return root;
}

/**
 * Depth-first search for every element with the given local (namespace-stripped)
 * name.
 *
 * @param {object} node - Root or element node.
 * @param {string} localName
 * @returns {Array<object>}
 */
export function findAll(node, localName) {
	const want = localName.toLowerCase();
	const found = [];
	const walk = (current) => {
		for (const child of current.children || []) {
			if (child.type !== "element") continue;
			if (child.local === want) found.push(child);
			walk(child);
		}
	};
	walk(node);
	return found;
}

/**
 * First descendant with the given local name, or null.
 *
 * @param {object} node
 * @param {string} localName
 * @returns {object|null}
 */
export function find(node, localName) {
	return findAll(node, localName)[0] || null;
}

/**
 * Concatenated text of a node and its descendants.
 *
 * @param {object} node
 * @returns {string}
 */
export function textContent(node) {
	if (!node) return "";
	if (node.type === "text") return node.text;
	let out = "";
	for (const child of node.children || []) out += textContent(child);
	return out;
}

/**
 * The exact source substring the element was parsed from.
 *
 * @param {object} node - Element node produced by {@link parseMarkup}.
 * @param {string} source - The same string that was passed to `parseMarkup`.
 * @returns {string}
 */
export function outerHTML(node, source) {
	if (!node || node.type !== "element") return "";
	return source.slice(node.start, node.end);
}

/**
 * All element descendants whose local name is in `names`, excluding any that
 * are nested inside another match. Mirrors "outermost blocks only" selection.
 *
 * @param {object} node
 * @param {Set<string>|Array<string>} names
 * @returns {Array<object>}
 */
export function findOutermost(node, names) {
	const want = names instanceof Set ? names : new Set(names);
	const found = [];
	const walk = (current) => {
		for (const child of current.children || []) {
			if (child.type !== "element") continue;
			if (want.has(child.local)) {
				found.push(child);
				continue; // do not descend — nested blocks are not separate hits
			}
			walk(child);
		}
	};
	walk(node);
	return found;
}
