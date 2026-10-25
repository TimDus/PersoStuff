// The hubs' search at 1280, 390 and 360 px against a fake backend: Words typed key by key [eat, taberu, たべる, to and
// Show all], a row's kanji popup, then Kanji [eat lit, 食's page and Back, shoku]. It exists because the tests read class
// names, never whether a dimmed grid still shows its lit tile or a word row fits a 360 px phone; report.txt logs each
// query's hits, page width against viewport (equal = nothing overflows) and errors (one is the aborted supabase-js CDN script).
// Usage: node tools/drive-search.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
const MET = ["食べる|たべる", "学生|がくせい", "水|みず"];
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
  const day = Math.floor((Date.now() - 4 * 3600e3 - new Date().getTimezoneOffset() * 60e3) / 86400e3);
  const card = { st: "review", ivl: 1, ease: 2.5, due: day + 1, n: 1, lapses: 0, first: day, last: day };
  const deck = { cards: Object.fromEntries(MET.map((k) => [k + "#r", card])), settings: { newPerDay: 20, at: 0 }, savedAt: 1,
    kanji: { cards: { 食: card, 学: card, 水: { ...card, ivl: 30 } }, settings: { newPerDay: 10, at: 0 } } };
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
      window.HIRA_TEST_BACKEND = {
        session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
        isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
        signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {},
        loadStudy: async () => null, saveStudy: async () => {},
      };
    }, deck);
    const width = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const rows = () => page.locator("#w-hits .find-row").evaluateAll((rs) => rs.map((r) => r.dataset.k.split("|")[0] + (r.classList.contains("unmet") ? "~" : "")));
    const ask = async (q) => {
      await page.fill("#w-find", "");
      await page.type("#w-find", q, { delay: 30 });
      const rs = await rows();
      report.push(`${name} words "${q}": ${rs.length} rows [${rs.slice(0, 8).join(" ")}${rs.length > 8 ? " …" : ""}] "${(await page.textContent("#w-hits p")) || ""}" width ${await width()}`);
    };

    await page.goto(base + "#words");
    await page.locator("#w-find").waitFor();
    for (const q of ["eat", "taberu", "たべる", "kami", "zzz"]) await ask(q);
    await ask("eat");
    await page.screenshot({ path: path.join(out, `${name}-words-eat.png`) });
    await ask("to");
    await page.click("#w-more");
    report.push(`${name} words "to" after Show all: ${(await rows()).length} rows`);
    await page.fill("#w-find", "taberu");
    await page.click("#w-hits [data-kanji='食']");
    await page.locator(".kanji-pop[data-c='食']").waitFor({ timeout: 5000 });
    report.push(`${name} 食 popup from a row: ${(await page.textContent(".kanji-pop .kanji-kw")).trim()}`);
    await page.screenshot({ path: path.join(out, `${name}-words-popup.png`) });
    await page.keyboard.press("Escape");

    await page.goto(base + "#kanji");
    await page.locator("#k-find").waitFor();
    await page.type("#k-find", "eat", { delay: 30 });
    const lit = () => page.locator(".kgrid a.hit").allTextContents();
    report.push(`${name} kanji "eat": lit [${(await lit()).join(" ")}] "${await page.textContent("#k-hits")}" width ${await width()}`);
    await page.screenshot({ path: path.join(out, `${name}-kanji-eat.png`) });
    await page.locator(".kgrid a.hit").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `${name}-kanji-eat-tile.png`) });
    await page.click("#k-hits a:text('食')");
    await page.locator(".kanji-page[data-c='食']").waitFor();
    await page.goBack();
    await page.locator("#k-find").waitFor();
    report.push(`${name} back from 食: box "${await page.inputValue("#k-find")}", lit [${(await lit()).join(" ")}]`);
    await page.fill("#k-find", "");
    await page.type("#k-find", "shoku", { delay: 30 });
    report.push(`${name} kanji "shoku": "${await page.textContent("#k-hits")}" width ${await width()}`);
    await page.fill("#k-find", "");
    report.push(`${name} kanji cleared: finding grids ${await page.locator(".kgrid.finding").count()}, line "${await page.textContent("#k-hits")}"`);
    report.push(`${name} errors: ${errors.join(" | ") || "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n");
  console.log(report.join("\n"));
})();
