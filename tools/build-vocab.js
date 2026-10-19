// Builds data/vocab.json: the JLPT N5 and N4 words with JMdict's word type and frequency, furigana with KANJIDIC2's kanji level, and up to two Tatoeba examples [会う|あう = godan verb, nf26].
// Usage: node tools/build-vocab.js _data data/vocab.json
const fs = require("fs");
const path = require("path");
const MEANING = require("./meanings.js");
const { wordClip } = require("../sync.js");

const [dataDir, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("usage: node tools/build-vocab.js <download dir> <out json>");
  process.exit(1);
}
const read = (...p) => fs.readFileSync(path.join(dataDir, ...p), "utf8");

// One CSV line into fields, quotes kept apart from commas ["hot (objects), warm" is one field].
function csvRow(line) {
  const out = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false; else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}
const isKana = (s) => !!s && [...s].every((c) => /[぀-ヿ]/.test(c));
// The spelling JMdict knows, without the list's markers [～円 = 円, パート (タイム) = パートタイム, (〜を) とお = とお].
const bare = (s) => s.replace(/^\([^)]*\)\s*/, "").replace(/^[～〜]|[～〜]$/g, "").replace(/[\s()]/g, "");
// A reading that fits the spelling's kana, else the first [お金持ち takes おかねもち over かねもち].
const fits = (w, r) => new RegExp("^" + (w.match(/[぀-ヿ]+|[^぀-ヿ]+/g) || []).map((s) => (isKana(s) ? s : ".+?")).join("") + "$").test(r);
// One list row as the words it names [回る、回す = two words; いい; よい = いい; 運動|うんどうする = the suru verb 運動する].
function rowWords(w, r) {
  r = (r || w).replace(/^\([^)]*\)\s*/, "");
  if (isKana(w) && !isKana(bare(r))) [w, r] = [r, w];
  const ws = w.split("、"), rs = r.split("、");
  if (ws.length > 1 && ws.length === rs.length) return ws.flatMap((x, i) => rowWords(x, rs[i]));
  const wAlt = w.split(/;\s*/), rAlt = r.split(/;\s*/);
  if (wAlt.length > 1 && wAlt.length === rAlt.length) [w, r] = [wAlt[0], rAlt[0]];
  else { w = wAlt[0]; r = rAlt.find((x) => fits(bare(w), bare(x))) || rAlt[0]; }
  const suru = /\s*\(する\)$/.test(r) || (/する$/.test(r) && !/する$/.test(w)) || (/する$/.test(w) && w !== "する");
  if (suru) {
    w = w.replace(/\s*\(する\)$|する$/, "") + "する";
    r = r.replace(/\s*\(する\)$|する$/, "") + "する";
  }
  return [{ w, r, suru }];
}
// The list's dated or cut-short spellings as written today [終る = 終わる, 伯父 read おじさん = 伯父さん, 堅 read かたい = 固い].
const SPELL = { 終る: "終わる", 曲る: "曲がる", 落る: "落ちる", 楽む: "楽しむ", 落す: "落とす", 下る: "下がる", さ来年: "再来年", 舟: "船", 真中: "真ん中",
  伯父: "伯父さん", 堅: "固い", 御飯: "ご飯", 朝御飯: "朝ご飯", 昼御飯: "昼ご飯", 晩御飯: "晩ご飯" };
// A second spelling of a word already on the list [在る and 有る are one JMdict entry, ある].
const SKIP = new Set(["在る|ある"]);
const words = [];
const seen = new Set();
for (const lv of [5, 4]) {
  for (const line of read("jlpt", `n${lv}.csv`).split(/\r?\n/).slice(1).filter(Boolean)) {
    const [w0, r0, m] = csvRow(line);
    for (const { w: listed, r, suru } of rowWords(w0, r0)) {
      const w = SPELL[listed] || listed, k = `${w}|${r}`;
      if (seen.has(k) || SKIP.has(k)) continue;
      seen.add(k);
      words.push({ k, w, r, m, lv, suru });
    }
  }
}
// Everyday readings the list leaves out, placed after the reading it has [四 read し only, while four said alone is よん].
const ADD = [["四", "よん", "four", "四|し"], ["七", "なな", "seven", "七|しち"]];
for (const [w, r, m, after] of ADD) words.splice(words.findIndex((x) => x.k === after) + 1, 0, { k: `${w}|${r}`, w, r, m, lv: 5, suru: false });

