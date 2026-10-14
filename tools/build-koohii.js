// Builds content/koohii.json from the pages tools/fetch-koohii.js saved: Heisig's keyword, the frame, your own story and the top 3 shared stories by stars [学 = study, frame 346].
// Stories stay HTML with only <em> and <strong>, the rest of their text as written [Third &lt;script&gt; story.].
// Usage: node tools/build-koohii.js data/vocab.json _data/koohii content/koohii.json
const fs = require("fs");
const path = require("path");

const clean = (html) => html.replace(/<(\/?)(em|strong)\b[^>]*>/gi, "\u0000$1$2\u0001").replace(/<[^>]*>/g, "")
  .replace(/\u0000(\/?)(em|strong)\u0001/g, "<$1$2>").replace(/\s+/g, " ").trim();
const text = (html) => clean(html).replace(/<[^>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&");

// One saved page, or null when it has no keyword [a page that asks for the password].
function parse(html) {
  const kw = html.match(/<span class="ko-MyStory-keyword">([\s\S]*?)<\/span>/);
  if (!kw) return null;
  const frame = html.match(/<div class="framenum"[^>]*>(\d+)<\/div>/);
  const own = html.match(/ko-MyStoryView-textarea[^>]*>\s*<div class="story">([\s\S]*?)<\/div>/);
  // The shared list sorted by stars, not "New & updated" above it [479 stars first, a story from today never].
  const list = html.slice(html.indexOf('id="sharedstories-fav"'));
  const stories = html.includes('id="sharedstories-fav"') ? list.split(/<div class="sharedstory rtkframe\s*"/).slice(1).map((b) => ({
    by: text((b.match(/<div class="sharedstory_author">([\s\S]*?)<\/div>/) || ["", ""])[1]),
    text: clean((b.match(/<div class="story">([\s\S]*?)<\/div>/) || ["", ""])[1]),
    stars: +((b.match(/appv1="(\d*)"/) || [])[1] || 0),
  })).filter((s) => s.text) : [];
  return { kw: text(kw[1]), frame: frame ? +frame[1] : 0, mine: own ? clean(own[1]) || null : null, stories: stories.sort((a, b) => b.stars - a.stars).slice(0, 3) };
}

if (require.main === module) {
  const [vocabFile, pageDir, outFile] = process.argv.slice(2);
  if (!outFile) {
    console.error("usage: node tools/build-koohii.js <vocab json> <page dir> <out json>");
    process.exit(1);
  }
  const words = JSON.parse(fs.readFileSync(vocabFile, "utf8"));
  const listed = [...new Set(words.flatMap(require("../kanji.js").kanjiOf))];
  const out = {}, missing = [];
  for (const c of listed) {
    const file = path.join(pageDir, `${c.codePointAt(0).toString(16)}.html`);
    const k = fs.existsSync(file) && parse(fs.readFileSync(file, "utf8"));
    if (k) out[c] = k; else missing.push(c);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out));
  console.log(`${Object.keys(out).length} kanji -> ${outFile} (${fs.statSync(outFile).size} bytes), ${Object.values(out).filter((k) => k.mine).length} with your story`);
  if (missing.length) console.log(`no keyword for ${missing.length}: ${missing.join("")}`);
}

module.exports = { parse };
