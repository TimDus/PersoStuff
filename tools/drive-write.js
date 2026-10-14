// The writing quiz's Learn and Self modes at 1280, 390 and 360 px against a fake backend. The browser tests read which
// stroke the demo holds and how many numbers the answer has, never the paint, so they stay green with a demo that never
// draws in, never fades to its trail, or an answer whose numbers sit off the pad. Read the screenshots it leaves;
// report.txt has the demo's opacity and dash offset at 250 ms (drawing, .9) and 1650 ms (trail, .35, offset 0), and page
// width against viewport (equal = nothing overflows). The one console error is the CDN this script aborts.
// Usage: node tools/drive-write.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
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
  const browser = await chromium.launch({ channel: "chrome" });
  const report = [];
  for (const [name, vp, mobile] of [["desk", { width: 1280, height: 900 }, false], ["p390", { width: 390, height: 844 }, true], ["p360", { width: 360, height: 740 }, true]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
    await page.addInitScript(() => {
      window.HIRA_TEST_BACKEND = {
        session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
        isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
        signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {},
        loadStudy: async () => null, saveStudy: async (id, s) => { window.__saved = s; },
      };
    });
    const width = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const strokesOf = (kana) => page.evaluate(async (kana) => {
      const all = await HiraStrokes.load();
      return [...kana].flatMap((c, j) => all[c].d.map((d) => HiraWrite.pathPoints(d).map(([x, y]) => [x + 109 * j, y])));
    }, kana);
    // A hand-like stroke: shifted a little and drawn at a finger's pace [3 units right, 2 down].
    const draw = async (pts, dx = 3, dy = 2) => {
      const r = await page.locator("#pad").boundingBox();
      const w = await page.evaluate(() => document.querySelector("#pad").viewBox.baseVal.width);
      const at = ([x, y]) => [r.x + ((x + dx) / w) * r.width, r.y + ((y + dy) / 109) * r.height];
      await page.mouse.move(...at(pts[0]));
      await page.mouse.down();
      for (const p of pts.slice(1)) await page.mouse.move(...at(p), { steps: 2 });
      await page.mouse.up();
    };
    const box = (sel) => page.locator(sel).boundingBox();
    const shot = (n) => page.screenshot({ path: path.join(out, `${name}-${n}.png`) });

    await page.goto(base + "#learn/1");
    await page.locator("a.btn", { hasText: "Practice writing" }).scrollIntoViewIfNeeded();
    report.push(`${name} step: intro "${(await page.textContent(".lead")).trim().slice(0, 90)}", task href ${await page.getAttribute("a.btn:has-text('Practice writing')", "href")}, width ${await width()}`);
    await shot("step");

    await page.click("a.btn:has-text('Practice writing')");
    await page.locator("#pad rect").first().waitFor();
    await page.waitForTimeout(250);
    const op = () => page.locator("#pad .demo").evaluate((p) => [getComputedStyle(p).strokeOpacity, getComputedStyle(p).strokeDashoffset]);
    report.push(`${name} learn demo at 250 ms: opacity/dashoffset ${await op()}`);
    await shot("learn-demo");
    await page.waitForTimeout(1400);
    report.push(`${name} learn demo at 1650 ms: opacity/dashoffset ${await op()}`);
    const seg = await box("#checkmode"), prog = await box("#prog");
    report.push(`${name} switch ${JSON.stringify(seg)}, prog ${JSON.stringify(prog)}, width ${await width()}`);
    await shot("learn-trail");
    const a = await strokesOf("あ");
    await draw(a[0]);
    await shot("learn-traced1");
    await draw(a[1]); await draw(a[2]);
    await shot("learn-traced-all");
    await page.waitForTimeout(500);
    report.push(`${name} memory: ink ${await page.locator("#pad .ink *").count()}, demo ${await page.locator("#pad .demo").count()}, fb "${(await page.textContent("#fb")).trim()}"`);
    await draw(a[0], 0, 35);
    await page.waitForTimeout(1500);
    report.push(`${name} memory miss: demo ${await page.locator("#pad .demo").count()}`);
    await shot("learn-memory-miss");

    await page.click("[data-check='self']");
    await page.locator("#pad rect").first().waitFor();
    report.push(`${name} self: url ${decodeURIComponent(page.url()).split("#")[1]}, acts "${(await page.textContent("#acts")).replace(/\s+/g, " ").trim()}"`);
    const kana = await page.getAttribute("#say [data-say]", "data-say");
    const s = await strokesOf(kana);
    for (const st of [...s].reverse()) await draw(st, 5, 4);
    await shot("self-drawn");
    await page.click("#show");
    await page.waitForTimeout(600 * s.length + 600);
    report.push(`${name} self shown ${kana}: answer ${await page.locator("#pad .answer").count()}, numbers ${await page.locator("#pad .hint text").count()}/${await page.locator("#pad .ink text").count()}, acts "${(await page.textContent("#acts")).replace(/\s+/g, " ").trim()}", width ${await width()}`);
    await shot("self-shown");
    await page.click("#got");
    report.push(`${name} self graded: ok ${await page.textContent("#ok")}, prog ${await page.textContent("#prog")}, saved write ${JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.study") || "{}").write?.kana))}`);
    report.push(`${name} errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
  console.log(report.join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
