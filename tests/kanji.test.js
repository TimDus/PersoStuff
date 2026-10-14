// Every word card's kanji note and every kanji page read data/kanji.json and data/kanji-strokes.json, built from
// KANJIDIC2 and KanjiVG by tools/build-kanji.js. A kanji the build skipped shows a note line with no keyword and an
// empty stroke box, and a regex that drops a stroke draws 学 with 7 of its 8 strokes, all without an error.
const test = require("node:test");
const assert = require("node:assert/strict");
const vocab = require("../data/vocab.json");
const kanji = require("../data/kanji.json");
const strokes = require("../data/kanji-strokes.json");

const listed = [...new Set(vocab.flatMap((w) => [...w.w].filter((c) => /[一-鿿]/.test(c))))];

test("every kanji in the word list has a meaning, a stroke count and a level", () => {
  assert.equal(listed.length, 778);
  assert.deepEqual(listed.filter((c) => !kanji[c]?.m || !(kanji[c].sc > 0) || !(kanji[c].lv >= 0)), []);
  assert.deepEqual(Object.keys(kanji).filter((c) => !listed.includes(c)), []);
  assert.deepEqual(kanji["大"], { m: "large, big", sc: 3, lv: 5, c: [] });
});

test("every kanji has KanjiVG's strokes, one number per stroke, as many as KANJIDIC counts", () => {
  assert.deepEqual(listed.filter((c) => !strokes[c]?.d.length || strokes[c].d.length !== strokes[c].n.length), []);
  // KanjiVG draws the older glyph of two [飴 14 strokes to KANJIDIC2's 13, 噌 15 to 14].
  assert.deepEqual(listed.filter((c) => strokes[c].d.length !== kanji[c].sc), ["飴", "噌"]);
  assert.equal(strokes["学"].d.length, 8);
});

// Rounding -0.04 to 0 dropped the minus that separated it from the number before, so 2.7-0.04 became 2.70 and 487 kanji drew a stroke short.
test("every stroke's path gives each command whole groups of numbers [a curve takes 6]", () => {
  const ARGS = { m: 2, l: 2, t: 2, c: 6, s: 4, q: 4, h: 1, v: 1 };
  const broken = listed.filter((c) => strokes[c].d.some((d) => [...d.matchAll(/([a-zA-Z])([^a-zA-Z]*)/g)].some(([, cmd, args]) => {
    const n = (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) || []).length;
    return !n || n % ARGS[cmd.toLowerCase()] !== 0;
  })));
  assert.deepEqual(broken, []);
  assert.equal(strokes["生"].d[0], "M31.3,25.9c0.4,1.4,0.4,2.7,0,3.8c-2.3,6.7-7.2,17.2-15,24.2");
});

// The components sit with the meanings, so a kanji page lists them without fetching 631 KB of strokes.
test("a kanji's components are its outermost named parts [学 = ⺍ 冖 子, 大 has none]", () => {
  assert.deepEqual(kanji["学"].c, ["⺍", "冖", "子"]);
  assert.deepEqual(kanji["大"].c, []);
  assert.deepEqual(Object.keys(strokes["学"]), ["d", "n"]);
});

// The note on a word card's back names, per kanji, up to 3 other words already met with it, the most recently met first.
const { note, wordsWith } = require("../kanji.js");
const met = (first) => ({ st: "review", ivl: 1, ease: 2.5, due: first + 1, n: 1, lapses: 0, first, last: first });
const word = (k) => vocab.find((w) => w.k === k);

test("a note line lists only met words, at most 3, newest first, never the word itself", () => {
  const cards = {
    "学生|がくせい#r": met(10), "学校|がっこう#r": met(11), "大学|だいがく#r": met(14), "医学|いがく#r": met(12), "科学|かがく#r": met(13),
    "先生|せんせい#p": met(15),
  };
  const lines = note(word("学生|がくせい"), vocab, cards);
  assert.deepEqual(lines.map((l) => [l.c, l.also.map((w) => w.k)]), [
    ["学", ["大学|だいがく", "科学|かがく", "医学|いがく"]],
    // Only the English side of 先生 is met, which never happens without its Japanese side, so it doesn't count.
    ["生", []],
  ]);
});

