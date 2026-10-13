// Lists Tatoeba candidates for each grammar point, as lines ready to keep in tools/grammar-points.js after a read-through.
// Usage: node tools/pick-grammar.js _data data/vocab.json <out dir>   (writes one <point>.txt per point)
// Plain text search over-matches [日曜日の３時にうかがいます for がいます], so nothing it prints ships unread.
const fs = require("fs");
const path = require("path");
const { PICK } = require("./grammar-points.js");

const [dataDir, vocabFile, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node tools/pick-grammar.js <download dir> <vocab json> <out dir>");
  process.exit(1);
}
const read = (...p) => fs.readFileSync(path.join(dataDir, ...p), "utf8");
const vocab = JSON.parse(fs.readFileSync(vocabFile, "utf8"));
const KANJI = /[一-鿿々]/;
const isKana = (s) => [...s].every((c) => /[぀-ヿー]/.test(c));
const toHira = (s) => [...s].map((c) => (/[ァ-ヶ]/.test(c) ? String.fromCodePoint(c.codePointAt(0) - 0x60) : c)).join("");

// A spelling's first JMdict reading [方 = かた, so the index's own (ほう) wins where it gives one].
const readingOf = new Map();
for (const w of vocab) if (!readingOf.has(w.w)) readingOf.set(w.w, w.r);
for (const block of read("jmdict", "JMdict_e").split("<entry>").slice(1)) {
  const reb = /<reb>([^<]+)<\/reb>/.exec(block);
  for (const m of block.matchAll(/<keb>([^<]+)<\/keb>/g)) if (reb && !readingOf.has(m[1])) readingOf.set(m[1], reb[1]);
}
const vocabBy = new Map(vocab.map((w) => [w.w, w]));
// A token's list word, through the index's old spellings by their reading [為る(する) = する, 居る(いる) = いる].
const listed = (t) => vocabBy.get(t.head) || (t.reading && vocab.find((w) => w.w === t.reading && w.r === t.reading));

