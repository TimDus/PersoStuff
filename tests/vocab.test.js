// The word list is built from three downloads that disagree on spelling, so a rebuild can quietly drop words, glue
// furigana to the wrong kanji, or attach a sentence about a circle to the word for yen. These check the built file.
const test = require("node:test");
const assert = require("node:assert/strict");
const vocab = require("../data/vocab.json");
const by = (k) => vocab.find((w) => w.k === k);

test("every N5, N4 and N3 word is there once, each level after the one before", () => {
  assert.equal(new Set(vocab.map((w) => w.k)).size, vocab.length);
  assert.deepEqual([5, 4, 3].map((lv) => vocab.filter((w) => w.lv === lv).length), [715, 668, 2123]);
  assert.deepEqual([vocab.findIndex((w) => w.lv === 4), vocab.findIndex((w) => w.lv === 3)], [715, 1383]);
  assert.deepEqual(vocab.filter((w, i) => i && w.lv > vocab[i - 1].lv).map((w) => w.k), []);
});

// SPELL was keyed by spelling alone, so N3's 下る read くだる "to descend" took N4's rename and became 下がる read くだる.
test("a dated spelling is renamed only where the new one fits the reading, and N3's are written as today [下る read くだる stays; 支払 = 支払い]", () => {
  assert.ok(by("下る|くだる") && by("下がる|さがる") && !by("下がる|くだる"));
  assert.deepEqual(["支払|しはらい", "当り|あたり", "押える|おさえる", "知合い|しりあい", "引越し|ひっこし", "中味|なかみ", "祭|まつり", "代る|かわる", "下す|おろす", "唯|たった"].filter(by), []);
  assert.deepEqual(["支払い|しはらい", "当たり|あたり", "押さえる|おさえる", "知り合い|しりあい", "引っ越し|ひっこし", "中身|なかみ", "祭り|まつり", "代わる|かわる", "下ろす|おろす", "たった|たった"].filter((k) => !by(k)), []);
});

// N3 lists 被る beside N5's かぶる and 為る read する; a reading of する alone also made 刷る "to print" the suru noun 刷るする.
test("an N3 row that is a listed word again or its second spelling is dropped, a pair with a sense of its own stays, and a verb read する is that verb", () => {
  assert.deepEqual(["被る|かぶる", "為る|する", "為る|なる", "たしか|たしか", "清む|すむ", "只|ただ", "唯|ただ", "具える|そなえる", "殖やす|ふやす", "塵|ごみ", "出合い|であい", "濠|ほり", "円|まる", "角|すみ"].filter(by), []);
  assert.deepEqual(vocab.filter((w) => w.k === "四|よん").map((w) => [w.lv, w.alt[0][0]]), [[5, "し"]]);
  assert.deepEqual(["遭う|あう", "温かい|あたたかい", "河|かわ", "街|まち", "量る|はかる", "測る|はかる"].filter((k) => !by(k)), []);
  assert.deepEqual(["刷る|する", "擦る|する"].map((k) => by(k)?.t), ["godan verb", "godan verb"]);
  assert.deepEqual(vocab.filter((w) => /.する\|する$/.test(w.k)).map((w) => w.k), []);
});

// しまった (かん) kept the list's note in its key and matched nothing in JMdict, so it had no type; 達する matched nothing as 達.
test("a spelling's note is dropped, and a suru verb JMdict lists only whole is matched whole [しまった (かん) = しまった; 達する nf15]", () => {
  assert.deepEqual(vocab.filter((w) => w.k.includes("(かん)")).map((w) => w.k), []);
  assert.deepEqual(["しまった|しまった", "すみません|すみません", "はあ|はあ"].map((k) => by(k)?.t), ["interjection", "expression", "interjection"]);
  assert.deepEqual(["達する|たっする", "罰する|ばっする"].map((k) => [by(k)?.t, by(k)?.f]), [["suru verb", 15], ["suru verb", 25]]);
});

// 運転 and 明後日 read みょうごにち joined from N3 and took or blocked every sentence of N4's 運転する and N5's 明後日 あさって.
test("an N5 or N4 word keeps its examples when an N3 word shares its spelling [明後日 あさって: 明後日の晩かえります]", () => {
  const jp = (k) => by(k).ex.map(([s]) => s);
  assert.deepEqual(jp("明後日|あさって"), ["明後日の晩かえります。", "明後日いらして下さい。"]);
  assert.deepEqual(jp("～円|～えん"), ["私はそのレコードを買うのに３０００円かかった。", "５０円です。"]);
  assert.deepEqual(jp("～中|～ちゅう"), ["今勤務中です。", "図１中のグラフは各学年の白人と黒人の総計点の平均値の相違を示している。"]);
  assert.deepEqual(jp("～日|～にち"), ["１３日の金曜日は不吉な日だと言われている。", "私の誕生日は3月22日です。"]);
  assert.deepEqual(jp("工場|こうじょう"), ["その工場は玩具を製造している。", "彼らは工場で働いた。"]);
  assert.deepEqual(jp("運転する|うんてんする"), ["トムは車を運転した。", "現在５０台の機械が運転中です。"]);
  assert.deepEqual(jp("下がる|さがる"), ["熱が下がった。", "ランプは天井から下がっていた。"]);
});

