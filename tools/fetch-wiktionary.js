// Saves the Wiktionary page of every deck kanji in data/kanji.json, and of its old form where the page names one, to _data/wiktionary/<hex>.wiki [来 = 6765.wiki, and its kyu= 來 as 4f86.wiki].
// 50 pages a request, one request every 10 s, pages already saved are skipped [902 kanji and their old forms in about 25 requests, 5 minutes].
// Usage: node tools/fetch-wiktionary.js data/kanji.json _data/wiktionary
const fs = require("fs");
const path = require("path");

const [kanjiFile, outDir] = process.argv.slice(2);
if (!outDir) {
  console.error("usage: node tools/fetch-wiktionary.js <kanji json> <out dir>");
  process.exit(1);
}
const API = "https://en.wiktionary.org/w/api.php";
const UA = { "User-Agent": "FlashCards-study-site/1.0 (personal kanji study site; github.com/TimDus)" };
const hex = (c) => c.codePointAt(0).toString(16);
const file = (c) => path.join(outDir, `${hex(c)}.wiki`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The old form the Japanese section names, an entity decoded to its plain kanji [kyu=來 = 來; 漢's kyu=&#64071; is 漢 again].
const kyu = (t) => t.match(/\{\{ja-kanji\|[^}]*\bkyu=([^|}\s]+)/)?.[1].replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).normalize("NFC");

async function fetchAll(cs) {
  const todo = cs.filter((c) => !fs.existsSync(file(c)));
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    let res, body;
    // A throttled request is a 429 in plain text, waited out up to 5 times [9 requests 3 s apart got one at 450 of 902].
    for (let tries = 0; ; tries++) {
      res = await fetch(`${API}?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&titles=${encodeURIComponent(batch.join("|"))}`, { headers: UA });
      body = await res.text();
      if (res.status !== 429 || tries === 5) break;
      const s = +res.headers.get("retry-after") || 60;
      console.log(`throttled, waiting ${s} s`);
      await wait(s * 1000);
    }
    if (!body.startsWith("{")) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`);
    for (const p of JSON.parse(body).query.pages) {
      if (p.missing) { console.log(`${p.title}: no page`); continue; }
      fs.writeFileSync(file(p.title), p.revisions[0].slots.main.content);
    }
    console.log(`${Math.min(i + 50, todo.length)} of ${todo.length}`);
    await wait(10000);
  }
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const deck = Object.keys(JSON.parse(fs.readFileSync(kanjiFile, "utf8")));
  await fetchAll(deck);
  const old = [...new Set(deck.filter((c) => fs.existsSync(file(c))).map((c) => kyu(fs.readFileSync(file(c), "utf8"))).filter((k) => k && [...k].length === 1))];
  console.log(`${old.length} old forms`);
  await fetchAll(old);
  console.log(`${fs.readdirSync(outDir).length} pages in ${outDir}`);
})();
