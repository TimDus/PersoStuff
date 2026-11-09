// The hubs' search boxes: English finds a word or kanji by a whole word's start, so "eat" never lights 肉 meat or 天気
// weather, and romaji or kana find it by its reading, after every English hit [me: 下さい "please give me" before 目 め].
const test = require("node:test");
const assert = require("node:assert/strict");
const WORDS = require("../data/vocab.json");
const INFO = require("../data/kanji.json");
const { hira } = require("../sync.js");
const { words, kanji, mark } = require("../search.js");

const found = (q) => words(WORDS, q).map((w) => w.w);
const lit = (q, koohii) => kanji(Object.keys(INFO), INFO, q, koohii).sort();

test("an English word finds the words whose meaning has it at a word's start, the exact sense first", () => {
  assert.deepEqual(found("eat"), ["食べる", "食う", "召し上がる", "頂く"]);
  assert.equal(found("to eat")[0], "食べる");
  // The exact sense even when rarer [本 book in band 50 before 本棚 bookshelf in 27; 行く before 寝る to go to bed].
  assert.deepEqual(found("book").slice(0, 2), ["本", "本棚"]);
  assert.equal(found("go")[0], "行く");
});

test("words of one rank keep the commonest first [fall: 秋 落ちる 下がる 降る exact, then 眠る to fall asleep]", () => {
  assert.deepEqual(found("fall"), ["秋", "落ちる", "下がる", "降る", "散る", "眠る", "劣る", "転ぶ", "抜ける"]);
});

// Newspapers use 碁 and 今回 more than 行く and 今, so ranking ties by band alone opened 160 of 1,202 N5/N4 searches on an N3 word.
test("words of one rank list N5 and N4 before N3, then the commonest [go: 行く before 碁 the board game; now: 今 before 今回]", () => {
  const go = found("go"), now = found("now");
  assert.ok(go.includes("碁") && now.includes("今回"));
  assert.deepEqual([go[0], now[0], found("when")[0], found("year")[0]], ["行く", "今", "いつ", "年"]);
  assert.deepEqual(found("travel"), ["旅行", "旅"]);
});

test("romaji finds a word by its reading, after every English hit [me: 目 after please give me]", () => {
  assert.deepEqual(found("kami").sort(), ["上", "加味", "神", "紙", "雷", "髪", "髪の毛"].sort());
  assert.equal(found("taberu")[0], "食べる");
  const me = found("me");
  assert.ok(me.indexOf("目") > me.indexOf("失礼"));
  assert.ok(me.indexOf("目") > me.indexOf("肉"));
  // The exact readings before the ones they start, a suffix's ～ dropped, N3 after N5 and N4 at each [目 and ～目 め, N3's 芽, then 眼鏡 13, 珍しい 33, 召し上がる 45].
  assert.deepEqual(me.slice(me.indexOf("目"), me.indexOf("目") + 6), ["目", "～目", "芽", "眼鏡", "珍しい", "召し上がる"]);
});

test("kana and kanji typed find a word by its spelling or reading, katakana as hiragana", () => {
  assert.equal(found("たべる")[0], "食べる");
  assert.equal(found("かめら")[0], "カメラ");
  const shoku = found("食");
  assert.ok(shoku.includes("食べる"));
  assert.ok(shoku.every((w) => w.includes("食")));
});

test("an empty query finds nothing", () => {
  assert.deepEqual(found(""), []);
  assert.deepEqual(found("  "), []);
  assert.deepEqual(lit(" "), []);
});

test("a kanji answers to its shown keyword, Heisig's and KANJIDIC's meanings, at a word's start", () => {
  assert.deepEqual(lit("eat"), ["喫", "食"]);
  assert.ok(lit("after").includes("後"));
  assert.ok(lit("behind").includes("後"));
  assert.ok(!lit("nightbreak").includes("旦"));
  assert.ok(lit("nightbreak", { 旦: { kw: "nightbreak" } }).includes("旦"));
});

test("a kanji answers to romaji or kana by its readings, and to itself typed", () => {
  assert.deepEqual(lit("taberu"), ["食"]);
  const shoku = lit("shoku");
  assert.ok(shoku.includes("食") && shoku.includes("色"));
  assert.ok(shoku.every((c) => [...INFO[c].on, ...INFO[c].kun].some((r) => hira(r.replace(/[.-]/g, "")).startsWith("しょく"))));
  assert.deepEqual(lit("しょく"), shoku);
  assert.deepEqual(lit("ショク"), shoku);
  assert.deepEqual(lit("食べる"), ["食"]);
});

test("a half-typed syllable finds no reading until it is whole [tab: no 食べる or 食; tabe: both; kon is こん, never この]", () => {
  assert.ok(!found("tab").includes("食べる") && !lit("tab").includes("食"));
  assert.ok(found("tabe").includes("食べる") && lit("tabe").includes("食"));
  assert.ok(!found("eat").includes("エアコン"));
  assert.ok(!found("kon").includes("この"));
});

test("a kanji whose English is its exact keyword comes first among the English hits [old: 古 before 老 old man]", () => {
  assert.deepEqual(kanji(["老", "古"], INFO, "old"), ["古", "老"]);
  // Ties keep the study order they were given [eat: 食 and 喫 both exact].
  assert.deepEqual(kanji(["食", "喫"], INFO, "eat"), ["食", "喫"]);
  assert.deepEqual(kanji(["喫", "食"], INFO, "eat"), ["喫", "食"]);
});

test("a kanji found by its English comes before one found by a reading, whatever the study order [ten: 十 before 天 てん]", () => {
  assert.deepEqual(kanji(["天", "十"], INFO, "ten"), ["十", "天"]);
});

test("the match is marked where a word starts, never inside one", () => {
  assert.deepEqual(mark("to eat or drink (honorific)", "eat"), [["to ", false], ["eat", true], [" or drink (honorific)", false]]);
  assert.deepEqual(mark("movie theater, cinema", "eat"), [["movie theater, cinema", false]]);
  assert.deepEqual(mark("Excuse me", "ME"), [["Excuse ", false], ["me", true]]);
  assert.deepEqual(mark("to eat", " to  eat "), [["to eat", true]]);
});
