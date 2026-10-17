// Heisig's keywords had to be unique across 2,200 kanji, so some are coinages that contradict everything around them:
// 旦 read "nightbreak" while its top story says the sun rises, and 昼 "daytime" was 尺 + nightbreak. keywords.js swaps
// those for plain meanings, and a review asks a keyword to recall one kanji, so a swap that repeats another kanji's
// keyword [中 "inside" beside 内 "inside"] would make two answers right. Needs content/koohii.json, like the browser tests.
const test = require("node:test");
const assert = require("node:assert/strict");
const kanji = require("../data/kanji.json");
const koohii = require("../content/koohii.json");
const { PLAIN, keywordOf } = require("../keywords.js");

const keyword = (c) => keywordOf(c, koohii, kanji);

test("every plain keyword is for a deck kanji and differs from Heisig's", () => {
  assert.ok(Object.keys(PLAIN).length > 50, `${Object.keys(PLAIN).length} entries`);
  assert.deepEqual(Object.keys(PLAIN).filter((c) => !kanji[c] || !koohii[c] || PLAIN[c] === koohii[c].kw), []);
});

// Checking first senses let 変 "odd, change" through beside 化 "change", exact strings let 申 "say (humble)" beside 言 "say", and a trailing word let 至 "arrive at" beside 着 "arrive".
// Heisig's own near pairs are his to answer for [飴 sweets, 甘 sweet], so only a sense of a plain keyword is checked.
test("no plain keyword shares a sense with another kanji's keyword, brackets, articles and plurals aside [中 middle, inside beside 内 within]", () => {
  const sense = (s) => s.replace(/\(.*?\)/g, "").trim().replace(/^(a|an|the|to|one's) /, "").replace(/ (at|to|on|up|of|for|in)$/, "").replace(/s$/, "");
  const senses = (c) => new Set(keyword(c).toLowerCase().split(/[,;]/).map(sense));
  const all = Object.keys(kanji).map((c) => [c, senses(c)]);
  const hits = Object.keys(PLAIN).flatMap((c) => [...senses(c)].flatMap((s) => all.filter(([d, ss]) => d !== c && ss.has(s)).map(([d]) => `${s}: ${c}${d}`)));
  assert.deepEqual(hits, []);
});
