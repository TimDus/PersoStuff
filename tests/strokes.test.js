// Stroke order comes from a file built out of KanjiVG, so a kana the build skipped would show an empty box with no error.
// This checks the built file against every kana the site teaches, combinations and small kana included.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

global.window = {};
require("../data.js");
const { KANA } = window.HIRAGANA;
const strokes = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "strokes.json"), "utf8"));

test("every character of every kana has its strokes, one number per stroke", () => {
  const chars = [...new Set(KANA.flatMap((k) => [...k.kana]))];
  const missing = chars.filter((c) => !strokes[c]?.d.length || strokes[c].d.length !== strokes[c].n.length);
  assert.deepEqual(missing, []);
  assert.equal(chars.length, 154);
});

test("strokes keep KanjiVG's order [あ's third stroke is the loop]", () => {
  assert.equal(strokes["あ"].d.length, 3);
  assert.match(strokes["あ"].d[0], /^M31\.01,33/);
  assert.match(strokes["あ"].d[2], /^M65\.63,44\.12/);
});
