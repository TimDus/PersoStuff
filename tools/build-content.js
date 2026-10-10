// Builds content/ for the private Supabase bucket: worksheets.json, audio and illustrations renamed to ASCII [あ.mp3 = audio/3042.mp3, か.png = img/304b].
// Usage: node tools/build-content.js _research audio images content
const fs = require("fs");
const path = require("path");
const { clipPath, imagePath } = require("../sync.js");

const [srcDir, audioDir, imageDir, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node tools/build-content.js <worksheet txt dir> <audio dir> <image dir> <out dir>");
  process.exit(1);
}

const meta = [["vowels", "Vowels"], ["k", "K-column"], ["s", "S-column"], ["t", "T-column"], ["nh", "N & H-columns"],
  ["my", "M & Y-columns"], ["rwn", "R, W & N-columns"], ["dakuten", "Dakuten & Han-dakuten"], ["youon", "Combination kana"]];
const read = (key) => fs.readFileSync(path.join(srcDir, `${key}.txt`), "utf8").replace(/^\uFEFF/, "");

const sheets = meta.map(([id, title]) => {
  const text = read(id);
  const rounds = text.split(/Take a \d+ minute break/)
    .map((part) => part.split(/\r?\n/).filter((l) => l.startsWith("\t") && l.trim()).map((l) => l.trim()))
    .filter((cells) => cells.length);
  return { id, title, instructions: text.split(/\r?\n/)[0].trim(), rounds };
});
const reading = ["p1", "p2"].map((key) => read(key).split(/\r?\n/).map((l) => l.trim())
  .filter((l) => l && /[\u3040-\u309f]/.test(l) && !/[A-Za-z]/.test(l)));

fs.mkdirSync(path.join(outDir, "audio"), { recursive: true });
fs.mkdirSync(path.join(outDir, "img"), { recursive: true });
fs.writeFileSync(path.join(outDir, "worksheets.json"), JSON.stringify({ sheets, reading }));

let clips = 0;
for (const file of fs.readdirSync(audioDir).filter((f) => f.endsWith(".mp3"))) {
  fs.copyFileSync(path.join(audioDir, file), path.join(outDir, clipPath(file.slice(0, -4))));
  clips++;
}
let images = 0;
for (const file of fs.readdirSync(imageDir).filter((f) => /\.(png|jpg)$/.test(f))) {
  fs.copyFileSync(path.join(imageDir, file), path.join(outDir, imagePath(file.replace(/\.(png|jpg)$/, ""))));
  images++;
}
console.log(`${sheets.length} worksheets [${sheets.map((s) => s.rounds.length).join(",")} rounds], ${reading.map((r) => r.length).join("+")} sentences, ${clips} clips, ${images} images -> ${outDir}`);
