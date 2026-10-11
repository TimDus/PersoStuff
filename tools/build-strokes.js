// Builds data/strokes.json from KanjiVG: each kana character's stroke paths in drawing order, and where its numbers sit [あ = 3 paths, 3 numbers].
// Usage: node tools/build-strokes.js _data/kanjivg/main/kanji data/strokes.json
const fs = require("fs");
const path = require("path");

const [svgDir, outFile] = process.argv.slice(2);
if (!outFile) {
  console.error("usage: node tools/build-strokes.js <kanjivg kanji dir> <out json>");
  process.exit(1);
}
global.window = {};
require("../data.js");
const { KANA } = window.HIRAGANA;

const out = {};
for (const c of new Set(KANA.flatMap((k) => [...k.kana]))) {
  const file = path.join(svgDir, `${c.codePointAt(0).toString(16).padStart(5, "0")}.svg`);
  if (!fs.existsSync(file)) throw new Error(`KanjiVG has no ${c} (${file})`);
  const svg = fs.readFileSync(file, "utf8");
  // Paths come in drawing order [all 6,703 files list -s1, -s2… in sequence].
  const d = [...svg.matchAll(/<path id="kvg:[0-9a-f]+-s\d+"[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const n = [...svg.matchAll(/<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">\d+<\/text>/g)].map((m) => [+m[1], +m[2]]);
  if (!d.length || d.length !== n.length) throw new Error(`${c}: ${d.length} strokes, ${n.length} numbers`);
  out[c] = { d, n };
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`${Object.keys(out).length} characters -> ${outFile} (${fs.statSync(outFile).size} bytes)`);
