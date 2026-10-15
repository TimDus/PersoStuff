// A kanji page lists a kanji's parts by name, and a part that is neither a deck kanji nor a radical form has only
// radicals.js to name it. Without a name it shows as a bare shape [⻌ in 25 kanji, 宀 in 19], which is what the
// user saw before this file: 海's 氵 next to nothing, so nothing said it meant water.
const test = require("node:test");
const assert = require("node:assert/strict");
const kanji = require("../data/kanji.json");
const { NAMES, NOTES } = require("../radicals.js");

const shapes = [...new Set(Object.values(kanji).flatMap((k) => k.c.filter((p) => !kanji[p] && !(k.v || {})[p])))];

test("every part that isn't a deck kanji or a radical form has a name", () => {
  assert.ok(shapes.length > 150, `${shapes.length} shapes`);
  assert.deepEqual(shapes.filter((p) => !NAMES[p]), []);
});

test("every drift note is on a deck kanji and names a part that kanji has", () => {
  assert.ok(Object.keys(NOTES).length >= 10);
  assert.deepEqual(Object.keys(NOTES).filter((c) => !kanji[c]), []);
  assert.deepEqual(Object.entries(NOTES).filter(([c, n]) => !kanji[c].c.some((p) => n.includes(p))).map(([c]) => c), []);
  assert.match(NOTES["漢"], /Han/);
});