test("words met on the same day keep the list's order", () => {
  const cards = { "学校|がっこう#r": met(11), "大学|だいがく#r": met(11), "医学|いがく#r": met(11) };
  assert.deepEqual(note(word("学生|がくせい"), vocab, cards)[0].also.map((w) => w.k), ["学校|がっこう", "大学|だいがく", "医学|いがく"]);
});

test("a kanji appears once and 々 gets no line; a kana word has no note [日曜日 = 日 曜, 時々 = 時]", () => {
  assert.deepEqual(note(word("日曜日|にちようび"), vocab, {}).map((l) => l.c), ["日", "曜"]);
  assert.deepEqual(note(word("時々|ときどき"), vocab, {}).map((l) => l.c), ["時"]);
  assert.deepEqual(note(vocab.find((w) => !/[一-鿿]/.test(w.w)), vocab, {}), []);
});

test("a word spelled like the card's own word is left out of its note", () => {
  const cards = { "明日|あす#r": met(12), "明後日|あさって#r": met(11) };
  assert.deepEqual(note(word("明日|あした"), vocab, cards).map((l) => [l.c, l.also.map((w) => w.k)]), [["明", ["明後日|あさって"]], ["日", ["明後日|あさって"]]]);
});

test("a kanji's word list puts met words first, newest first, then the rest in list order", () => {
  const cards = { "学校|がっこう#r": met(11), "科学|かがく#r": met(13), "大学|だいがく#p": met(14) };
  assert.deepEqual(wordsWith("学", vocab, cards).map((w) => w.k).slice(0, 5), ["科学|かがく", "学校|がっこう", "学生|がくせい", "大学|だいがく", "留学生|りゅうがくせい"]);
  assert.equal(wordsWith("学", vocab, cards).length, 13);
});

// The Kanji tab's deck: a kanji unlocks when a met word uses it, and the day's new kanji are the oldest unlocked ones.
const { unlocks, kanjiQueue, learned } = require("../kanji.js");

test("a kanji unlocks on the first day a word with it was met, oldest first, list order breaking a tie", () => {
  const cards = { "学校|がっこう#r": met(14), "大学|だいがく#r": met(10), "学生|がくせい#r": met(12), "先生|せんせい#p": met(5) };
  // 大学 reads 大 first, but 学 comes first in the list (20th to 大's 62nd); 学生 unlocks only 生, as 学 is already open.
  assert.deepEqual(unlocks(vocab, cards), [{ c: "学", day: 10 }, { c: "大", day: 10 }, { c: "生", day: 12 }, { c: "校", day: 14 }]);
  assert.deepEqual(unlocks(vocab, { "大学|だいがく#r": met(10) }).map((u) => u.c), ["学", "大"]);
  assert.deepEqual(unlocks(vocab, { "先生|せんせい#p": met(5) }), []);
});

test("today's kanji: due reviews most overdue first, then learning, then new up to the day's limit less today's intros", () => {
  const unlocked = ["一", "二", "三", "四", "五", "六"].map((c, i) => ({ c, day: i }));
  const kc = {
    二: { ...met(1), due: 9 }, 四: { ...met(1), due: 7 }, 五: { ...met(1), due: 11 },
    三: { st: "learn", ivl: 0, ease: 2.5, due: 10, n: 1, lapses: 0, first: 10, last: 10 },
    // A card whose word was since lost still comes up [七 from a reset word deck].
    七: { ...met(1), due: 8 },
  };
  assert.deepEqual(kanjiQueue({ unlocked, cards: kc, today: 10, newPerDay: 3 }), ["四", "七", "二", "三", "一", "六"]);
  assert.deepEqual(kanjiQueue({ unlocked, cards: kc, today: 10, newPerDay: 1 }), ["四", "七", "二", "三"]);
  assert.deepEqual(kanjiQueue({ unlocked, cards: {}, today: 10, newPerDay: 2 }), ["一", "二"]);
});

test("a word counts as learned once every kanji in it has a card at 21 days or more, never a kana word", () => {
  const at = (ivl) => ({ ...met(1), ivl });
  assert.equal(learned(word("学生|がくせい"), { 学: at(21), 生: at(30) }), true);
  assert.equal(learned(word("学生|がくせい"), { 学: at(21), 生: at(20) }), false);
  assert.equal(learned(word("学生|がくせい"), { 学: at(21) }), false);
  assert.equal(learned(vocab.find((w) => !/[一-鿿]/.test(w.w)), {}), false);
});
