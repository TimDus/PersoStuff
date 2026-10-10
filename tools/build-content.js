// Builds content/ for the private Supabase bucket: worksheets.json plus audio clips renamed to ASCII [あ.mp3 = audio/3042.mp3].
// Usage: node tools/build-content.js _research audio content
const fs = require("fs");
const path = require("path");
const { clipPath } = require("../sync.js");

const [srcDir, audioDir, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node tools/build-content.js <worksheet txt dir> <audio dir> <out dir>");
  process.exit(1);
}

const meta = [["vowels", "Vowels"], ["k", "K-column"], ["s", "S-column"], ["t", "T-column"], ["nh", "N & H-columns"],
  ["my", "M & Y-columns"], ["rwn", "R, W & N-columns"], ["dakuten", "Dakuten & Han-dakuten"], ["youon", "Combination kana"]];
const read = (key) => fs.readFileSync(path.join(srcDir, `${key}.txt`), "utf8").replace(/^﻿/, "");

const sheets = meta.map(([id, title]) => {
  const text = read(id);
  const rounds = text.split(/Take a \d+ minute break/)
    .map((part) => part.split(/\r?\n/).filter((l) => l.startsWith("\t") && l.trim()).map((l) => l.trim()))
    .filter((cells) => cells.length);
  return { id, title, instructions: text.split(/\r?\n/)[0].trim(), rounds };
});
const reading = ["p1", "p2"].map((key) => read(key).split(/\r?\n/).map((l) => l.trim())
  .filter((l) => l && /[぀-ゟ]/.test(l) && !/[A-Za-z]/.test(l)));

fs.mkdirSync(path.join(outDir, "audio"), { recursive: true });
fs.writeFileSync(path.join(outDir, "worksheets.json"), JSON.stringify({ sheets, reading }));

let clips = 0;
for (const file of fs.readdirSync(audioDir).filter((f) => f.endsWith(".mp3"))) {
  fs.copyFileSync(path.join(audioDir, file), path.join(outDir, clipPath(file.slice(0, -4))));
  clips++;
}
console.log(`${sheets.length} worksheets [${sheets.map((s) => s.rounds.length).join(",")} rounds], ${reading.map((r) => r.length).join("+")} sentences, ${clips} clips -> ${outDir}`);