// JMdict entries by spelling and by reading; pos carries over to later senses until one names its own.
const byKeb = new Map(), byReb = new Map();
const push = (map, key, e) => (map.get(key) || map.set(key, []).get(key)).push(e);
const tags = (block, tag) => [...block.matchAll(new RegExp(`<${tag}>([^<]*)</${tag}>`, "g"))].map((m) => m[1]);
for (const block of read("jmdict", "JMdict_e").split("<entry>").slice(1)) {
  const kebs = [...block.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)].map((m) => ({ text: tags(m[1], "keb")[0], pri: tags(m[1], "ke_pri") }));
  const rebs = [...block.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)].map((m) => ({ text: tags(m[1], "reb")[0], pri: tags(m[1], "re_pri") }));
  let pos = [];
  const senses = [...block.matchAll(/<sense>([\s\S]*?)<\/sense>/g)].map((m) => {
    const own = tags(m[1], "pos").map((p) => p.replace(/^&|;$/g, ""));
    if (own.length) pos = own;
    return { pos, gloss: tags(m[1], "gloss").join(" "), uk: tags(m[1], "misc").includes("&uk;") };
  });
  const e = { kebs, rebs, senses, kana: !kebs.length || senses.some((s) => s.uk) };
  kebs.forEach((x) => push(byKeb, x.text, e));
  rebs.forEach((x) => push(byReb, x.text, e));
}
// Frequency rank from JMdict's priority tags, lower is more common [nf01 = the 500 most frequent newspaper words].
const rank = (pri) => {
  const nf = pri.find((p) => /^nf\d+$/.test(p));
  if (nf) return +nf.slice(2);
  if (pri.some((p) => /1$/.test(p))) return 50;
  return pri.length ? 60 : 99;
};
// The content words of an English gloss [to dial/call (e.g., phone) = dial, call, phone].
const STOP = new Set(["to", "a", "an", "the", "of", "in", "on", "or", "and", "is", "be", "as", "at", "by", "for", "e", "g", "eg", "etc", "esp", "something", "someone"]);
const words_ = (s) => s.toLowerCase().split(/[^a-z]+/).filter((x) => x && !STOP.has(x));
const unmatched = [];
for (const word of words) {
  const strip = (s) => (word.suru ? bare(s).replace(/する$/, "") : bare(s));
  const w = strip(word.w), r = strip(word.r);
  word.base = w; word.baseR = r;
  const withReading = (list) => (list || []).filter((e) => e.rebs.some((x) => x.text === r));
  let cands = isKana(w) ? withReading(byReb.get(w)) : withReading(byKeb.get(w));
  if (!cands.length) cands = withReading(byReb.get(r));
  if (!cands.length) { unmatched.push(word.k); word.f = 99; word.pos = word.suru ? ["vs"] : []; continue; }
  const score = (e) => Math.min(rank(e.kebs.find((x) => x.text === w)?.pri || []), rank(e.rebs.find((x) => x.text === r).pri));
  // Homophones are told apart by the list's English, then by being a kana word, then by frequency [かける "to sit down" is 掛ける, not 翔る "to soar"].
  const meant = new Set(words_(word.m));
  const overlap = (e) => words_(e.senses.map((s) => s.gloss).join(" ")).filter((x) => meant.has(x)).length;
  const kanaFirst = (e) => (isKana(w) && e.kana ? 0 : 1);
  const e = cands.sort((a, b) => overlap(b) - overlap(a) || kanaFirst(a) - kanaFirst(b) || score(a) - score(b))[0];
  // A kana word is as common as its sound, whichever homophone it is [はい: the reading's best rank, not 50 for its untagged entry].
  word.f = isKana(w) ? Math.min(score(e), ...cands.map((x) => rank(x.rebs.find((y) => y.text === r).pri))) : score(e);
  // A suru verb conjugates as する whatever its noun's first sense says [勉強 is n, 勉強する is vs].
  word.pos = word.suru ? ["vs", ...e.senses[0].pos.filter((p) => p !== "vs")] : e.senses[0].pos;
  // A kana word's kanji spellings, which Tatoeba files its sentences under [そこ = 其処, 底].
  if (isKana(w)) word.kebs = e.kebs.map((x) => x.text);
  // JMdict's "usually written in kana" on the word's first sense [沢山 is mostly たくさん].
  word.uk = !isKana(w) && e.senses[0].uk;
  // The sense the card's English names, the first on a tie, so its example uses the word that way [一番 "best (most)" = sense 2].
  const card = new Set(words_(MEANING[word.k] || word.m));
  const hits = e.senses.map((s) => words_(s.gloss).filter((x) => card.has(x)).length);
  word.sense = hits.indexOf(Math.max(...hits)) + 1;
}
// Types JMdict's first sense gets wrong for the list's word, or has none for [大変 is mostly な, 半分 a noun, ゆっくりと unmatched].
const POS = {
  "大変|たいへん": ["adj-na", "adv"], "半分|はんぶん": ["n", "adv"], "不便|ふべん": ["adj-na", "n"], "余り|あまり": ["adv", "n"],
  "～くらい|～くらい": ["prt"], "～杯|～はい": ["ctr"], "キロ|キロ": ["n"], "ラジオカセ|ラジオカセ": ["n"], "ゆっくりと|ゆっくりと": ["adv"],
  "いくら～ても|いくら～ても": ["exp"], "～(て) しまう|～(て) しまう": ["exp"],
};
for (const word of words) if (POS[word.k]) word.pos = POS[word.k];

