// Builds data/kanji.json (KANJIDIC2's meanings, stroke count, level and readings, KanjiVG's components) and data/kanji-strokes.json (KanjiVG's strokes) for every kanji in the word list [大 = "large, big", 3 strokes, N5].
// Usage: node tools/build-kanji.js _data data/vocab.json data
const fs = require("fs");
const path = require("path");

const [dataDir, vocabFile, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node tools/build-kanji.js <download dir> <vocab json> <out dir>");
  process.exit(1);
}
const words = JSON.parse(fs.readFileSync(vocabFile, "utf8"));
const listed = [...new Set(words.flatMap(require("../kanji.js").kanjiOf))];
const want = new Set(listed);

// Today's N level from KANJIDIC2's pre-2010 JLPT level, 0 for none, as build-vocab.js reads it [old 4 = N5].
const OLD_TO_N = { 4: 5, 3: 4, 2: 2, 1: 1 };
// A kun reading a listed word spells with the kanji alone [生きる = [生, い] then きる, so い.きる].
const used = (c, kun) => {
  const [stem, oku = ""] = kun.split(".");
  return words.some((w) => w.fu.some(([text, rt], i) => text === c && rt === stem && (w.fu[i + 1]?.[0] || "").startsWith(oku[0] || "")));
};
// Up to 3 kun, the word list's first, one per stem and spelling [生: い.きる, う.まれる, お.う, not い.かす or うま.れる].
function kunOf(c, all) {
  const seen = new Set(), out = [];
  for (const r of [...all.filter((r) => used(c, r)), ...all.filter((r) => !used(c, r))]) {
    const keys = [r.split(".")[0], r.replace(".", "")];
    if (!keys.some((k) => seen.has(k))) out.push(r);
    keys.forEach((k) => seen.add(k));
  }
  return out.slice(0, 3);
}
const kanji = {};
for (const m of fs.readFileSync(path.join(dataDir, "kanjidic", "kanjidic2.xml"), "utf8").matchAll(/<literal>([^<]+)<\/literal>[\s\S]*?<\/character>/g)) {
  if (!want.has(m[1])) continue;
  const old = m[0].match(/<jlpt>(\d)<\/jlpt>/);
  // English meanings only, the first two [大: large, big; French and Spanish carry m_lang].
  const meanings = [...m[0].matchAll(/<meaning>([^<]+)<\/meaning>/g)].map((x) => x[1]).slice(0, 2);
  // Readings without the affix forms [大's おお- and -おお.いに], on in KANJIDIC2's order.
  const read = (type) => [...m[0].matchAll(new RegExp(`<reading r_type="${type}">([^<]+)</reading>`, "g"))].map((x) => x[1]).filter((r) => !r.includes("-"));
  kanji[m[1]] = { m: meanings.join(", "), sc: +m[0].match(/<stroke_count>(\d+)<\/stroke_count>/)[1], lv: old ? OLD_TO_N[old[1]] : 0,
    on: read("ja_on").slice(0, 3), kun: kunOf(m[1], read("ja_kun")) };
}

const missing = listed.filter((c) => !kanji[c]);
if (missing.length) throw new Error(`KANJIDIC2 has no ${missing.join("")}`);

// A tenth of a unit in the 109-unit box, rejoined after rounding as a minus that rounds away was the only separator
// [2.7-0.04 = 2.7,0, not 2.70; relative curves drift at most 0.36 units, 0.4 px in the 120 px stroke order; 740 KB unrounded].
const round = (d) => d.replace(/([a-zA-Z])([^a-zA-Z]*)/g, (_, cmd, args) => cmd + (args.match(/-?(?:\d+\.?\d*|\.\d+)/g) || [])
  .map((n) => String(Math.round(+n * 10) / 10 || 0)).reduce((s, n, i) => s + (i && n[0] !== "-" ? "," : "") + n, ""));
const strokes = {};
for (const c of listed) {
  const file = path.join(dataDir, "kanjivg", "main", "kanji", `${c.codePointAt(0).toString(16).padStart(5, "0")}.svg`);
  if (!fs.existsSync(file)) throw new Error(`KanjiVG has no ${c} (${file})`);
  const svg = fs.readFileSync(file, "utf8");
  const d = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s\d+"[^>]*\sd="([^"]+)"/g)].map((m) => round(m[1]));
  const n = [...svg.matchAll(/<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">\d+<\/text>/g)].map((m) => [+m[1], +m[2]]);
  if (!d.length || d.length !== n.length) throw new Error(`${c}: ${d.length} strokes, ${n.length} numbers`);
  // The outermost named groups under the kanji's own, through unnamed ones [学: ⺍ and 冖 inside an unnamed top, then 子].
  const c_ = [];
  const open = [];
  for (const g of svg.matchAll(/<g\b([^>]*)>|<\/g>/g)) {
    if (g[0] === "</g>") { open.pop(); continue; }
    const el = g[1].match(/kvg:element="([^"]+)"/)?.[1];
    const inside = open.length >= 2 && !open.slice(2).some(Boolean);
    if (el && inside && !c_.includes(el)) c_.push(el);
    open.push(el || null);
  }
  strokes[c] = { d, n };
  kanji[c].c = c_;
}
const off = listed.filter((c) => strokes[c].d.length !== kanji[c].sc);

fs.mkdirSync(outDir, { recursive: true });
for (const [name, data] of [["kanji.json", kanji], ["kanji-strokes.json", strokes]]) {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(data));
  console.log(`${Object.keys(data).length} kanji -> ${path.join(outDir, name)} (${fs.statSync(path.join(outDir, name)).size} bytes)`);
}
if (off.length) console.log(`stroke count differs from KANJIDIC2: ${off.map((c) => `${c} ${strokes[c].d.length}/${kanji[c].sc}`).join(", ")}`);