test("the list's dated spellings are written as today, and a second spelling of one word is dropped [終る = 終わる, 在る = 有る]", () => {
  assert.deepEqual(["終る|おわる", "落す|おとす", "下る|さがる", "伯父|おじさん", "堅|かたい", "御飯|ごはん", "在る|ある"].filter(by), []);
  assert.deepEqual(["終わる|おわる", "落とす|おとす", "下がる|さがる", "伯父さん|おじさん", "固い|かたい", "ご飯|ごはん", "有る|ある"].filter((k) => !by(k)), []);
  assert.deepEqual(by("終わる|おわる").fu, [["終", "お", 4], ["わる"]]);
});

// The English side asks for a word from its meaning, so two words with one first sense both look right ["red": 赤 and 赤い];
// rewording 875 of them away was the other way, and a small line under the meaning keeps the plain word as the headline.
test("words sharing a first sense each carry a descriptor, no two alike and none in Japanese, and every rewrite names a listed word", () => {
  const first = (m) => m.split(/[,;]/)[0].trim().toLowerCase();
  const groups = new Map();
  for (const w of vocab) groups.set(first(w.m), [...(groups.get(first(w.m)) || []), w]);
  const shared = [...groups.values()].filter((ws) => ws.length > 1);
  assert.ok(shared.length > 370, `${shared.length} groups`);
  assert.deepEqual(shared.flat().filter((w) => !w.d).map((w) => w.k), []);
  assert.deepEqual(shared.filter((ws) => new Set(ws.map((w) => w.d.trim().toLowerCase())).size < ws.length).map((ws) => ws.map((w) => `${w.k} ${w.d}`)), []);
  assert.deepEqual(vocab.filter((w) => "d" in w && (typeof w.d !== "string" || !w.d.trim() || /[぀-ヿ㐀-鿿々]/.test(w.d))).map((w) => w.k), []);
  assert.deepEqual(Object.keys(require("../tools/meanings.js")).filter((k) => !by(k)), []);
});

