// The Grammar tab at 1280, 390 and 360 px against a fake backend: hub, a point page, a right answer, a miss, Done and a particle point's link to its Particles lesson.
// It exists because every test passed while the phone showed the blank as ＿ glyphs over a border a line below, and a filled
// answer underlined a line under its own text: the gap took the sentence's 2.4 line height. Read the screenshots it leaves;
// report.txt has page width against viewport (equal = nothing overflows) and how many N5 readings were hidden, then shown.
// Usage: node tools/drive-grammar.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const G = JSON.parse(fs.readFileSync(path.join(root, "data", "grammar.json"), "utf8"));
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
      localStorage.setItem("hira.grammar.sel", JSON.stringify({ points: ["tekudasai", "teiru", "node", "ga-imasu"], count: 10 }));
      window.HIRA_TEST_BACKEND = {
        session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
        isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
        signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {},
        loadStudy: async () => null, saveStudy: async (id, s) => { window.__saved = s; },
      };
    });
    const width = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    await page.goto(base + "#grammar");
    await page.locator(".gr-group").first().waitFor();
    report.push(`${name} hub width ${await width()}, chips on ${await page.locator("[data-point].on").count()}, points ${await page.locator(".gr-point").count()}`);
    await page.screenshot({ path: path.join(out, `${name}-hub.png`) });
    await page.goto(base + "#grammar/node");
    await page.locator(".gr-explain").waitFor();
    report.push(`${name} page width ${await width()}, examples ${await page.locator(".examples .ex").count()}, tofugu ${await page.getAttribute("a.tofugu", "href")}`);
    await page.screenshot({ path: path.join(out, `${name}-page.png`) });
    await page.goto(base + "#grammar/run");
    await page.locator(".gr-q").waitFor();
    const card = () => page.getAttribute(".gr-q", "data-id").then((i) => G.sentences[+i]);
    let s = await card();
    report.push(`${name} card 1: ${s.p} ${s.en} | hint ${await page.textContent("#hint")} | asks ${await page.locator(".gr-q rt.ask").count()} hidden ${await page.locator(".gr-q rt.ask").evaluateAll((rs) => rs.filter((r) => getComputedStyle(r).visibility === "hidden").length)}`);
    await page.screenshot({ path: path.join(out, `${name}-card.png`) });
    await page.fill("#in", s.gap.r);
    await page.press("#in", "Enter");
    report.push(`${name} right: ok ${await page.textContent("#ok")}, filled ${await page.locator(".gap.filled").count()}, revealed ${await page.locator(".gr-q rt.ask").evaluateAll((rs) => rs.filter((r) => getComputedStyle(r).visibility !== "hidden").length)}, width ${await width()}`);
    await page.screenshot({ path: path.join(out, `${name}-right.png`) });
    await page.waitForFunction(() => document.querySelector("#prog").textContent.startsWith("2 /"));
    s = await card();
    await page.fill("#in", "zzz");
    await page.press("#in", "Enter");
    report.push(`${name} miss: bad ${await page.textContent("#bad")}, fb "${(await page.textContent("#fb")).replace(/\s+/g, " ").trim()}", width ${await width()}`);
    await page.screenshot({ path: path.join(out, `${name}-miss.png`) });
    await page.press("#in", "Enter");
    for (let i = 0; i < 20 && !(await page.locator("h1", { hasText: "Done!" }).count()); i++) {
      const c = await card(), prog = await page.textContent("#prog");
      await page.fill("#in", c.gap.r);
      await page.press("#in", "Enter");
      await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
    }
    await page.waitForFunction(() => window.__saved?.grammar, null, { timeout: 5000 }).catch(() => {});
    report.push(`${name} done: ${(await page.textContent("main")).replace(/\s+/g, " ").slice(0, 160)} | saved ${JSON.stringify(await page.evaluate(() => window.__saved?.grammar?.best))}`);
    await page.screenshot({ path: path.join(out, `${name}-done.png`) });
    await page.goto(base + "#grammar/wo");
    await page.locator("#drill").click();
    await page.locator(".verb-lesson").waitFor();
    report.push(`${name} particle point: ${await page.evaluate(() => location.hash)}`);
    report.push(`${name} errors: ${errors.length ? errors.join(" | ") : "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
  console.log(report.join("\n"));
})().catch((e) => { console.error(e); process.exit(1); });
