// Heisig's keywords had to be unique across 2,200 kanji, so some are coinages that contradict everything around them:
// 旦 read "nightbreak" while its top story says the sun rises, and 昼 "daytime" was 尺 + nightbreak. keywords.js swaps
// those for plain meanings, and a review asks a keyword to recall one kanji, so a swap that repeats another kanji's
// keyword [中 "inside" beside 内 "inside"] would make two answers right. Needs content/koohii.json, like the browser tests.
const test = require("node:test");
const assert = require("node:assert/strict");
const kanji = require("../data/kanji.json");
const koohii = require("../content/koohii.json");
const { PLAIN, keywordOf, CONTEXT } = require("../keywords.js");

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

// A context line sits under a keyword that alone doesn't say how its words use the kanji, and the review front shows it while the kanji is recalled.
test("勢 has a context line, the ask's own case [forces: momentum in 勢い, a crowd in 大勢]", () => {
  assert.equal(typeof CONTEXT, "object", "keywords.js exports CONTEXT");
  assert.equal(typeof CONTEXT["勢"], "string");
});

// English only, the user's pick: kana or a kanji on the review front would give the answer away [勢い in the line names 勢].
test("every context line is for a deck kanji, in English only, and not its keyword said again", () => {
  assert.equal(typeof CONTEXT, "object", "keywords.js exports CONTEXT");
  const bad = Object.entries(CONTEXT).filter(([c, s]) => !kanji[c] || typeof s !== "string" || !s.trim() || s !== s.trim()
    || /[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef々]/.test(s) || s.toLowerCase() === keyword(c).toLowerCase());
  assert.deepEqual(bad.map(([c, s]) => `${c} ${s}`), []);
});

// The line sits right under the keyword, so a part of it said again is a wasted half-line [縦 vertical: not "vertical; piloting"].
test("no context line repeats a part of its keyword as a whole word [縦 vertical; 札 tag]", () => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const repeats = ([c, s]) => keyword(c).toLowerCase().split(/,\s*/).filter((p) => p.length > 2)
    .some((p) => new RegExp(`(^|[^a-z])${esc(p)}([^a-z]|$)`).test(s.toLowerCase()));
  assert.deepEqual(Object.entries(CONTEXT).filter(repeats).map(([c, s]) => `${c} ${s}`), []);
});

// A small line: 80 characters wrap to 2 lines under the keyword on a 360 px review front, 40 fit on one.
test("no context line runs past 80 characters", () => {
  assert.equal(typeof CONTEXT, "object", "keywords.js exports CONTEXT");
  assert.deepEqual(Object.entries(CONTEXT).filter(([, s]) => s.length > 80).map(([c, s]) => `${c} ${s.length}`), []);
});
