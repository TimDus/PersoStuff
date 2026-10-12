// Conjugation drills grade the learner against these rules, so a wrong rule teaches a wrong form with a green tick
// [行く's て-form is 行って, not 行いて; ある's negative is ない, not あらない]. Each verb class gets its own case,
// with real words from the list, and the romaji box gets the spellings a learner actually types.
const test = require("node:test");
const assert = require("node:assert/strict");
const { conjugate, FORMS, toKana, accepts } = require("../conj.js");

const v = (w, r, pos) => ({ w, r, pos: [pos] });
const forms = (word, names) => names.map((f) => conjugate(word, f)?.r);

test("godan verbs change their last kana by row [書く: 書き, 書か, 書い, 書け, 書こ]", () => {
  assert.deepEqual(forms(v("書く", "かく", "v5k"), ["masu", "nai", "te", "ta", "potential", "volitional", "ba", "imperative"]),
    ["かきます", "かかない", "かいて", "かいた", "かける", "かこう", "かけば", "かけ"]);
  assert.deepEqual(forms(v("買う", "かう", "v5u"), ["nai", "te", "passive", "causative"]), ["かわない", "かって", "かわれる", "かわせる"]);
  assert.deepEqual(forms(v("泳ぐ", "およぐ", "v5g"), ["te", "ta"]), ["およいで", "およいだ"]);
  assert.deepEqual(forms(v("話す", "はなす", "v5s"), ["te", "masu"]), ["はなして", "はなします"]);
  assert.deepEqual(forms(v("待つ", "まつ", "v5t"), ["te", "masu", "nai"]), ["まって", "まちます", "またない"]);
  assert.deepEqual(forms(v("死ぬ", "しぬ", "v5n"), ["te", "nakatta"]), ["しんで", "しななかった"]);
  assert.deepEqual(forms(v("呼ぶ", "よぶ", "v5b"), ["te", "tara"]), ["よんで", "よんだら"]);
  assert.deepEqual(forms(v("読む", "よむ", "v5m"), ["te", "masendeshita"]), ["よんで", "よみませんでした"]);
  assert.deepEqual(forms(v("帰る", "かえる", "v5r"), ["te", "mashita"]), ["かえって", "かえりました"]);
});

test("ichidan verbs drop る [食べる: 食べます, 食べられる, 食べろ]", () => {
  assert.deepEqual(forms(v("食べる", "たべる", "v1"), ["masu", "masen", "te", "nai", "potential", "volitional", "ba", "passive", "causative", "imperative"]),
    ["たべます", "たべません", "たべて", "たべない", "たべられる", "たべよう", "たべれば", "たべられる", "たべさせる", "たべろ"]);
});

test("the irregulars keep their own forms [行って, ない, 来ます, します, いらっしゃいます]", () => {
  assert.deepEqual(forms(v("行く", "いく", "v5k-s"), ["te", "ta", "masu"]), ["いって", "いった", "いきます"]);
  assert.deepEqual(forms(v("有る", "ある", "v5r-i"), ["nai", "nakatta", "masu"]), ["ない", "なかった", "あります"]);
  assert.deepEqual(forms(v("来る", "くる", "vk"), ["masu", "nai", "te", "potential", "volitional", "imperative", "causative"]),
    ["きます", "こない", "きて", "こられる", "こよう", "こい", "こさせる"]);
  assert.deepEqual(conjugate(v("来る", "くる", "vk"), "nai").w, "来ない");
  assert.deepEqual(forms(v("する", "する", "vs-i"), ["masu", "nai", "te", "potential", "volitional", "passive", "imperative"]),
    ["します", "しない", "して", "できる", "しよう", "される", "しろ"]);
  assert.deepEqual(conjugate(v("勉強する", "べんきょうする", "vs"), "masen"), { w: "勉強しません", r: "べんきょうしません" });
  assert.deepEqual(forms(v("いらっしゃる", "いらっしゃる", "v5aru"), ["masu", "imperative", "te"]), ["いらっしゃいます", "いらっしゃい", "いらっしゃって"]);
  // Forms nobody says aren't drilled [くださられる, ある's あろう].
  assert.deepEqual(forms(v("くださる", "くださる", "v5aru"), ["potential", "volitional", "passive", "causative"]), [undefined, undefined, undefined, undefined]);
  assert.equal(conjugate(v("有る", "ある", "v5r-i"), "volitional"), null);
});

test("い-adjectives, いい through よい, and な-adjectives", () => {
  assert.deepEqual(forms(v("高い", "たかい", "adj-i"), ["nai", "ta", "nakatta", "te", "ba", "tara"]),
    ["たかくない", "たかかった", "たかくなかった", "たかくて", "たかければ", "たかかったら"]);
  assert.deepEqual(forms(v("いい", "いい", "adj-ix"), ["nai", "ta", "te"]), ["よくない", "よかった", "よくて"]);
  assert.deepEqual(forms(v("静か", "しずか", "adj-na"), ["nai", "ta", "nakatta", "te", "tara"]),
    ["しずかじゃない", "しずかだった", "しずかじゃなかった", "しずかで", "しずかだったら"]);
  assert.equal(conjugate(v("高い", "たかい", "adj-i"), "masu"), null, "adjectives have no ます form");
});

test("the kanji spelling changes with the reading [書く: 書きます]", () => {
  assert.deepEqual(conjugate(v("書く", "かく", "v5k"), "masu"), { w: "書きます", r: "かきます" });
  assert.deepEqual(conjugate(v("静か", "しずか", "adj-na"), "ta"), { w: "静かだった", r: "しずかだった" });
});

test("every form names its set, N5 or N4", () => {
  assert.deepEqual(FORMS.filter((f) => f.set === 5).map((f) => f.id), ["masu", "masen", "mashita", "masendeshita", "te", "nai", "ta", "nakatta"]);
  assert.deepEqual(FORMS.filter((f) => f.set === 4).map((f) => f.id), ["potential", "volitional", "ba", "tara", "passive", "causative", "imperative"]);
});

test("romaji turns into kana, a dangling n waiting for its next letter", () => {
  assert.equal(toKana("tabemashita"), "たべました");
  assert.equal(toKana("itte"), "いって");
  assert.equal(toKana("benkyou"), "べんきょう");
  assert.equal(toKana("shinanakatta"), "しななかった");
  assert.equal(toKana("yonde"), "よんで");
  assert.equal(toKana("tan"), "たn");
  assert.equal(toKana("tan", true), "たん");
  assert.equal(toKana("konnichiha"), "こんにちは");
  assert.equal(toKana("kon'ya"), "こんや");
  assert.equal(toKana("chotto"), "ちょっと");
  assert.equal(toKana("tsukaimasu"), "つかいます");
  assert.equal(toKana("たべmasu"), "たべます");
});

test("an answer counts in kana, in romaji, or in the kanji spelling", () => {
  const want = { w: "書きます", r: "かきます" };
  for (const typed of ["かきます", "kakimasu", "書きます", " kakimasu "]) assert.equal(accepts(want, typed), true, typed);
  for (const typed of ["かきます。", "kakimas", "書きました", ""]) assert.equal(accepts(want, typed), false, typed);
  assert.equal(accepts({ w: "読んで", r: "よんで" }, "yonde"), true);
  assert.equal(accepts({ w: "死なない", r: "しなない" }, "shinanai"), true);
});
