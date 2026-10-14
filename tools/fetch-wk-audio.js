// Fetches WaniKani's old word recordings for the list's words into data/words/, named by wordClip [会う|あう = data/words/4f1a-3046-7c-3042-3046.mp3].
// Usage: node tools/fetch-wk-audio.js data/vocab.json _data/wk-audio
const fs = require("fs");
const path = require("path");
const { wordClip } = require("../sync.js");

const [vocabFile, rawDir] = process.argv.slice(2);
if (!rawDir) {
  console.error("usage: node tools/fetch-wk-audio.js <vocab json> <download dir>");
  process.exit(1);
}
const REPO = "tofugu/japanese-vocabulary-pronunciation-audio";
const root = path.join(__dirname, "..");
const words = JSON.parse(fs.readFileSync(vocabFile, "utf8"));

(async () => {
  fs.mkdirSync(rawDir, { recursive: true });
  const treeFile = path.join(rawDir, "tree.json");
  if (!fs.existsSync(treeFile)) {
    const r = await fetch(`https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`);
    if (!r.ok) throw new Error(`tree: HTTP ${r.status}`);
    fs.writeFileSync(treeFile, await r.text());
  }
  // Recordings by "word【reading】", the list's ～ written 〜 as the repo does [～円|えん = 〜円【えん】].
  const files = new Set(JSON.parse(fs.readFileSync(treeFile, "utf8")).tree.map((x) => x.path).filter((p) => /^lib\/mp3\/.+\.mp3$/.test(p)));
  const want = words.map((w) => [w, `lib/mp3/${w.w.replace(/～/g, "〜")}【${w.r.replace(/～/g, "〜")}】.mp3`]).filter(([, p]) => files.has(p));
  fs.mkdirSync(path.join(root, path.dirname(wordClip("x"))), { recursive: true });
  let fetched = 0;
  for (const [w, p] of want) {
    const raw = path.join(rawDir, path.basename(p));
    if (!fs.existsSync(raw)) {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/HEAD/${p.split("/").map(encodeURIComponent).join("/")}`);
      if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
      fs.writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
      fetched++;
    }
    fs.copyFileSync(raw, path.join(root, wordClip(w.k)));
  }
  const bytes = want.reduce((n, [w]) => n + fs.statSync(path.join(root, wordClip(w.k))).size, 0);
  console.log(`${want.length} of ${words.length} words have a recording (${fetched} downloaded now), ${bytes} bytes`);
})().catch((e) => { console.error(e.message); process.exit(1); });
