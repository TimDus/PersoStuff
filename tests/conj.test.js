// Conjugation drills grade the learner against these rules, so a wrong rule teaches a wrong form with a green tick
// [行く's て-form is 行って, not 行いて; ある's negative is ない, not あらない]. Each verb class gets its own case,
// with real words from the list, and the romaji box gets the spellings a learner actually types.
const test = require("node:test");
const assert = require("node:assert/strict");
const { conjugate, base, FORMS, toKana, accepts } = require("../conj.js");
const WORDS = require("../data/vocab.json");
const listed = (w) => WORDS.find((x) => x.w === w);

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

// The list keeps most する nouns bare, so the drill adds the する [電話 polite = 電話します; cutting two kana gave でします].
test("a bare noun from the list that takes する conjugates with it", () => {
  assert.deepEqual(conjugate(listed("電話"), "masu"), { w: "電話します", r: "でんわします" });
  assert.deepEqual(conjugate(listed("仕事"), "nakatta"), { w: "仕事しなかった", r: "しごとしなかった" });
  assert.equal(conjugate(listed("しっかり"), "te").r, "しっかりして");
  assert.deepEqual(conjugate(listed("勉強する"), "masu"), { w: "勉強します", r: "べんきょうします" });
  assert.deepEqual(base(listed("電話")), { w: "電話する", r: "でんわする" });
  assert.deepEqual(base(listed("勉強する")), { w: "勉強する", r: "べんきょうする" });
});

// A word part can't be typed in romaji and a spelling without its kana ending has nothing to change [～だす, 堅 → くない].
test("word parts and spellings without their kana ending give no questions", () => {
  const parts = WORDS.filter((w) => /^[～〜]/.test(w.w));
  assert.ok(parts.some((w) => w.w === "～だす"));
  for (const w of [...parts, v("堅", "かたい", "adj-i")]) for (const f of FORMS) assert.equal(conjugate(w, f.id), null, w.w + " " + f.id);
  assert.equal(conjugate(listed("大切"), "ta").w, "大切だった", "a な-adjective's spelling never ends in kana");
});

// The box converts on every key, so each prefix must leave what the next key needs [onn must stay おnn; おん + a gave おんあ].
test("romaji typed one key at a time gives the same kana as typed at once", () => {
  const typed = (s) => [...s].reduce((v, ch) => toKana(v + ch), "");
  for (const s of ["onna", "annaishimasu", "zannen", "konnichiha", "shinnyuu", "kinnbe", "kon'ya", "tabemashita", "itte"]) {
    assert.equal(toKana(typed(s), true), toKana(s, true), s);
  }
  assert.equal(typed("annai"), "あんない");
});

// A selection saved by an older version can name a form this one lacks [食べ + undefined = 食べundefined].
test("a form id this version doesn't know gives no question", () => {
  assert.equal(conjugate(v("食べる", "たべる", "v1"), "gone"), null);
  assert.equal(conjugate(v("来る", "くる", "vk"), "gone"), null);
});

// Katakana words through a romaji keyboard [tesutoshimasu for テストします; ファックス needs fa = ふぁ].
test("a katakana word's form can be typed in romaji", () => {
  assert.equal(accepts(conjugate(listed("ファックス"), "masu"), "fakkusushimasu"), true);
  assert.equal(accepts(conjugate(listed("食べる"), "masu"), "タベマス"), false, "a hiragana answer wants hiragana");
  assert.equal(accepts(conjugate(listed("テスト"), "masu"), "tesutoshimasu"), true);
  assert.equal(accepts(conjugate(listed("コピーする"), "ta"), "kopi-shita"), true);
  assert.equal(accepts(conjugate(listed("テスト"), "masu"), "テストします"), true);
  assert.equal(accepts(conjugate(listed("テスト"), "masu"), "tesutoshita"), false);
});

// Enter settles an n left mid-answer as well as a last one [運転します with the n typed after て = うんてnします].
test("a lone n before kana is ん once the answer is sent", () => {
  assert.equal(toKana("うんてnします", true), "うんてんします");
  assert.equal(toKana("うんてnします"), "うんてnします");
  assert.equal(accepts(conjugate(listed("運転する"), "masu"), "うんてnします"), true);
});
