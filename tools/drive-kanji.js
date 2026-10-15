// A word card's kanji note, its popup, the word's recording and the Kanji tab (hub, a Draw-mode card, a kanji's page) at 1280, 390 and 360 px against a fake backend.
// It exists because the tests drive one note line at a time, while the phone shows three for 大学生 beside the examples,
// and a popup over a review is where a stacked second popup and keys grading the card underneath both turned up.
// Read the screenshots; report.txt has page width against viewport (equal = nothing overflows), the note lines,
// the stroke count drawn in the popup and the recording's HTTP status and duration; the hub's 902-kanji grid and the drawing pad are the parts a phone squeezes.
// A reading row with three met words is the widest line on a phone's card back, and 晴's sound family is the line under its components [大学生 puts セイ beside 先生].
// 海's parts once read a bare 氵, so the parts lines of 海, 水, 漢 and 近 and the hub's next kanji in Heisig's order are reported too.
// Usage: node tools/drive-kanji.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const { dayOf } = require(path.join(root, "srs.js"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
fs.mkdirSync(out, { recursive: true });

const day = dayOf(Date.now());
const card = (first, due) => ({ st: "review", ivl: 3, ease: 2.5, due, n: 2, lapses: 0, first, last: first });
// 大学生 due today, with met words for each of its kanji [大 in 大人 and 大切, 学 in 学校, 生 in 先生], and 生's kanji card due so the Draw card is asked, not introduced.
const deck = { cards: { "大学生|だいがくせい#r": card(day - 5, day), "大人|おとな#r": card(day - 4, day + 3), "大切|たいせつ#r": card(day - 3, day + 3),
  "学校|がっこう#r": card(day - 2, day + 3), "先生|せんせい#r": card(day - 1, day + 3) }, settings: { newPerDay: 20, at: 0 }, savedAt: 1,
  kanji: { cards: { 生: card(day - 4, day) }, settings: { newPerDay: 10, at: 0 } } };

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
    const readings = (s) => page.evaluate((s) => [...document.querySelectorAll(`${s} .kanji-reading > div`)].map((d) => d.textContent).join(" | "), s);
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
    report.push(`${name} popup width ${await width()}, strokes ${await page.locator(".modal .strokes path").count()}, words ${await page.locator(".modal .kw-row").count()} (${await page.locator(".modal .kw-row:not(.unmet)").count()} met), readings ${await readings(".modal")}`);
    await page.screenshot({ path: path.join(out, `${name}-popup.png`) });
    await page.keyboard.press("Escape");
    await page.goto(base + "#kanji");
    await page.locator("#k-new").waitFor();
    report.push(`${name} hub width ${await width()}, new ${await page.textContent("#k-new")}, ${await page.textContent("#k-sum")}, nav ${JSON.stringify(await page.locator("nav a:visible").allTextContents())}`);
    await page.screenshot({ path: path.join(out, `${name}-hub.png`) });
    await page.click("[data-mode='draw']");
    await page.click("#go");
    await page.locator(".kpad svg").waitFor();
    const r = await page.locator(".kpad svg").boundingBox();
    await page.mouse.move(r.x + r.width * 0.2, r.y + r.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(r.x + r.width * 0.8, r.y + r.height * 0.3, { steps: 8 });
    await page.mouse.up();
    report.push(`${name} draw card width ${await width()}, pad ${Math.round(r.width)} px, strokes drawn ${await page.locator(".kpad svg path").count()}, back hidden ${!(await page.locator(".face.back").isVisible())}`);
    await page.screenshot({ path: path.join(out, `${name}-draw-front.png`) });
    await page.keyboard.press(" ");
    await page.locator(".face.back .strokes path").first().waitFor();
    await page.waitForTimeout(800);
    report.push(`${name} draw back width ${await width()}, KanjiVG strokes ${await page.locator(".face.back .strokes path").count()}, readings ${await readings(".face.back")}`);
    await page.screenshot({ path: path.join(out, `${name}-draw-back.png`) });
    await page.goto(base + "#kanji/学");
    await page.locator(".kanji-comps").waitFor();
    await page.waitForTimeout(500);
    report.push(`${name} page width ${await width()}, comps ${JSON.stringify(await page.textContent(".kanji-comps"))}, stories ${await page.locator(".story").count()}, readings ${await readings(".kanji-page")}`);
    await page.screenshot({ path: path.join(out, `${name}-page.png`), fullPage: true });
    await page.goto(base + "#kanji/晴");
    await page.locator(".kanji-family").waitFor();
    report.push(`${name} 晴 page width ${await width()}, family ${JSON.stringify(await page.textContent(".kanji-family"))}, links ${JSON.stringify(await page.locator(".kanji-family a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))))}, readings ${await readings(".kanji-page")}`);
    await page.screenshot({ path: path.join(out, `${name}-family.png`) });
    // Parts first: a radical form's full kanji, the full kanji's forms, a drift note, and the order the hub offers.
    for (const c of ["海", "水", "漢", "近"]) {
      await page.goto(base + `#kanji/${c}`);
      await page.locator(`.kanji-page[data-c='${c}'] .kanji-kw`).waitFor();
      await page.waitForTimeout(300);
      const text = (s) => page.evaluate((s) => [...document.querySelectorAll(s)].map((d) => d.textContent).join(" | "), s);
      report.push(`${name} ${c} page width ${await width()}, parts ${JSON.stringify(await text(".kanji-comps"))}, why ${JSON.stringify(await text(".kanji-why"))}, forms ${JSON.stringify(await text(".kanji-forms"))}`);
      await page.screenshot({ path: path.join(out, `${name}-parts-${c.codePointAt(0).toString(16)}.png`) });
    }
    await page.goto(base + "#kanji");
    await page.locator("#k-new").waitFor();
    report.push(`${name} next kanji ${(await page.locator(".kgrid a.next").allTextContents()).join("")}, headings ${JSON.stringify(await page.locator("#app h2").allTextContents())}`);
    await page.goto(base + "#words");
    await page.locator("#new").waitFor();
    report.push(`${name} words hub new ${await page.textContent("#new")}, ${JSON.stringify(await page.textContent("#waiting"))}`);
    await page.screenshot({ path: path.join(out, `${name}-words-hub.png`) });
    report.push(`${name} errors ${errors.length ? errors.join(" | ") : "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
  console.log(report.join("\n"));
})();
