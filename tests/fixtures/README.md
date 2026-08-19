# Website handler fixtures

One reduced HTML page per supported site, used by `tests/website-handlers.test.mjs`.

These are **not** verbatim captures. Each file keeps the structural skeleton a
handler actually navigates — the ids, classes, attributes and nesting its
selectors depend on — and throws away the prose bulk, the styling, the tracking
and the site chrome. A 400 KB verbatim page would pin a thousand details nobody
is asserting and would make a failure message unreadable.

Every fixture deliberately contains noise the handler is supposed to strip: a
`<script>`, an `<ins class="adsbygoogle">`, or a nav block. The tests assert both
that the prose survives *and* that the noise does not, because "extraction
returned something" is a much weaker claim than "extraction returned the right
thing."

The prose is original filler written for these tests. Two sentences recur on
purpose:

- `He had already walked the road ahead, shadowed and afraid.` — every word of
  which contains the letters `ad`. It exists to keep the Ranobes ad-stripping
  regexes anchored; an unanchored version once turned this into
  `He halrey walked the roahe, showed and afraid.`
- A line reading `Advertisement` on its own, which *must* be stripped.

## Updating a fixture

When a site changes its markup and extraction breaks in the wild, update the
fixture to match the new markup **in the same commit as the handler fix**. The
fixture is the record of what the site looked like when the selectors were last
known to work; a handler fix without a fixture change means the test is still
proving the old thing.
