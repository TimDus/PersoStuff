// The Verbs learn path at 1280, 390 and 360 px against a fake backend: the fresh hub, Step 1's lesson, the widest example
// tables (adj-i has four form columns, たら six rows), Step 1's drill answered to Done, and the hub after. It exists because
// the tab once opened straight on a drill nobody had taught, and a lesson table is the first thing to overflow a phone;
// report.txt logs page width against viewport (equal = nothing overflows), what each page says, and errors (one is the
// aborted supabase-js CDN script).
// Usage: node tools/drive-verbs.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
const MET = ["飲む|のむ", "食べる|たべる", "高い|たかい", "静か|しずか", "行く|いく"];
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
      window.HIRA_TEST_BACKEND = {
        session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
        isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
        signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {},
        loadStudy: async () => null, saveStudy: async (id, s) => { window.__saved = s; },
      };
    }, deck);
    const width = () => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    const shot = (n) => page.screenshot({ path: path.join(out, `${name}-${n}.png`) });
    const log = async (what, extra = "") => report.push(`${name} ${what}: width ${(await width()).join("/")}${extra}`);

    await page.goto(base + "#verbs");
    await page.locator(".verb-step").first().waitFor();
    await log("hub fresh", ` · ${await page.locator(".verb-step").count()} steps · review "${await page.textContent("#review-note")}" · ${await page.getAttribute("#review", "class")}`);
    await shot("1-hub");
    await page.click(".verb-step >> nth=0");
    await page.locator(".verb-lesson").waitFor();
    const rows = await page.locator(".verb-ex tbody tr").evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td > .jp")].map((s) => s.textContent).join("→")));
    await log("step 1 lesson", ` · ${rows.join(", ")}`);
    await shot("2-lesson");
    for (const id of ["adj-i", "tara"]) {
      await page.goto(base + `#verbs/learn/${id}`);
      await page.locator(".verb-lesson").waitFor();
      const box = await page.evaluate(() => { const w = document.querySelector(".verb-ex-wrap"); return [w.scrollWidth, w.clientWidth]; });
      await log(`${id} lesson`, ` · table ${box.join("/")} (scrolls inside its box when the first is larger)`);
      await shot(`3-${id}`);
    }
    await page.goto(base + "#verbs/learn/masu");
    await page.locator("#drill").click();
    await page.locator(".verb-q").waitFor();
    await shot("4-drill");
    let asked = 0;
    while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
      const prog = await page.textContent("#prog");
      const want = await page.evaluate(async () => {
        const q = document.querySelector(".verb-q").dataset;
        const words = await (await fetch("data/vocab.json")).json();
        return HiraConj.conjugate(words.find((w) => w.k === q.k), q.form).r;
      });
      await page.fill("#in", want);
      await page.press("#in", "Enter");
      asked++;
      await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
    }
    await log("step 1 drill", ` · ${asked} answered · bests ${(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("hira.study")).verbs.best))).join(",")}`);
    await shot("5-done");
    await page.goto(base + "#verbs");
    await page.locator(".verb-step.done").waitFor();
    await log("hub after", ` · done steps ${await page.locator(".verb-step.done").count()} · review "${await page.textContent("#review-note")}" · ${await page.getAttribute("#review", "class")}`);
    await shot("6-hub-after");
    report.push(`${name} errors: ${errors.join(" | ") || "none"}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n", "utf8");
  console.log(report.join("\n"));
})();