// "red (the colour)" and "who (polite)" told words apart inside the meaning; those notes moved to the descriptor line,
// while a bracket saying what a verb acts on is part of the meaning and stays [回す to turn (something)].
test("a sense or register note sits on the descriptor, a grammatical bracket stays in the meaning [赤 red with 'the colour'; 回す to turn (something)]", () => {
  const moved = ["赤|あか", "明日|あす", "どなた|どなた", "頂く|いただく", "おいでになる|おいでになる", "祖父|そふ", "薄い|うすい", "やる|やる", "十|とお"];
  assert.deepEqual(moved.map((k) => [by(k).m, !!by(k).d]), [["red", true], ["tomorrow", true], ["who", true], ["to receive; to eat or drink", true],
    ["to come, to go, to be", true], ["grandfather", true], ["thin; weak, pale", true], ["to do; to give (to pets, plants)", true], ["ten, ten years old", true]]);
  assert.deepEqual(["回す|まわす", "～だす|～だす", "支度する|したくする", "鳥|とり"].map((k) => by(k).m),
    ["to turn (something), to spin", "to start doing ~ (suddenly), to burst out ~ing", "to get ready, to prepare (oneself)", "bird; chicken (meat)"]);
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

test("a word's examples use its own kanji, unless it is usually kana, and a counter only after a number [no circle under ～円; 凄い in すごいですね]", () => {
  const strays = vocab.filter((w) => {
    if (w.uk) return false;
    const own = (w.w.replace(/する$/, "").match(/[一-鿿々]+/) || [""])[0];
    return w.ex.some(([jp]) => !jp.includes(own));
  });
  assert.deepEqual(strays.map((w) => w.k), []);
  assert.ok(by("～円|～えん").ex.every(([jp]) => /[0-9０-９一二三四五六七八九十百千万何]円/.test(jp)));
});

// 九 read く and 九 read きゅう were two cards side by side in the list, both asking 九 → nine on the same day.
test("a number with two readings for one meaning is one card on its everyday reading, the other on its back [九 = きゅう, also く in 九時]", () => {
  assert.deepEqual(["九|く", "四|し", "七|しち"].filter(by), []);
  assert.deepEqual(["九|きゅう", "四|よん", "七|なな"].map((k) => [by(k).m, by(k).alt[0][0]]), [["nine", "く"], ["four", "し"], ["seven", "しち"]]);
  assert.ok(by("七|なな").ex.some(([jp]) => jp.includes("七時")));
});

test("a spelling with two readings gets only sentences Tatoeba tags with its own [十時 is じゅうじ, so none for とお]", () => {
  assert.deepEqual(by("十|とお").ex.filter(([jp]) => jp.includes("十時")), []);
  assert.ok(by("十|じゅう").ex.some(([jp]) => jp.includes("十時")));
});

// Tatoeba files a kana word under its kanji spelling, so そこ, ここ and なぜ had no sentence while thousands use them [其処(そこ){そこ}].
test("a word the list spells in kana gets sentences filed under its kanji spelling, written in kana", () => {
  for (const k of ["そこ|そこ", "ここ|ここ", "なぜ|なぜ", "いつ|いつ", "できる|できる"]) {
    const w = by(k), said = w.t.includes("verb") ? w.w.slice(0, -1) : w.w;
    assert.ok(w.ex.length, k);
    assert.deepEqual(w.ex.filter(([jp]) => !jp.includes(said)), [], k);
  }
});

// 217 cards had no sentence, the ones Tatoeba files elsewhere or uses in another sense [そこ, お～, 味噌].
test("every word has an example sentence, written in tools/examples.js where Tatoeba has none [お～: お茶をどうぞ]", () => {
  assert.deepEqual(vocab.filter((w) => !w.ex.length).map((w) => w.k), []);
  assert.deepEqual(by("お～|お～").ex[0], ["お茶をどうぞ。", "Have some tea."]);
});

// お～ showed only "honorable ~": no kanji, no recording, and no sentence fits a prefix.
test("an affix lists list words built with it, and a compound verb the verb it comes from [お～: お茶; ～始める: 始める]", () => {
  assert.deepEqual(by("お～|お～").uses.slice(0, 2), ["お茶|おちゃ", "お金|おかね"]);
  assert.equal(by("～始める|～はじめる").root, "始める|はじめる");
  assert.deepEqual(vocab.flatMap((w) => [...(w.uses || []), ...(w.root ? [w.root] : [])]).filter((k) => !by(k)), []);
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

// A word's 🔊 plays data/words/<key>.mp3 when `au` says so, so a flag without its file is a silent button [2,055 words have one].
test("every word marked with a recording has its file, and every file belongs to a marked word", () => {
  const fs = require("fs"), path = require("path");
  const { wordClip } = require("../sync.js");
  const marked = vocab.filter((w) => w.au).map((w) => wordClip(w.k)).sort();
  const files = fs.readdirSync(path.join(__dirname, "../data/words")).map((f) => `data/words/${f}`).sort();
  assert.deepEqual(marked, files);
  // 929 N5/N4 files, 1,126 N3, and 四 よん and 七 なな, added after the first fetch.
  assert.equal(marked.length, 2057);
  assert.equal(by("後|あと").au, undefined);
});

// The shortest sentence won, so cards showed idioms: 飛ぶ a fuse blowing, 遊ぶ a machine lying idle, 青い "still green", 月 "a month".
test("an example uses the word as its card means it, by Tatoeba's sense tags [飛ぶ: a plane, not a fuse]", () => {
  assert.match(by("飛ぶ|とぶ").ex[0][0], /飛行機/);
  assert.match(by("遊ぶ|あそぶ").ex[0][0], /子供/);
  assert.match(by("青い|あおい").ex[0][0], /空/);
  assert.match(by("月|つき").ex[0][0], /月を回る/);
});

// A する verb glossed as its noun asked "marriage" on its English side and wanted 結婚する.
test("a する verb's English line is a verb, and a line names this word rather than a homophone [結婚する to get married; 優しい kind, not easy]", () => {
  const nouns = vocab.filter((w) => /する$/.test(w.w) && !/^(to |\(hon|\(hum|--)/.test(w.m));
  assert.deepEqual(nouns.map((w) => `${w.w} ${w.m}`), []);
  assert.doesNotMatch(by("優しい|やさしい").m, /easy/);
  assert.doesNotMatch(by("そこ|そこ").m, /bottom/);
});

// JMdict's first sense typed 大変 an adverb and 半分 an adverb, and gave four words no type at all.
test("a word JMdict types wrongly or not at all has its type set by hand [大変 な-adjective, ゆっくりと adverb]", () => {
  assert.deepEqual(["大変|たいへん", "半分|はんぶん", "ゆっくりと|ゆっくりと", "～杯|～はい"].map((k) => by(k).t), ["な-adjective", "noun", "adverb", "counter"]);
  assert.deepEqual(vocab.filter((w) => !w.t).map((w) => w.k), []);
});