// Word types a learner names, from JMdict's part-of-speech codes [v5u = godan verb].
const TYPE = [[/^v5/, "godan verb"], [/^v1/, "ichidan verb"], [/^(vs-i|vk|vz)$/, "irregular verb"], [/^vs$/, "suru verb"],
  [/^adj-i$/, "い-adjective"], [/^adj-ix$/, "い-adjective"], [/^adj-na$/, "な-adjective"], [/^adj-no$/, "noun"], [/^n$/, "noun"],
  [/^pn$/, "pronoun"], [/^adj-pn$/, "pre-noun adjective"], [/^adv/, "adverb"], [/^exp$/, "expression"], [/^int$/, "interjection"], [/^ctr$/, "counter"],
  [/^prt$/, "particle"], [/^conj$/, "conjunction"], [/^suf$/, "suffix"], [/^pref$/, "prefix"], [/^num$/, "number"]];
const typeOf = (pos) => {
  for (const p of pos) for (const [re, name] of TYPE) if (re.test(p)) return name;
  return pos.length ? "word" : "";
};

// Each kanji's level on today's N scale, from KANJIDIC2's pre-2010 JLPT levels, 0 for none [old 4 = N5, old 3 = N4; 沢 is old 1].
const OLD_TO_N = { 4: 5, 3: 4, 2: 2, 1: 1 };
const kanjiLevel = new Map();
for (const m of read("kanjidic", "kanjidic2.xml").matchAll(/<literal>([^<]+)<\/literal>[\s\S]*?<\/character>/g)) {
  const old = m[0].match(/<jlpt>(\d)<\/jlpt>/);
  kanjiLevel.set(m[1], old ? OLD_TO_N[old[1]] : 0);
}
// A kanji run's level is its hardest kanji's, 々 repeating the one before [写真 = N4, 時々 = N5, 沢山 = 0].
const runLevel = (s) => Math.min(...[...s].filter((c) => c !== "々").map((c) => kanjiLevel.get(c) || 0));

