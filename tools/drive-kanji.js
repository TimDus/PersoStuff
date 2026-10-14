// A word card's kanji note, its popup and the word's recording at 1280, 390 and 360 px against a fake backend.
// It exists because the tests drive one note line at a time, while the phone shows three for 大学生 beside the examples,
// and a popup over a review is where a stacked second popup and keys grading the card underneath both turned up.
// Read the screenshots; report.txt has page width against viewport (equal = nothing overflows), the note lines,
// the stroke count drawn in the popup and the recording's HTTP status and duration.
// Usage: node tools/drive-kanji.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const { dayOf } = require(path.join(root, "srs.js"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
fs.mkdirSync(out, { recursive: true });

const day = dayOf(Date.now());
const card = (first, due) => ({ st: "review", ivl: 3, ease: 2.5, due, n: 2, lapses: 0, first, last: first });
// 大学生 due today, with met words for each of its kanji [大 in 大人 and 大切, 学 in 学校, 生 in 先生].
const deck = { cards: { "大学生|だいがくせい#r": card(day - 5, day), "大人|おとな#r": card(day - 4, day + 3), "大切|たいせつ#r": card(day - 3, day + 3),
  "学校|がっこう#r": card(day - 2, day + 3), "先生|せんせい#r": card(day - 1, day + 3) }, settings: { newPerDay: 20, at: 0 }, savedAt: 1 };

(async () => {
  const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (req.url.split("?")[0] === "/") file = path.join(root, "index.html");
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: "chrome" });
  const report = [];
  for (const [name, vp, mobile] of [["desk", { width: 1280, height: 900 }, false], ["p390", { width: 390, height: 844 }, true], ["p360", { width: 360, height: 740 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${m.text()} ${m.location().url}`); });
    const clips = [];
    page.on("response", (r) => { if (r.url().includes("/data/words/")) clips.push(`${r.status()} ${r.headers()["content-type"]}`); });
    await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
    await page.addInitScript((deck) => {
      localStorage.setItem("hira.study", JSON.stringify(deck));
      localStorage.setItem("hira.study.user", JSON.stringify("u1"));
      window.HIRA_TEST_BACKEND = {
        session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
        isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
        signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {},
        loadStudy: async () => null, saveStudy: async () => {},
      };
    }, deck);
    const width = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await page.goto(base + "#words/review");
    await page.locator(".face.front").waitFor();
    await page.click("#card");
    report.push(`${name} back width ${await width()}, note ${JSON.stringify(await page.locator(".kanji-note .kn").allTextContents())}`);
    await page.screenshot({ path: path.join(out, `${name}-back.png`) });
    await page.click(".face.back > .speak");
    await page.waitForTimeout(1500);
    const dur = await page.evaluate(() => new Promise((ok) => { const a = new Audio(document.querySelector(".face.back > .speak").dataset.rec); a.onloadedmetadata = () => ok(a.duration); a.onerror = () => ok("error"); }));
    report.push(`${name} recording ${clips.join(", ") || "none requested"}, duration ${dur}`);
    await page.click(".kn-k[data-kanji='学']");
    await page.click(".modal .stroke-toggle");
    await page.locator(".modal .strokes path").nth(7).waitFor();
    report.push(`${name} popup width ${await width()}, strokes ${await page.locator(".modal .strokes path").count()}, words ${await page.locator(".modal .kw-row").count()} (${await page.locator(".modal .kw-row:not(.unmet)").count()} met)`);
    await page.screenshot({ path: path.join(out, `${name}-popup.png`) });
    report.push(`${name} errors ${errors.length ? errors.join(" | ") : "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
  console.log(report.join("\n"));
})();
