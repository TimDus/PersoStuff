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
  assert.deepEqual(kanji["大"], { m: "large, big", sc: 3, lv: 5, on: ["ダイ", "タイ"], kun: ["おお.きい"], c: [], top: "ダイ" });
});

// The deck learns a kanji's parts before the kanji, so a jōyō part no N5 or N4 word uses needs its own entry [味 is 口 and 未].
test("kanji.json adds the jōyō kanji the word list's kanji are built from, and only those", () => {
  const added = Object.keys(kanji).filter((c) => !listed.includes(c));
  assert.equal(added.length, 124);
  assert.deepEqual([..."未竹貝寸羊衣阜"].filter((c) => !added.includes(c)), []);
  const partOf = (p) => Object.values(kanji).some((k) => k.c.includes(p) || Object.values(k.v || {}).includes(p));
  assert.deepEqual(added.filter((c) => !partOf(c)), []);
  assert.deepEqual(added.filter((c) => !kanji[c].m || !(kanji[c].sc > 0) || !strokes[c]?.d.length), []);
});

// A radical form brings its full kanji as a part, KanjiVG's partial ones too [海's 氵 = 水; 飯's 飠 = 食, marked partial].
test("a radical form names its full kanji, partial or not, and never the kanji it's in", () => {
  assert.deepEqual(kanji["海"].v, { 氵: "水" });
  assert.deepEqual([kanji["休"].v, kanji["近"].v], [{ 亻: "人" }, undefined]);
  assert.deepEqual([kanji["飯"].v, kanji["様"].v, kanji["考"].v], [{ 飠: "食" }, { 氺: "水" }, { 耂: "老" }]);
  assert.deepEqual(Object.entries(kanji).filter(([c, k]) => Object.values(k.v || {}).includes(c)).map(([c]) => c), []);
});

// Only a radical-form pair keeps KanjiVG's original [兄's 儿 = 八 is a shape match, 魚's 灬 = 火 is the fire radical].
test("a part names its full kanji only where it is that kanji's radical form, whatever it means in the kanji", () => {
  assert.deepEqual(["兄", "冬", "次", "貫"].map((c) => kanji[c].v), Array(4).fill(undefined));
  assert.deepEqual(require("../kanji.js").forms("八", kanji), []);
  assert.deepEqual(["魚", "持", "帰", "光", "興", "者"].map((c) => kanji[c].v), [{ 灬: "火" }, { 扌: "手" }, { 刂: "刀" }, { "⺌": "小" }, { "𦥑": "臼" }, { 耂: "老" }]);
});

// KanjiVG names a few parts by a private code that would show as text, and the parts inside one still count [原: 厂, then 白 and 小 inside CDP-8BC4].
test("every part is a single character, never the kanji itself", () => {
  assert.deepEqual(Object.entries(kanji).filter(([, k]) => k.c.some((p) => [...p].length !== 1)).map(([c]) => c), []);
  assert.deepEqual(kanji["原"].c, ["厂", "白", "小"]);
  // KanjiVG names 王's own strokes 王, so its page linked to itself as a part.
  assert.deepEqual(Object.entries(kanji).filter(([c, k]) => k.c.includes(c)).map(([c]) => c), []);
});