const toHira = (s) => [...s].map((c) => (/[ァ-ヶ]/.test(c) ? String.fromCodePoint(c.codePointAt(0) - 0x60) : c)).join("");
const KANJI = /[一-鿿々]+/;
// Furigana over each kanji run with the run's level, the rest matched letter for letter against the reading [会う + あう = 会(あ)う at N5; ～円 = ～ then 円(えん)].
function furigana(w, r) {
  const runs = w.match(/[一-鿿々]+|[^一-鿿々]+/g);
  if (!runs.some((s) => KANJI.test(s))) return [[w]];
  const lit = (s) => toHira(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = toHira(r).match(new RegExp("^" + runs.map((s) => (KANJI.test(s) ? "(.+?)" : `(${lit(s)})`)).join("") + "$"));
  if (!m) return [[w, r, runLevel(w.match(/[一-鿿々]/g).join(""))]];
  return runs.map((s, i) => (KANJI.test(s) ? [s, m[i + 1], runLevel(s)] : [s]));
}

// Tatoeba sentences whose index names the word, shortest first [会う: 駅で会いましょう。].
const want = new Map(), wantKanji = new Map();
words.forEach((x) => { push(want, x.base, x); (x.kebs || []).forEach((k) => push(wantKanji, k, x)); });
// Sentences under the word's own spelling, and a kana word's under its kanji one, used only when the first has none [そこ: 其処(そこ){そこ}].
const found = new Map(), foundKanji = new Map();
const add = (map, word, hit) => (map.get(word.k) || map.set(word.k, []).get(word.k)).push(hit);
// A kana word's sentence filed under its kanji spelling and written in kana, a verb or adjective by its stem [其処(そこ){そこ} for そこ; 出来る{できない} for できる; 何時{なんじ} is not いつ].
const writtenAs = (x, said) => !!said && isKana(said) && (said === x.base || (/^(v[15k]|vs-i|adj-i)/.test(x.pos[0] || "") && said.startsWith(x.base.slice(0, -1))));
for (const line of read("tatoeba", "jpn_indices.csv").split(/\r?\n/)) {
  const [jid, eid, idx] = line.split("\t");
  if (!idx || eid === "-1") continue;
  for (const tok of idx.split(" ")) {
    const m = tok.match(/^([^([{~]+)(?:\(([^)]+)\))?(?:\[(\d+)\])?(?:\{([^}]+)\})?(~)?$/);
    if (!m) continue;
    const hit = { jid, eid, checked: !!m[5], sense: m[3] ? +m[3] : 0 };
    const kana = (wantKanji.get(m[1]) || []).filter((x) => (!m[2] || x.baseR === m[2]) && writtenAs(x, m[4]));
    if (kana.length === 1) add(foundKanji, kana[0], hit);
    // A spelling with two readings takes only sentences tagged with one, else the list's last word of it [七(しち) to しち, an untagged 七 to neither].
    const cands = (want.get(m[1]) || []).filter((x) => !m[2] || x.baseR === m[2]);
    const word = new Set(cands.map((x) => x.baseR)).size === 1 && cands.at(-1);
    if (!word || (!m[2] && m[1] !== word.baseR && isKana(m[1]))) continue;
    add(found, word, hit);
  }
}
const need = new Set([...found.values(), ...foundKanji.values()].flat().flatMap((x) => [x.jid, x.eid]));
const text = new Map();
for (const file of ["jpn_sentences.tsv", "eng_sentences.tsv"]) {
  for (const line of read("tatoeba", file).split(/\r?\n/)) {
    const tab = line.indexOf("\t");
    const id = line.slice(0, tab);
    if (need.has(id)) text.set(id, line.slice(line.indexOf("\t", tab + 1) + 1));
  }
}

// Examples picked by hand where no sense tag tells the right one, null for a word with none in its sense [起こす: not その木を起こした; 味噌's only one is slang].
const PICK = {
  "起こす|おこす": "６時に起こして下さい。", "見る|みる": "壁の絵を見て。", "生きる|いきる": "彼は七十歳まで生きた。", "下がる|さがる": "熱が下がった。",
  "見せる|みせる": "別のを見せて下さい。", "弱い|よわい": "月の光が弱い。", "砂|すな": "目に砂が入りました。", "時代|じだい": "彼女は高校時代内気でした。",
  "今週|こんしゅう": "今週は非常に忙しい。", "誰か|だれか": "誰か家にいますか。", "冷房|れいぼう": "その部屋は冷房がついていますか。", "色々|いろいろ": "色々ありがとう。",
  "味噌|みそ": null, "差す|さす": null,
  // Where the card's own sense brought in an idiom, a proverb or slang [押す: 太鼓判を押す; 人: 人に一癖].
  "押す|おす": "シャッターを押してくれますか。", "消す|けす": "寝る前に電気を消してください。", "浴びる|あびる": "姉は毎朝シャワーを浴びます。",
  "安い|やすい": "今日は魚が安い。", "頭|あたま": "アリスは頭に花をさしています。", "話|はなし": "彼は話をやめた。", "そう|そう": "そう思わない？",
  "下|した": "下に署名してください。", "引く|ひく": "カーテンがゆっくり引かれた。", "人|ひと": "この人は画家だ！", "倒れる|たおれる": "家は地震で倒れた。",
  "見える|みえる": "夜には星が見える。", "申す|もうす": "こちらはスミスと申します。ジョンソンさんはおいででしょうか。",
  "頂く|いただく": "「もっとコーヒーはいかがですか」「もう結構です。十分頂きました」", "差し上げる|さしあげる": "飲み物を差し上げましょうか。",
  "折る|おる": "落馬の結果足を折った。", "食事する|しょくじする": "彼女は食事をした。", "では|では": "では今晩またね、さようなら。",
  "～中|～ちゅう": "今勤務中です。", "一つ|ひとつ": "卵を一つ茹でてよ。", "～くらい|～くらい": "彼は４０歳くらいです。",
  // A card listing two senses, or a sense JMdict has renumbered since Tatoeba tagged it [鳥 bird, not 鳥 the roast; 焼く bakes in Tatoeba's sense 1].
  "鳥|とり": "鳥は卵を産む。", "焼く|やく": "私の母は毎朝パンを焼く。", "体|からだ": "私は体を洗った。", "物|もの": "通路に物を置くな。",
  "お酒|おさけ": "お酒は飲みますか。", "忘れる|わすれる": "電車に傘を忘れた。", "捨てる|すてる": "古い上着を捨てよう。", "だから|だから": "だから言っただろう。",
  "乗り物|のりもの": "車やバスやトラックはすべて乗り物である。", "止める|やめる": "喋るのをやめろ。", "運転する|うんてんする": "トムは車を運転した。",
  "結婚する|けっこんする": "二人は結婚した。", "凄い|すごい": "すごいですね。", "手袋|てぶくろ": "彼は手袋をはめている。",
  "お～|お～": null, "～時|～とき": null, "～目|～め": null, "内|うち": null,
  // Found under a kanji spelling in another sense [そうして "and then", not そうしてくれて "doing so"; うかがう "ask", Tatoeba's only "visit"].
  "そうして|そうして": null, "おる|おる": null, "うかがう|うかがう": null,
};
// The only sentences kept where the other found one is another word or sense [つける: not 仕事につけ, which is 就く; ～ころ: not 詩情ごころ].
const ONLY = {
  "うち|うち": ["うちに来ないか。"], "つける|つける": ["トムがテレビをつけたとたんにヒューズがとんだ。"], "～ころ|～ころ": ["最初のころを思い出す。"],
  "～おわる|～おわる": ["このペン、私が使いおわったら君に貸してあげるよ。"], "びっくりする|びっくりする": ["彼女はびっくりして叫んだ。"],
  "きっと|きっと": ["彼はきっと来る。"], "まだ|まだ": ["彼はまだ若い。"], "まずい|まずい": ["すき腹にまずいものなし。"],
};
const out = words.map((x) => {
  // The word's own kanji in the sentence [遭った is filed under 会う, 円 the circle under ～円].
  const own = (x.base.match(KANJI) || [""])[0];
  // A counter after a number, not the same kanji standing alone [100万円, not 完全な円].
  const used = /^[～〜]/.test(x.w) && own ? new RegExp(`[0-9０-９一二三四五六七八九十百千万何]${own}`) : { test: (t) => t.includes(own) };
  const usable = (map) => (map.get(x.k) || []).filter((s) => text.has(s.jid) && text.has(s.eid) && (used.test(text.get(s.jid)) || PICK[x.k] === text.get(s.jid)));
  let ex = usable(found);
  if (!ex.length) ex = usable(foundKanji);
  // A hand pick first, then Tatoeba's tag for the card's own sense, untagged next, another sense last, each checked (~) first [焼く: not こんがり焼こう, a tan].
  const fit = (s) => (PICK[x.k] === text.get(s.jid) ? -1 : s.sense === x.sense ? 0 : s.sense ? 2 : 1);
  const ranked = ex.sort((a, b) => fit(a) - fit(b) || b.checked - a.checked || text.get(a.jid).length - text.get(b.jid).length)
    .filter((s, i, all) => all.findIndex((t) => text.get(t.jid) === text.get(s.jid)) === i);
  ex = ranked.slice(0, 2).map((s) => [text.get(s.jid), text.get(s.eid)]);
  if (ONLY[x.k]) ex = ONLY[x.k].map((jp) => {
    const s = ranked.find((t) => text.get(t.jid) === jp);
    if (!s) throw new Error(`${x.k}: ${jp} isn't one of its sentences`);
    return [jp, text.get(s.eid)];
  });
  if (PICK[x.k] && ex[0]?.[0] !== PICK[x.k]) throw new Error(`${x.k}: the picked example isn't one of its sentences`);
  if (PICK[x.k] === null) ex = [];
  return { k: x.k, w: x.w, r: x.r, m: MEANING[x.k] || x.m, t: typeOf(x.pos), pos: x.pos, lv: x.lv, f: x.f, fu: furigana(x.w, x.r), ex, ...(x.uk && { uk: 1 }),
    // A WaniKani recording fetched by tools/fetch-wk-audio.js [929 words; none for 後 read あと, whose file is 後 read ご].
    ...(fs.existsSync(path.join(__dirname, "..", wordClip(x.k))) && { au: 1 }) };
});
// Numbers with two readings for one meaning, one card on the everyday reading with the other's uses and examples [九: きゅう, also く as in 九時].
const MERGE = [
  ["九|きゅう", "九|く", [["九時", "くじ", "nine o'clock"], ["九月", "くがつ", "September"]]],
  ["四|よん", "四|し", [["四月", "しがつ", "April"], ["四季", "しき", "the four seasons"]]],
  ["七|なな", "七|しち", [["七時", "しちじ", "seven o'clock"], ["七月", "しちがつ", "July"]]],
];
for (const [keep, drop, said] of MERGE) {
  const a = out.find((x) => x.k === keep), b = out.find((x) => x.k === drop);
  if (!a || !b) throw new Error(`${keep} or ${drop} isn't on the list`);
  a.alt = [[b.r, said]];
  a.ex = [...a.ex, ...b.ex].filter(([jp], i, all) => all.findIndex(([x]) => x === jp) === i).slice(0, 2);
  out.splice(out.indexOf(b), 1);
}
// List words built with an affix, and the verb a compound one comes from, for cards that are otherwise only their meaning [お～: お茶, お金; ～始める: 始める].
const USES = {
  "お～|お～": ["お茶|おちゃ", "お金|おかね", "お酒|おさけ", "お菓子|おかし", "お弁当|おべんとう", "お手洗い|おてあらい"],
  "御～|ご～": ["ご飯|ごはん", "ご主人|ごしゅじん", "ご存じ|ごぞんじ"],
  "～さん|～さん": ["お母さん|おかあさん", "お父さん|おとうさん", "皆さん|みなさん", "奥さん|おくさん"],
  "～ちゃん|～ちゃん": ["赤ちゃん|あかちゃん"],
  "～たち|～たち": ["友達|ともだち"],
  "～語|～ご": ["英語|えいご"],
  "～人|～じん": ["外国人|がいこくじん"],
  "～員|～いん": ["店員|てんいん", "公務員|こうむいん"],
  "～中|～ちゅう": ["途中|とちゅう"],
  "～度|～ど": ["一度|いちど", "今度|こんど"],
  "～日|～にち": ["一日|いちにち"],
  "～年|～ねん": ["来年|らいねん", "去年|きょねん", "再来年|さらいねん"],
  "～番|～ばん": ["一番|いちばん"],
  "～屋|～や": ["八百屋|やおや", "床屋|とこや"],
  "～会|～かい": ["展覧会|てんらんかい"],
  "～代|～だい": ["時代|じだい"],
  "～月|～つき": ["一月|ひとつき"],
  "～杯|～はい": ["一杯|いっぱい"],
  "～だけ|～だけ": ["できるだけ|できるだけ"],
  "～ころ|～ころ": ["この頃|このごろ"],
};
const ROOT = { "～始める|～はじめる": "始める|はじめる", "～続ける|～つづける": "続ける|つづける", "～だす|～だす": "出す|だす", "～おわる|～おわる": "終わる|おわる", "～すぎ|～すぎ": "過ぎる|すぎる" };
const listed = new Set(out.map((x) => x.k));
for (const [k, ks] of [...Object.entries(USES), ...Object.entries(ROOT).map(([k, r]) => [k, [r]])]) {
  const missing = [k, ...ks].filter((x) => !listed.has(x));
  if (missing.length) throw new Error(`${k}: ${missing.join(", ")} isn't on the list`);
}
for (const x of out) {
  if (USES[x.k]) x.uses = USES[x.k];
  if (ROOT[x.k]) x.root = ROOT[x.k];
}
// Most common first within a level, the list's own order breaking ties [N5 before any N4].
const order = new Map(out.map((x, i) => [x, i]));
out.sort((a, b) => b.lv - a.lv || a.f - b.f || order.get(a) - order.get(b));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
const noEx = out.filter((x) => !x.ex.length).length;
console.log(`${out.length} words (N5 ${out.filter((x) => x.lv === 5).length}, N4 ${out.filter((x) => x.lv === 4).length}), ${unmatched.length} not in JMdict, ${noEx} without examples -> ${outFile} (${fs.statSync(outFile).size} bytes)`);
if (unmatched.length) console.log("not in JMdict:", unmatched.join(" "));
