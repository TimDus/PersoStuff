// The word list is built from three downloads that disagree on spelling, so a rebuild can quietly drop words, glue
// furigana to the wrong kanji, or attach a sentence about a circle to the word for yen. These check the built file.
const test = require("node:test");
const assert = require("node:assert/strict");
const vocab = require("../data/vocab.json");
const by = (k) => vocab.find((w) => w.k === k);

test("every N5 and N4 word is there once, all of N5 before any of N4", () => {
  assert.equal(new Set(vocab.map((w) => w.k)).size, vocab.length);
  assert.deepEqual([vocab.filter((w) => w.lv === 5).length, vocab.filter((w) => w.lv === 4).length], [716, 668]);
  assert.equal(vocab.findIndex((w) => w.lv === 4), 716);
});

test("the list's dated spellings are written as today, and a second spelling of one word is dropped [終る = 終わる, 在る = 有る]", () => {
  assert.deepEqual(["終る|おわる", "落す|おとす", "下る|さがる", "伯父|おじさん", "堅|かたい", "御飯|ごはん", "在る|ある"].filter(by), []);
  assert.deepEqual(["終わる|おわる", "落とす|おとす", "下がる|さがる", "伯父さん|おじさん", "固い|かたい", "ご飯|ごはん", "有る|ある"].filter((k) => !by(k)), []);
  assert.deepEqual(by("終わる|おわる").fu, [["終", "お", 4], ["わる"]]);
});

test("a kanji spelling JMdict says is usually kana is marked, a kana word never is [沢山 = たくさん]", () => {
  assert.deepEqual([by("沢山|たくさん").uk, by("下さい|ください").uk, by("秋|あき").uk], [1, 1, undefined]);
  assert.deepEqual(vocab.filter((w) => w.uk && !/[一-鿿々]/.test(w.w)).map((w) => w.k), []);
});

test("furigana spells the word back exactly and sits only on kanji [会う = 会 with あ, then う]", () => {
  assert.deepEqual(vocab.filter((w) => w.fu.map((s) => s[0]).join("") !== w.w).map((w) => w.k), []);
  assert.deepEqual(vocab.filter((w) => w.fu.some(([t, rt]) => rt && !/[一-鿿々]/.test(t))).map((w) => w.k), []);
  assert.deepEqual(by("会う|あう").fu, [["会", "あ", 5], ["う"]]);
});

test("each furigana carries its kanji's level, the hardest kanji in a run deciding [写真 = N4, 時々 = N5, 沢山 = old level 1]", () => {
  assert.deepEqual(vocab.flatMap((w) => w.fu.filter(([, rt, lv]) => rt && ![0, 1, 2, 4, 5].includes(lv))).map(([t]) => t), []);
  assert.deepEqual(["学生|がくせい", "写真|しゃしん", "時々|ときどき", "沢山|たくさん"].map((k) => by(k).fu[0][2]), [5, 4, 5, 1]);
});

test("a word's examples use its own kanji, and a counter only after a number [no circle under ～円]", () => {
  const strays = vocab.filter((w) => {
    const own = (w.w.replace(/する$/, "").match(/[一-鿿々]+/) || [""])[0];
    return w.ex.some(([jp]) => !jp.includes(own));
  });
  assert.deepEqual(strays.map((w) => w.k), []);
  assert.ok(by("～円|～えん").ex.every(([jp]) => /[0-9０-９一二三四五六七八九十百千万何]円/.test(jp)));
});

test("the list's own spellings resolve [運動|うんどうする is a suru verb, 回る、回す two words, いい; よい one]", () => {
  assert.deepEqual([by("運動する|うんどうする").t, by("運動する|うんどうする").pos[0]], ["suru verb", "vs"]);
  assert.ok(by("回る|まわる") && by("回す|まわす"));
  assert.ok(by("いい|いい") && !vocab.some((w) => w.w.includes(";")));
  assert.equal(by("十|とお").r, "とお");
});

// A word the list spells in kana took the type of its most frequent homophone [する became 擦る, a godan verb; かける became 翔る].
test("words written in kana get the type of the word the list means", () => {
  const type = (k) => by(k).t;
  assert.deepEqual(["する|する", "かける|かける", "はく|はく", "はい|はい", "よく|よく"].map(type),
    ["irregular verb", "ichidan verb", "godan verb", "interjection", "adverb"]);
  assert.equal(by("する|する").pos[0], "vs-i");
});

// Matching the right homophone moved はい from 213th to 641st of 717, because its entry carries no newspaper rank.
test("a kana word ranks by how common its sound is [はい, よく, どう, その in the first half of N5]", () => {
  const at = (k) => vocab.findIndex((w) => w.k === k);
  assert.deepEqual(["はい|はい", "よく|よく", "どう|どう", "その|その"].filter((k) => at(k) >= 359), []);
});
