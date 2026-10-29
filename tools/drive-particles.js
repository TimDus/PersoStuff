// The Particles learn path at 1280, 390 and 360 px against a fake backend: the fresh hub, every step's lesson, Step 1's
// drill answered to Done, the hub after, the review run and Grammar's に page leading to Step 3. It exists because the tab
// once opened straight on a drill of 13 particles nobody had explained, and a lesson's sentence list is the first thing
// to overflow a phone; report.txt logs page width against viewport (equal = nothing overflows), what each page says,
// the particles each run asked, and errors (one is the aborted supabase-js CDN script).
// Usage: node tools/drive-particles.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const { SENTENCES } = require(path.join(root, "particles.js"));
const { STEPS } = require(path.join(root, "particle-lessons.js"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
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
    const shot = (n) => page.screenshot({ path: path.join(out, `${name}-${n}.png`) });
    const log = async (what, extra = "") => report.push(`${name} ${what}: width ${(await width()).join("/")}${extra}`);
    // Answers every card right and returns the particles each card took [wa-ga: は が が は …].
    const drillRight = async () => {
      const asked = [];
      while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
        const prog = await page.textContent("#prog");
        const c = SENTENCES[+(await page.getAttribute(".gap-q", "data-id"))];
        const opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
        const pick = opts.find((p) => c.ok.includes(p));
        asked.push(pick);
        await page.keyboard.press(String(opts.indexOf(pick) + 1));
        await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
      }
      return asked;
    };

    await page.goto(base + "#particles");
    await page.locator(".verb-step").first().waitFor();
    await log("hub fresh", ` · ${await page.locator(".verb-step").count()} steps · review "${await page.textContent("#review-note")}" · ${await page.getAttribute("#review", "class")}`);
    await shot("1-hub");
    for (const [i, s] of STEPS.entries()) {
      await page.goto(base + `#particles/learn/${s.id}`);
      await page.locator(".verb-lesson").waitFor();
      const fills = await page.locator(".part-ex .gap.filled").allTextContents();
      const tofugu = await page.locator(".tofugu").count();
      await log(`step ${i + 1} ${s.id}`, ` · ${fills.length} sentences filled ${[...new Set(fills)].join("")} · tofugu links ${tofugu}`);
      if (i === 0 || i === 7) await shot(`2-lesson-${s.id}`);
    }
    await page.goto(base + "#particles/learn/wa-ga");
    await page.locator("#drill").click();
    await page.locator(".gap-q").waitFor();
    await shot("3-drill");
    const asked = await drillRight();
    await log("step 1 drill", ` · ${asked.length} answered: ${asked.join("")} · bests ${(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("hira.study")).particles.best))).join(",")} · note "${await page.textContent(".panel p.muted")}"`);
    await shot("4-done");
    await page.goto(base + "#particles");
    await page.locator(".verb-step.done").waitFor();
    await log("hub after", ` · done ${await page.locator(".verb-step.done").count()} · review "${await page.textContent("#review-note")}" · ${await page.getAttribute("#review", "class")}`);
    await shot("5-hub-after");
    await page.click("#review");
    await page.locator(".gap-q").waitFor();
    const prog = await page.textContent("#prog");
    const reviewed = await drillRight();
    await log("review", ` · ${prog} · ${reviewed.join("")}`);
    await page.goto(base + "#grammar/ni");
    await page.locator("#drill").waitFor();
    const text = await page.textContent("#drill");
    await page.click("#drill");
    await page.locator(".verb-lesson").waitFor();
    await log("grammar ni", ` · "${text}" → ${await page.evaluate(() => location.hash)}`);
    report.push(`${name} errors: ${errors.join(" | ") || "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n", "utf8");
  console.log(report.join("\n"));
})();