test("every kanji has up to 3 on and 3 kun readings, without KANJIDIC's prefix and suffix forms", () => {
  assert.deepEqual(listed.filter((c) => !kanji[c].on.length && !kanji[c].kun.length), []);
  assert.deepEqual(listed.filter((c) => kanji[c].on.length > 3 || kanji[c].kun.length > 3), []);
  assert.deepEqual(listed.filter((c) => [...kanji[c].on, ...kanji[c].kun].some((r) => r.includes("-"))), []);
  assert.deepEqual([kanji["学"].on, kanji["学"].kun], [["ガク"], ["まな.ぶ"]]);
  // One kun per stem, else 生 spends its three on い.きる, い.かす and い.ける.
  assert.deepEqual(kanji["生"].kun, ["い.きる", "う.まれる", "お.う"]);
  // The word list's readings first, else 下 shows しも and もと where the list has 下げる and 下さい.
  assert.deepEqual(kanji["下"].kun, ["した", "さ.げる", "くだ.さる"]);
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

// The Kanji tab's deck: every kanji in the word list's order with its parts in front, and the day's new kanji the next ones in it.
const { order, partsOf, forms, kanjiQueue, ready, learned } = require("../kanji.js");
// RTK frames as Koohii gives them, kept here as Koohii's file is private [人 1023 comes after 会 814, which holds it].
const FRAMES = { 一: 1, 二: 2, 口: 11, 日: 12, 水: 137, 味: 233, 立: 462, 海: 500, 音: 518, 心: 639, 意: 654, 会: 814, 人: 1023 };
const before = (list, c) => partsOf(c, kanji).filter((p) => list.indexOf(p) > list.indexOf(c));

test("a kanji's parts are the deck's kanji in it, a radical form as its full kanji, never itself", () => {
  assert.deepEqual(partsOf("意", kanji), ["音", "心"]);
  assert.deepEqual(partsOf("海", kanji), ["水", "毎"]);
  assert.deepEqual([partsOf("学", kanji), partsOf("一", kanji)], [["子"], []]);
});

// Heisig's order alone made 今 the deck's 731st kanji and 来 its 841st, so 今日 and 来年 opened on day 74 and 85 at 10 kanji a day.
test("kanji come as the word list needs them, parts first, so a word's kanji never wait behind a later word's", () => {
  const list = order(kanji, FRAMES, vocab);
  assert.deepEqual(list.slice(0, 2), ["火", "秋"]);
  assert.ok(list.indexOf("今") < 100, `今 at ${list.indexOf("今")}`);
  assert.equal(list.length, Object.keys(kanji).length);
  assert.deepEqual(Object.keys(kanji).filter((c) => before(list, c).length), []);
  // The first word needing each kanji, itself or as a part of a part, never goes down along the deck.
  const need = new Map();
  const reach = (c, i) => { if (need.has(c)) return; need.set(c, i); partsOf(c, kanji).forEach((p) => reach(p, i)); };
  vocab.forEach((w, i) => [...w.w].filter((c) => kanji[c]).forEach((c) => reach(c, i)));
  const firsts = list.map((c) => need.get(c) ?? Infinity);
  assert.deepEqual(firsts.filter((n, i) => i && n < firsts[i - 1]), []);
});

test("without words kanji come in Heisig's frame order, each one's parts pulled in front of it, all the way down", () => {
  const list = order(kanji, FRAMES);
  assert.deepEqual(list.slice(0, 4), ["一", "二", "口", "日"]);
  assert.equal(new Set(list).size, Object.keys(kanji).length);
  assert.equal(list.length, Object.keys(kanji).length);
  // 意 is 音 and 心, and 音 is 立 and 日; 会 holds 人 though Heisig numbers 人 later; 海's 氵 is 水; 味's 未 has no frame here.
  for (const [a, b] of [["立", "音"], ["音", "意"], ["心", "意"], ["人", "会"], ["水", "海"], ["未", "味"]]) assert.ok(list.indexOf(a) < list.indexOf(b), `${a} before ${b}`);
  assert.deepEqual(Object.keys(kanji).filter((c) => before(list, c).length), []);
});

// Koohii's file is private and can fail to load; the deck still needs an order then.
test("without frames kanji go by stroke count, parts still first", () => {
  const list = order(kanji, {});
  assert.deepEqual(list.slice(0, 2), ["一", "乙"]);
  assert.ok(list.indexOf("十") < list.indexOf("千"));
  assert.deepEqual(Object.keys(kanji).filter((c) => before(list, c).length), []);
  assert.deepEqual(order(kanji, FRAMES).slice(0, 4), order(kanji, { ...FRAMES, 學: 5 }).slice(0, 4), "a frame for a kanji outside the deck changes nothing");
});

test("a full kanji lists its radical forms, with the kanji using them", () => {
  const water = forms("水", kanji);
  assert.deepEqual(water.map((f) => f.f), ["氵", "氺"]);
  assert.deepEqual([..."海池泳"].filter((c) => !water[0].cs.includes(c)), []);
  assert.deepEqual(forms("人", kanji).map((f) => f.f), ["亻"]);
  assert.deepEqual(forms("大", kanji), []);
});

test("today's kanji: due reviews most overdue first, then learning, then new up to the day's limit less today's intros", () => {
  const unlocked = ["一", "二", "三", "四", "五", "六"];
  const kc = {
    二: { ...met(1), due: 9 }, 四: { ...met(1), due: 7 }, 五: { ...met(1), due: 11 },
    三: { st: "learn", ivl: 0, ease: 2.5, due: 10, n: 1, lapses: 0, first: 10, last: 10 },
    // A card whose word was since lost still comes up [七 from a reset word deck].
    七: { ...met(1), due: 8 },
  };
  assert.deepEqual(kanjiQueue({ order: unlocked, cards: kc, today: 10, newPerDay: 3 }), ["四", "七", "二", "三", "一", "六"]);
  assert.deepEqual(kanjiQueue({ order: unlocked, cards: kc, today: 10, newPerDay: 1 }), ["四", "七", "二", "三"]);
  assert.deepEqual(kanjiQueue({ order: unlocked, cards: {}, today: 10, newPerDay: 2 }), ["一", "二"]);
});

test("kanji due the same day come in a fresh order each session, overdue ones still first", () => {
  const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const kc = Object.fromEntries(["一", "二", "三", "四", "五", "六", "七", "八"].map((c, i) => [c, { ...met(1), due: i < 2 ? 8 : 10 }]));
  const run = (seed) => kanjiQueue({ order: [], cards: kc, today: 10, newPerDay: 0, rand: seeded(seed) }).join("");
  assert.ok(new Set([1, 2, 3, 4, 5].map(run)).size > 1, "five sessions gave one order");
  for (const s of [1, 2, 3, 4, 5]) assert.deepEqual([...run(s).slice(0, 2)].sort(), ["一", "二"]);
});

test("a word can be new once each of its kanji has a card, a kana word at once", () => {
  assert.equal(ready(word("学生|がくせい"), { 学: met(1), 生: met(2) }), true);
  assert.equal(ready(word("学生|がくせい"), { 学: met(1) }), false);
  assert.equal(ready(vocab.find((w) => !/[一-鿿]/.test(w.w)), {}), true);
});

test("a word counts as learned once every kanji in it has a card at 21 days or more, never a kana word", () => {
  const at = (ivl) => ({ ...met(1), ivl });
  assert.equal(learned(word("学生|がくせい"), { 学: at(21), 生: at(30) }), true);
  assert.equal(learned(word("学生|がくせい"), { 学: at(21), 生: at(20) }), false);
  assert.equal(learned(word("学生|がくせい"), { 学: at(21) }), false);
  assert.equal(learned(vocab.find((w) => !/[一-鿿]/.test(w.w)), {}), false);
});

// A kanji's page listed every reading KANJIDIC2 gives with nothing to say which one the words already met use [学: ガク and まな.ぶ alike].
const { readingIn, byReading, family } = require("../kanji.js");

test("a kanji's reading in a word is found through rendaku, a small っ and a kun's stem", () => {
  assert.equal(readingIn("学", word("学生|がくせい"), kanji), "ガク");
  assert.equal(readingIn("学", word("学校|がっこう"), kanji), "ガク");
  assert.equal(readingIn("紙", word("手紙|てがみ"), kanji), "かみ");
  assert.equal(readingIn("晴", word("素晴らしい|すばらしい"), kanji), "は.れる");
  assert.equal(readingIn("生", word("生きる|いきる"), kanji), "い.きる");
  assert.equal(readingIn("生", word("先生|せんせい"), kanji), "セイ");
  // A reading spelled as written beats a voiced one, else 神社 じんじゃ reads シン voiced.
  assert.equal(readingIn("神", word("神社|じんじゃ"), kanji), "ジン");
  // A lone kanji with kana after it takes a kun first, else 死ぬ and 差し上げる read the on'yomi シ and サ.
  assert.deepEqual([readingIn("死", word("死ぬ|しぬ"), kanji), readingIn("差", word("差し上げる|さしあげる"), kanji)], ["し.ぬ", "さ.す"]);
  // A reading has to use up the furigana, else 話 read はなし would count as はな.す.
  assert.equal(readingIn("話", word("話|はなし"), kanji), "はなし");
  // 々 repeats the kanji before it, voiced or not [時々 = とき + どき].
  assert.deepEqual(["時々|ときどき", "段々|だんだん", "色々|いろいろ"].map((k) => readingIn(k[0], word(k), kanji)), ["とき", "ダン", "いろ"]);
});

test("a whole-word reading, or a kanji.json without readings, gives a kanji no reading [今日 = きょう]", () => {
  assert.equal(readingIn("今", word("今日|きょう"), kanji), null);
  const old = Object.fromEntries(Object.entries(kanji).map(([c, { on, kun, ...rest }]) => [c, rest]));
  assert.equal(readingIn("学", word("学生|がくせい"), old), null);
  assert.deepEqual(byReading("学", vocab, { "学生|がくせい#r": met(10) }, old), { top: null, rest: [] });
});

test("the main reading comes apart from the rest, each with up to 3 list words using it, met ones first and newest first", () => {
  const cards = {
    "学生|がくせい#r": met(10), "学校|がっこう#r": met(11), "大学|だいがく#r": met(14), "医学|いがく#r": met(12), "科学|かがく#r": met(13),
  };
  // A word not met yet is marked ~ [四 with nothing met: シ from 四 read し, then よん from 四 read よん].
  const rows = (c, cs, info = kanji) => { const b = byReading(c, vocab, cs, info); const ws = (x) => [x.r, x.words.map(({ w, met }) => w.w + (met ? "" : "~"))]; return [b.top && ws(b.top), b.rest.map(ws)]; };
  assert.deepEqual(rows("学", cards), [["ガク", ["大学", "科学", "医学"]], [["まな.ぶ", []]]]);
  assert.deepEqual(rows("四", {}), [["シ", ["四~"]], [["よっ.つ", ["四つ~"]], ["よん", ["四~"]], ["よ", []]]]);
  // A word met only English side first counts as not met.
  assert.deepEqual(rows("学", { "学生|がくせい#p": met(10) })[0], ["ガク", ["学生~", "学校~", "大学~"]]);
  // 今日 is read whole, so it stands under no reading.
  assert.deepEqual(rows("今", { "今日|きょう#r": met(10), "今晩|こんばん#r": met(11) }), [["いま", ["今~"]], [["コン", ["今晩", "今月~", "今週~"]], ["キン", []]]]);
  // The rest keep kanji.json's order whichever was met first.
  assert.deepEqual(rows("生", { "生きる|いきる#r": met(12), "先生|せんせい#r": met(10) })[1].map(([r]) => r), ["ショウ", "い.きる", "う.まれる", "お.う"]);
  // A kanji.json cached before the main reading puts every reading in the rest.
  const { top, ...old } = kanji["生"];
  assert.deepEqual(rows("生", {}, { 生: old })[0], null);
  assert.deepEqual(rows("生", {}, { 生: old })[1].map(([r]) => r), ["セイ", "ショウ", "い.きる", "う.まれる", "お.う"]);
});

// A kanji page listed 四's シ, よっ.つ, よ and よん alike, with nothing to say which one to learn first.
test("kanji.json marks the reading anime subtitles use most or one picked by hand, always one of the kanji's own [今 = いま, 人 = ひと; 上 = うえ over ジョウ]", () => {
  assert.deepEqual(["今", "人", "何", "行", "上", "夫", "四", "晴"].map((c) => kanji[c].top), ["いま", "ひと", "なに", "い.く", "うえ", "おっと", "シ", "は.れる"]);
  assert.deepEqual(Object.keys(kanji).filter((c) => kanji[c].top && ![...kanji[c].on, ...kanji[c].kun].includes(kanji[c].top)), []);
  assert.ok(Object.values(kanji).filter((k) => k.top).length > 890);
});

// KanjiVG marks the part that gives a kanji its sound [晴 and 静 take theirs from 青, all read セイ].
test("kanji.json keeps KanjiVG's sound parts, only where a kanji has one", () => {
  assert.deepEqual(kanji["晴"].p, ["青"]);
  assert.equal("p" in kanji["大"], false);
  // KanjiVG's own marks come off [金: 今1 and 今2 = 今; 売: 買V = 買], and a kanji marked as its own sound has none [陰: 陰right].
  assert.deepEqual([kanji["金"].p, kanji["売"].p], [["今"], ["買"]]);
  assert.equal("p" in kanji["陰"], false);
  // A slash gives alternatives, each a part of its own [仮: 叚V/反 = 叚 and 反, so 仮 meets 暇].
  assert.deepEqual(kanji["仮"].p, ["叚", "反"]);
});

test("a sound family is the list's kanji sharing a sound part and an on'yomi, never one whose reading moved on", () => {
  assert.deepEqual(family("晴", kanji), [{ r: ["セイ"], cs: ["青", "静"] }]);
  assert.deepEqual(family("青", kanji), [{ r: ["セイ"], cs: ["晴", "静"] }]);
  // 活 and 話 both take 舌, but read カツ and ワ.
  assert.deepEqual([family("活", kanji), family("話", kanji)], [[], []]);
  assert.deepEqual(family("会", kanji), [{ r: ["カイ", "エ"], cs: ["絵"] }]);
  assert.deepEqual([family("金", kanji), family("売", kanji)], [[{ r: ["キン", "コン"], cs: ["今"] }], [{ r: ["バイ"], cs: ["買"] }]]);
  // A part KanjiVG spells as a sum still joins the kanji that share it [新 and 親: 辛+木, シン].
  assert.deepEqual([family("新", kanji), family("無", kanji)], [[{ r: ["シン"], cs: ["親"] }], [{ r: ["ブ"], cs: ["舞"] }]]);
  const old = Object.fromEntries(Object.entries(kanji).map(([c, { p, ...rest }]) => [c, rest]));
  assert.deepEqual(family("晴", old), []);
});

// KanjiVG names some parts by an old element, not the shape on screen [里 showed only 日, 才 showed 扌 hand, 章 counted 日 twice].
test("a part KanjiVG names by an old element is written out by hand as the shape on screen", () => {
  assert.deepEqual(["里", "才", "章", "官", "電"].map((c) => kanji[c].c), [["田", "土"], [], ["立", "早"], ["宀", "𠂤"], ["雨", "电"]]);
  assert.equal(kanji["才"].v, undefined);
});

// Only the first kana of the okurigana was compared, so 分かる counted as わ.かれる and 分's page filed 分かる under it.
test("a kun matched by its whole okurigana takes its stem's place over a first-kana match [分: わ.かる, not わ.かれる]", () => {
  assert.deepEqual(kanji["分"].kun, ["わ.かる"]);
  assert.deepEqual(kanji["下"].kun, ["した", "さ.げる", "くだ.さる"], "a derived form like 下さい still counts");
});
