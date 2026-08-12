import assert from "node:assert/strict";
import test from "node:test";

import {
	find,
	findAll,
	findOutermost,
	outerHTML,
	parseMarkup,
	textContent,
} from "../src/utils/mini-dom.js";

test("reads a namespaced PROPFIND listing", () => {
	const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/backups/</d:href>
    <d:propstat><d:prop>
      <d:displayname>backups</d:displayname>
      <d:resourcetype><d:collection/></d:resourcetype>
    </d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/backups/ranobegemini_backup.json</d:href>
    <d:propstat><d:prop>
      <d:displayname>ranobegemini_backup.json</d:displayname>
      <d:getlastmodified>Wed, 01 Jan 2026 00:00:00 GMT</d:getlastmodified>
      <d:getcontentlength>4096</d:getcontentlength>
      <d:resourcetype/>
    </d:prop></d:propstat>
  </d:response>
</d:multistatus>`;

	const responses = findAll(parseMarkup(xml), "response");
	assert.equal(responses.length, 2);
	assert.notEqual(find(responses[0], "collection"), null);
	assert.equal(find(responses[1], "collection"), null);
	assert.equal(
		textContent(find(responses[1], "href")).trim(),
		"/backups/ranobegemini_backup.json",
	);
	assert.equal(
		textContent(find(responses[1], "getcontentlength")).trim(),
		"4096",
	);
});

test("selects outermost blocks and slices their exact source", () => {
	const html = `<div class="chapter">
<p>First para.</p>
<blockquote><p>Quoted inner.</p></blockquote>
Loose text here.
<p>Last <em>para</em> &amp; more.</p>
<br/>
</div>`;

	const blocks = findOutermost(parseMarkup(html), [
		"p",
		"blockquote",
		"h1",
		"li",
		"pre",
	]);

	assert.deepEqual(
		blocks.map((b) => b.local),
		["p", "blockquote", "p"],
	);
	assert.equal(
		outerHTML(blocks[1], html),
		"<blockquote><p>Quoted inner.</p></blockquote>",
	);
	assert.equal(
		outerHTML(blocks[2], html),
		"<p>Last <em>para</em> &amp; more.</p>",
	);
});

test("tolerates raw text, void elements and stray closing tags", () => {
	const messy = `<p>one<br>two</p><script>var a = "<p>not a tag</p>";</script><p>three</p></div>`;
	const blocks = findOutermost(parseMarkup(messy), ["p"]);

	assert.equal(blocks.length, 2, "script contents were parsed as markup");
	assert.equal(outerHTML(blocks[0], messy), "<p>one<br>two</p>");
	assert.equal(outerHTML(blocks[1], messy), "<p>three</p>");
});

test("applies implied end tags so unclosed paragraphs stay siblings", () => {
	assert.equal(findOutermost(parseMarkup("<p>alpha<p>beta"), ["p"]).length, 2);
	assert.equal(
		findOutermost(parseMarkup("<ul><li>a<li>b</ul>"), ["li"]).length,
		2,
	);
	// A <p> closed by a block start tag, not by another <p>.
	assert.equal(
		findOutermost(parseMarkup("<p>alpha<blockquote>q</blockquote>"), [
			"p",
			"blockquote",
		]).length,
		2,
	);
});

test("implied end tags do not fire for namespaced XML elements", () => {
	// `d:p` must not be treated as an HTML paragraph.
	const xml = "<d:root><d:p><d:p>inner</d:p></d:p></d:root>";
	assert.equal(findOutermost(parseMarkup(xml), ["p"]).length, 1);
});
