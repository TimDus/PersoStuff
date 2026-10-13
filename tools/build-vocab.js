// Builds data/vocab.json: the JLPT N5 and N4 words with JMdict's word type and frequency, furigana with KANJIDIC2's kanji level, and up to two Tatoeba examples [会う|あう = godan verb, nf26].
// Usage: node tools/build-vocab.js _data data/vocab.json
const fs = require("fs");
const path = require("path");
const MEANING = require("./meanings.js");

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
  // JMdict's "usually written in kana" on the word's first sense [沢山 is mostly たくさん].
  word.uk = !isKana(w) && e.senses[0].uk;
}

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
const want = new Map(words.map((x) => [x.base, x]));
const found = new Map();
for (const line of read("tatoeba", "jpn_indices.csv").split(/\r?\n/)) {
  const [jid, eid, idx] = line.split("\t");
  if (!idx || eid === "-1") continue;
  for (const tok of idx.split(" ")) {
    const m = tok.match(/^([^([{~]+)(?:\(([^)]+)\))?(?:\[\d+\])?(?:\{[^}]+\})?(~)?$/);
    if (!m) continue;
    const word = want.get(m[1]);
    if (!word || (m[2] && m[2] !== word.baseR) || (!m[2] && m[1] !== word.baseR && isKana(m[1]))) continue;
    (found.get(word.k) || found.set(word.k, []).get(word.k)).push({ jid, eid, checked: !!m[3] });
  }
}
const need = new Set([...found.values()].flat().flatMap((x) => [x.jid, x.eid]));
const text = new Map();
for (const file of ["jpn_sentences.tsv", "eng_sentences.tsv"]) {
  for (const line of read("tatoeba", file).split(/\r?\n/)) {
    const tab = line.indexOf("\t");
    const id = line.slice(0, tab);
    if (need.has(id)) text.set(id, line.slice(line.indexOf("\t", tab + 1) + 1));
  }
}

const out = words.map((x) => {
  // The word's own kanji in the sentence, and only checked (~) ones when Tatoeba has any [遭った is filed under 会う, 円 the circle under ～円].
  const own = (x.base.match(KANJI) || [""])[0];
  // A counter after a number, not the same kanji standing alone [100万円, not 完全な円].
  const used = /^[～〜]/.test(x.w) && own ? new RegExp(`[0-9０-９一二三四五六七八九十百千万何]${own}`) : { test: (t) => t.includes(own) };
  let ex = (found.get(x.k) || []).filter((s) => text.has(s.jid) && text.has(s.eid) && used.test(text.get(s.jid)));
  if (ex.some((s) => s.checked)) ex = ex.filter((s) => s.checked);
  ex = ex.sort((a, b) => text.get(a.jid).length - text.get(b.jid).length)
    .filter((s, i, all) => all.findIndex((t) => text.get(t.jid) === text.get(s.jid)) === i)
    .slice(0, 2).map((s) => [text.get(s.jid), text.get(s.eid)]);
  return { k: x.k, w: x.w, r: x.r, m: MEANING[x.k] || x.m, t: typeOf(x.pos), pos: x.pos, lv: x.lv, f: x.f, fu: furigana(x.w, x.r), ex, ...(x.uk && { uk: 1 }) };
});
// Most common first within a level, the list's own order breaking ties [N5 before any N4].
const order = new Map(out.map((x, i) => [x, i]));
out.sort((a, b) => b.lv - a.lv || a.f - b.f || order.get(a) - order.get(b));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
const noEx = out.filter((x) => !x.ex.length).length;
console.log(`${out.length} words (N5 ${out.filter((x) => x.lv === 5).length}, N4 ${out.filter((x) => x.lv === 4).length}), ${unmatched.length} not in JMdict, ${noEx} without examples -> ${outFile} (${fs.statSync(outFile).size} bytes)`);
if (unmatched.length) console.log("not in JMdict:", unmatched.join(" "));
