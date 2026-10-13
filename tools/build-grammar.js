// Builds data/grammar.json from tools/grammar-points.js: each sentence as furigana runs with KANJIDIC2's kanji level, its gap and every answer that fits it.
// Usage: node tools/build-grammar.js _data data/vocab.json data/grammar.json
// Fails on a gap that isn't its point's form of the hint word [話す shown, 言ってください in the gap], so a copying slip never ships.
const fs = require("fs");
const path = require("path");
const { conjugate } = require("../conj.js");
const { POINTS, VARIANTS, SENTENCES } = require("./grammar-points.js");

const [dataDir, vocabFile, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("usage: node tools/build-grammar.js <download dir> <vocab json> <out json>");
  process.exit(1);
}
const vocab = new Map(JSON.parse(fs.readFileSync(vocabFile, "utf8")).map((w) => [w.k, w]));

// Each kanji's level on today's N scale, as build-vocab.js reads it [old 4 = N5, old 3 = N4, none = 0].
const OLD_TO_N = { 4: 5, 3: 4, 2: 2, 1: 1 };
const kanjiLevel = new Map();
for (const m of fs.readFileSync(path.join(dataDir, "kanjidic", "kanjidic2.xml"), "utf8").matchAll(/<literal>([^<]+)<\/literal>[\s\S]*?<\/character>/g)) {
  const old = m[0].match(/<jlpt>(\d)<\/jlpt>/);
  kanjiLevel.set(m[1], old ? OLD_TO_N[old[1]] : 0);
}
const runLevel = (s) => Math.min(...[...s].filter((c) => c !== "々").map((c) => kanjiLevel.get(c) || 0));
const KANJI = /[一-鿿々]/;

// Ruby text as runs, a kanji run with its reading and level, the gap as null [{私|わたし}＿ = [私, わたし, 5], null].
function runs(s) {
  const out = [];
  for (const m of s.matchAll(/\{([^|}]+)\|([^}]+)\}|＿|[^{＿]+/g)) {
    if (m[1]) out.push([m[1], m[2], runLevel(m[1])]);
    else if (m[0] === "＿") out.push(null);
    else if (KANJI.test(m[0])) throw new Error(`kanji without a reading: ${m[0]} in ${s}`);
    else out.push([m[0]]);
  }
  return out;
}
const spell = (fu) => ({ w: fu.map(([t]) => t).join(""), r: fu.map(([t, rt]) => rt || t).join(""), fu });
// Runs for a spelling and its reading, the kana between kanji matched letter for letter, as build-vocab.js does [行きましょうか + いきましょうか = 行|い, きましょうか].
function furigana(w, r) {
  const parts = w.match(/[一-鿿々]+|[^一-鿿々]+/g);
  const lit = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = r.match(new RegExp("^" + parts.map((s) => (KANJI.test(s) ? "(.+?)" : `(${lit(s)})`)).join("") + "$"));
  if (!m) throw new Error(`can't split ${w} by ${r}`);
  return parts.map((s, i) => (KANJI.test(s) ? [s, m[i + 1], runLevel(s)] : [s]));
}

const errors = [];
const sentences = [];
for (const point of POINTS) {
  for (const [s, gapText, hintKey, en, extra, src] of SENTENCES[point.id] || []) {
    const fu = runs(s);
    const gapFu = runs(gapText);
    const gap = { fu: gapFu, ...spell(gapFu) };
    const word = hintKey && vocab.get(hintKey);
    if (hintKey && !word) { errors.push(`${point.id}: ${hintKey} is not in the word list`); continue; }
    const made = VARIANTS[point.id]((form) => conjugate(word, form), word);
    // The gap's own form among the point's, by reading and in either spelling [やんでいません = 止んでいません].
    const own = made.find((m) => m.r === gap.r && (m.w === gap.w || m.r === gap.w));
    if (!own) { errors.push(`${point.id}: ${gap.w} (${gap.r}) is not a form of ${word ? word.w : "the point"} [${en}]`); continue; }
    // A plain answer for a polite one only where nothing follows but punctuation [読んでいます。 takes 読んでいる; いますか doesn't take いるか].
    const end = /^[。！？!?」]*$/.test(s.slice(s.indexOf("＿") + 1));
    const same = made.filter((m) => m.g === own.g && (m.pol === own.pol || end));
    const ok = [...same, ...extra.map((x) => spell(runs(x)))]
      .filter((m, i, all) => m.w !== gap.w && all.findIndex((x) => x.w === m.w) === i)
      .map(({ w, r, fu: runs_ }) => ({ w, r, fu: runs_ || furigana(w, r) }));
    // A word usually written in kana is hinted in kana [掛ける shows かける].
    const hint = word && { k: word.k, w: word.w, r: word.r, fu: word.uk ? [[word.r]] : word.fu };
    sentences.push({ id: sentences.length, p: point.id, fu, gap, hint, en, ok, src });
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ points: POINTS, sentences }));
console.log(`${POINTS.length} points, ${sentences.length} sentences -> ${outFile} (${fs.statSync(outFile).size} bytes)`);
