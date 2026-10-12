// The word list is built from three downloads that disagree on spelling, so a rebuild can quietly drop words, glue
// furigana to the wrong kanji, or attach a sentence about a circle to the word for yen. These check the built file.
const test = require("node:test");
const assert = require("node:assert/strict");
const vocab = require("../data/vocab.json");
const by = (k) => vocab.find((w) => w.k === k);

test("every N5 and N4 word is there once, all of N5 before any of N4", () => {
  assert.equal(new Set(vocab.map((w) => w.k)).size, vocab.length);
  assert.deepEqual([vocab.filter((w) => w.lv === 5).length, vocab.filter((w) => w.lv === 4).length], [717, 668]);
  assert.equal(vocab.findIndex((w) => w.lv === 4), 717);
});

test("furigana spells the word back exactly and sits only on kanji [会う = 会 with あ, then う]", () => {
  assert.deepEqual(vocab.filter((w) => w.fu.map((s) => s[0]).join("") !== w.w).map((w) => w.k), []);
  assert.deepEqual(vocab.filter((w) => w.fu.some(([t, rt]) => rt && !/[一-鿿々]/.test(t))).map((w) => w.k), []);
  assert.deepEqual(by("会う|あう").fu, [["会", "あ"], ["う"]]);
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