// The kanji runs of a surface form with their readings, from its headword's reading [食べたい from 食べる/たべる = 食|た].
function rubyOf(surface, head, reading, after = "") {
  if (!KANJI.test(surface)) return surface;
  if (!reading) return null;
  const runs = (s) => s.match(/[一-鿿々]+|[^一-鿿々]+/g);
  const hr = runs(head), sr = runs(surface);
  const lit = (s) => toHira(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = toHira(reading).match(new RegExp("^" + hr.map((s) => (KANJI.test(s) ? "(.+?)" : `(${lit(s)})`)).join("") + "$"));
  if (!m) return null;
  const kanjiReadings = hr.map((s, i) => (KANJI.test(s) ? [s, m[i + 1]] : null)).filter(Boolean);
  const out = [];
  let k = 0;
  for (const s of sr) {
    if (!KANJI.test(s)) { out.push(s); continue; }
    const kr = kanjiReadings[k++];
    if (!kr || kr[0] !== s) return null;
    // 来 reads by what follows [来ない こ, 来て き, 来る く].
    let rt = kr[1];
    const next = sr[out.length + 1] || after;
    if (s === "来" && head === "来る") rt = /^[なさよいら]/.test(next) ? "こ" : /^る/.test(next) ? "く" : "き";
    out.push(`{${s}|${rt}}`);
  }
  return out.join("");
}

const jp = new Map(), en = new Map();
for (const [file, map] of [["jpn_sentences.tsv", jp], ["eng_sentences.tsv", en]]) {
  for (const line of read("tatoeba", file).split(/\r?\n/)) {
    const [id, , t] = line.split("\t");
    if (t) map.set(id, t);
  }
}

// One indexed sentence as ruby, its tokens and whether all are list words, or null where a kanji goes unread [私(わたし) は 学生 です = {私|わたし}は{学生|がくせい}です].
function analyse(text, idx) {
  let at = 0, out = "", allListed = true, checked = false;
  const tokens = [];
  for (const tok of idx.split(" ")) {
    const m = tok.match(/^([^([{~]+)(?:\(([^)#]+)\))?(?:\(#\d+\))?(?:\[\d+\])?(?:\{([^}]+)\})?(~)?$/);
    if (!m) return null;
    const [, head, rd, surf, ok] = m;
    if (ok) checked = true;
    const surface = surf || head;
    const pos = text.indexOf(surface, at);
    if (pos < 0) return null;
    const gapText = text.slice(at, pos);
    if (KANJI.test(gapText)) return null;
    out += gapText;
    const reading = rd || (isKana(head) ? head : readingOf.get(head));
    const ruby = rubyOf(surface, head, reading, text.slice(pos + surface.length));
    if (ruby === null) return null;
    tokens.push({ head, reading, surface, start: pos, end: pos + surface.length, rubyStart: out.length });
    out += ruby;
    at = pos + surface.length;
    if (!isKana(head) && !listed({ head, reading }) && !/^[0-9０-９]/.test(head)) allListed = false;
  }
  if (KANJI.test(text.slice(at))) return null;
  out += text.slice(at);
  return { ruby: out, tokens, allListed, checked };
}

// Ruby for a stretch of the plain text [start, end), cut anywhere but inside a kanji run [方|ほう がいい cut after が].
function rubySlice(a, start, end) {
  let out = "", at = 0;
  for (const m of a.ruby.matchAll(/\{([^|}]+)\|([^}]+)\}|[^{]/g)) {
    const len = m[1] ? m[1].length : 1, from = at;
    at += len;
    if (at <= start || from >= end) continue;
    if (from < start || at > end) return null;
    out += m[0];
  }
  return out;
}

const results = Object.fromEntries(Object.keys(PICK).map((p) => [p, []]));
for (const line of read("tatoeba", "jpn_indices.csv").split(/\r?\n/)) {
  const [jid, eid, idx] = line.split("\t");
  if (!idx || eid === "-1" || !jp.has(jid) || !en.has(eid)) continue;
  const text = jp.get(jid);
  if (text.length > 30 || /[a-zA-Z0-9Ａ-Ｚａ-ｚ]/.test(text)) continue;
  for (const [p, rule] of Object.entries(PICK)) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const a = analyse(text, idx);
    if (!a) continue;
    a.text = text;
    // The gap starts at the word the pattern hangs on, or at the pattern itself [話してください; があります].
    let start = m.index;
    let hint = null;
    if (rule.word) {
      // The word the match starts inside, else the one before it [帰り ましょうか = 帰る; 帰りましょうか as one token = the same].
      let i = a.tokens.findIndex((x) => x.start < m.index && x.end > m.index);
      if (i < 0) i = a.tokens.findLastIndex((x) => x.end <= m.index);
      // Past a copula or の to the word itself [病気 な ので = 病気].
      while (i > 0 && /^(だ|です|の|ん)$/.test(a.tokens[i].head)) i--;
      let t = a.tokens[i], word = t && listed(t);
      // A する noun takes its する along [勉強 為る(する) = 勉強する].
      if (word?.w === "する" && i > 0 && listed(a.tokens[i - 1])?.pos.includes("vs")) { t = a.tokens[i - 1]; word = listed(t); }
      if (!word) continue;
      start = t.start;
      hint = word.k;
    }
    const end = m.index + m[0].length;
    const gap = rubySlice(a, start, end);
    if (!gap) continue;
    const before = rubySlice(a, 0, start), after = rubySlice(a, end, text.length);
    if (before === null || after === null) continue;
    results[p].push({ score: (a.allListed ? 0 : 100) + (a.checked ? 0 : 20) + Math.abs(text.length - 16), line: JSON.stringify([before + "＿" + after, gap, hint, en.get(eid), [], +jid]) });
  }
}
fs.mkdirSync(outDir, { recursive: true });
for (const [p, list] of Object.entries(results)) {
  const seen = new Set();
  const lines = list.sort((a, b) => a.score - b.score).filter((x) => !seen.has(x.line) && seen.add(x.line)).slice(0, 80);
  fs.writeFileSync(path.join(outDir, `${p}.txt`), lines.map((x) => `${x.score}\t${x.line}`).join("\n") + "\n");
  console.log(p, list.length);
}
