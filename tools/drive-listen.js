// The Listening round at 1280, 390 and 360 px against a fake backend: a cold load straight into a round, the Words hub's
// button, the picker, a card, a right answer, a miss and Done. It exists because the tests' play() hook records the clip
// asked for, never whether Chrome let it sound; report.txt logs each play() as played or its rejection, page width against
// viewport (equal = nothing overflows), and errors (one is the aborted supabase-js CDN script). Headless Chrome played even
// the cold load with Playwright's autoplay default dropped, so a phone refusing that first clip is traced, not reproduced.
// Usage: node tools/drive-listen.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
const WORDS = JSON.parse(fs.readFileSync(path.join(root, "data", "vocab.json"), "utf8"));
const MET = ["花|はな", "食べる|たべる", "赤い|あかい", "学生|がくせい", "行く|いく", "静か|しずか", "時々|ときどき", "水|みず", "見る|みる", "大きい|おおきい", "後|あと"];
fs.mkdirSync(out, { recursive: true });

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
  // Playwright launches Chrome with autoplay always allowed; a phone or a fresh desktop wants a gesture first, so the drive drops that default.
  const browser = await chromium.launch({ channel: "chrome", ignoreDefaultArgs: ["--autoplay-policy=no-user-gesture-required"], args: ["--autoplay-policy=user-gesture-required"] });
  const report = [];
  const day = Math.floor((Date.now() - 4 * 3600e3 - new Date().getTimezoneOffset() * 60e3) / 86400e3);
  const card = { st: "review", ivl: 1, ease: 2.5, due: day + 1, n: 1, lapses: 0, first: day, last: day };
  const deck = { cards: Object.fromEntries(MET.map((k) => [k + "#r", card])), settings: { newPerDay: 20, at: 0 }, savedAt: 1 };
  for (const [name, vp, mobile] of [["desk", { width: 1280, height: 900 }, false], ["p390", { width: 390, height: 844 }, true], ["p360", { width: 360, height: 740 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
    await page.addInitScript((deck) => {
      if (!localStorage.getItem("__seeded")) {
        localStorage.setItem("hira.study", JSON.stringify(deck));
        localStorage.setItem("hira.study.user", JSON.stringify("u1"));
        localStorage.setItem("__seeded", "1");
      }
      window.__plays = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        const p = play.call(this), entry = { src: this.src.split("/").pop(), result: "pending" };
        window.__plays.push(entry);
        p.then(() => { entry.result = "played"; }, (e) => { entry.result = e.name; });
        return p;
      };
      window.HIRA_TEST_BACKEND = {
        session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
        isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
        signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {},
        loadStudy: async () => null, saveStudy: async (id, s) => { window.__saved = s; },
      };
    }, deck);
    const width = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const plays = async () => { await page.waitForTimeout(400); return page.evaluate(() => window.__plays.map((p) => `${p.src}:${p.result}`).join(" ")); };
    const heard = () => page.getAttribute(".listen-q", "data-k").then((k) => WORDS.find((w) => w.k === k));
    // Opened straight into a round before any click on the site, the one case autoplay refuses; the rest is clicked in.
    await page.goto(base + "#words/listen/run");
    await page.locator(".listen-q").waitFor();
    report.push(`${name} cold into a round: plays ${await plays()}`);
    await page.click("#play");
    report.push(`${name} then 🔊 tapped: plays ${await plays()}`);
    await page.evaluate(() => { window.__plays.length = 0; });
    await page.goto(base + "#words");
    await page.locator('a[href="#words/listen"]').waitFor();
    report.push(`${name} hub width ${await width()}, button "${await page.textContent('a[href="#words/listen"]')}"`);
    await page.locator('a[href="#words/listen"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${name}-hub.png`) });
    await page.click('a[href="#words/listen"]');
    await page.locator("#go").waitFor();
    report.push(`${name} picker width ${await width()}: ${(await page.textContent(".panel")).replace(/\s+/g, " ").trim()}`);
    await page.screenshot({ path: path.join(out, `${name}-picker.png`) });
    await page.click("#go");
    await page.locator(".listen-q").waitFor();
    let w = await heard();
    report.push(`${name} card 1 (clicked in): ${w.w} | plays ${await plays()} | word shown ${await page.locator("#word").isVisible()} | width ${await width()}`);
    report.push(`${name} choices: ${(await page.locator(".gap-opt").allTextContents()).join(" / ")}`);
    await page.screenshot({ path: path.join(out, `${name}-card.png`) });
    await page.click(".gap-opt >> nth=0").catch(() => {});
    let opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
    report.push(`${name} first pick: ok ${await page.textContent("#ok")} bad ${await page.textContent("#bad")}`);
    await page.screenshot({ path: path.join(out, `${name}-answered.png`) });
    if (await page.locator("#next").count()) await page.click("#next");
    await page.waitForFunction(() => document.querySelector("#prog")?.textContent.startsWith("2 /"));
    w = await heard();
    opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
    await page.click(`.gap-opt >> nth=${opts.findIndex((m) => m !== w.m)}`);
    report.push(`${name} miss on ${w.w}: right lit "${await page.textContent(".gap-opt.right")}", word "${await page.textContent("#word")}", width ${await width()}`);
    await page.screenshot({ path: path.join(out, `${name}-miss.png`) });
    await page.click("#play");
    report.push(`${name} 🔊 tapped: plays ${await plays()}`);
    await page.click("#next");
    while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
      const prog = await page.textContent("#prog");
      w = await heard();
      opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
      await page.click(`.gap-opt >> nth=${opts.indexOf(w.m)}`);
      await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
    }
    report.push(`${name} done: ${(await page.textContent(".panel")).replace(/\s+/g, " ").trim().slice(0, 200)} | best ${JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.study")).listening?.best))}`);
    await page.screenshot({ path: path.join(out, `${name}-done.png`) });
    report.push(`${name} errors: ${errors.join(" | ") || "none"}`);
    await ctx.close();
  }
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
  console.log(report.join("\n"));
  await browser.close();
  server.close();
})();
