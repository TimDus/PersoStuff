// The Words section with N3 in and descriptors on, at 1280, 390 and 360 px against a fake backend: the hub's three level
// panels and N3 practice, 赤 十 作品's English fronts and backs, search rows and per-key time, the Verbs meaning line,
// a word whose kanji is one of the 40 added for N3 [噂], an N3 recording, and a vocab.json stripped of every `d`.
// It exists because the tests read class names, never whether a third panel or a descriptor line fits a 360 px phone,
// or what a list cached from before descriptors shows; report.txt logs each step, page width against viewport
// (equal = nothing overflows) and errors (one is the aborted supabase-js CDN script).
// Usage: node tools/drive-words.js . <out dir>
const http = require("http"), fs = require("fs"), path = require("path");
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const { chromium } = require(path.join(root, "node_modules", "playwright"));
const { meaningOf } = require(path.join(root, "sync.js"));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
const vocab = JSON.parse(fs.readFileSync(path.join(root, "data/vocab.json"), "utf8"));
const MET = ["赤|あか", "赤い|あかい", "十|とお", "十|じゅう", "作品|さくひん", "仕事|しごと", "現在|げんざい", "申す|もうす", "噂|うわさ"];
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
  const card = { st: "review", ivl: 1, ease: 2.5, due: day, n: 1, lapses: 0, first: day - 1, last: day - 1 };
  const cards = Object.fromEntries(MET.flatMap((k) => [[k + "#r", card], [k + "#p", card]]));
  const deck = { cards, settings: { newPerDay: 20, at: 0 }, savedAt: 1,
    kanji: { cards: { 赤: card, 十: card, 作: card, 品: card, 仕: card, 事: card, 現: card, 在: card, 申: card, 噂: card }, settings: { newPerDay: 10, at: 0 } } };
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

    // Step 4: the hub.
    await page.goto(base + "#words");
    await page.locator(".grid .title").first().waitFor();
    const panels = await page.locator(".grid .panel").evaluateAll((ps) => ps.map((p) => p.textContent.replace(/\s+/g, " ").trim()));
    report.push(`${name} hub panels: ${panels.join(" | ")}; practice: ${(await page.locator("a[href^='#words/practice/n']").allTextContents()).join(", ")}; lead: ${(await page.textContent(".lead")).replace(/\s+/g, " ").slice(0, 70)}; width ${await width()}`);
    await page.screenshot({ path: path.join(out, `${name}-hub.png`) });

    // Step 6: search rows with descriptors, and the time of one input event.
    for (const q of ["red", "hair", "ten", "work"]) {
      await page.fill("#w-find", q);
      const rows = await page.locator("#w-hits .find-row").evaluateAll((rs) => rs.slice(0, 6).map((r) => `${r.dataset.k.split("|")[0]}:${r.querySelector(".desc")?.textContent || "-"}`));
      report.push(`${name} search "${q}": ${rows.join(" ")}; width ${await width()}`);
    }
    await page.screenshot({ path: path.join(out, `${name}-search-work.png`) });
    const ms = [];
    for (const q of ["t", "ta", "tab"]) ms.push(await page.evaluate((q) => {
      const box = document.querySelector("#w-find"); box.value = q;
      const t = performance.now(); box.dispatchEvent(new Event("input")); return +(performance.now() - t).toFixed(1);
    }, q));
    report.push(`${name} search per key ms (t, ta, tab): ${ms.join(", ")}`);
    await page.fill("#w-find", "");

    // Step 5: English and Japanese faces of the seeded cards, through the N3 practice and the N5 practice rounds.
    for (const set of ["n5", "n3"]) {
      await page.goto(base + `#words/practice/${set}`);
      await page.locator(".face.front").first().waitFor();
      const title = await page.locator(".row > span.muted.small").first().textContent();
      const seen = [];
      for (let i = 0; i < 16; i++) {
        const front = await page.locator(".face.front").evaluate((f) => [...f.children].map((c) => `${c.className}=${c.textContent.trim()}`).join(" / "));
        await page.keyboard.press("Space");
        const back = await page.locator(".face.back .desc").allTextContents();
        seen.push(`${front} || back desc: ${back.join(",") || "-"}`);
        if (i === 0) await page.screenshot({ path: path.join(out, `${name}-${set}-back.png`) });
        const again = page.locator("button", { hasText: "Got it" });
        if (!(await again.count())) break;
        await again.first().click();
        if (await page.locator("h1", { hasText: "Done" }).count()) break;
      }
      report.push(`${name} ${title}: ${seen.length} cards`);
      for (const s of seen) report.push(`    ${s}`);
      report.push(`    width ${await width()}`);
    }

    // Step 9: the Verbs meaning line, checked against m (d) for each word asked.
    await page.goto(base + "#verbs/run");
    if (await page.locator("#meaning").count()) {
      const lines = [];
      for (let i = 0; i < 5; i++) {
        const k = await page.locator(".verb-q").getAttribute("data-k");
        const shown = await page.textContent("#meaning");
        const w = vocab.find((x) => x.k === k);
        lines.push(`${k}: "${shown}" ${shown === meaningOf(w) ? "= m (d)" : "!= " + meaningOf(w)}`);
        await page.fill("#in", "x"); await page.keyboard.press("Enter");
        const cont = page.locator("#next"); if (await cont.count()) await cont.click();
      }
      report.push(`${name} verbs meaning lines: ${lines.join("; ")}`);
    } else report.push(`${name} verbs: no drill on #verbs/run`);

    // Step 10: the word 噂 and its kanji page.
    await page.goto(base + "#kanji/噂");
    await page.waitForTimeout(500);
    report.push(`${name} #kanji/噂: ${(await page.textContent("#app")).replace(/\s+/g, " ").slice(0, 160)}; width ${await width()}`);
    await page.screenshot({ path: path.join(out, `${name}-kanji-uwasa.png`) });
    await page.goto(base + "#kanji");
    await page.waitForTimeout(800);
    report.push(`${name} kanji hub groups: ${(await page.locator("h2, h3").allTextContents()).filter((t) => /JLPT|No JLPT/.test(t)).join(" | ")}`);

    report.push(`${name} errors: ${errors.join(" | ") || "none"}`);
    await ctx.close();
  }

  // Step 11: a vocab.json from before descriptors.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
  await page.route("**/data/vocab.json", async (r) => {
    const res = await r.fetch(); const list = await res.json();
    r.fulfill({ response: res, body: JSON.stringify(list.map(({ d, ...w }) => w)) });
  });
  await page.addInitScript((deck) => {
    localStorage.setItem("hira.study", JSON.stringify(deck)); localStorage.setItem("hira.study.user", JSON.stringify("u1"));
    window.HIRA_TEST_BACKEND = { session: async () => ({ id: "u1", email: "me@example.com" }), signIn: async () => {}, signOut: async () => {},
      isAllowed: async () => true, content: async () => (await fetch("content/worksheets.json")).json(),
      signedUrls: async (p) => new Map(p.map((x) => [x, "content/" + x])), loadProgress: async () => null, saveProgress: async () => {}, loadStudy: async () => null, saveStudy: async () => {} };
  }, deck);
  await page.goto(base + "#words/practice/n5");
  await page.locator(".face.front").first().waitFor();
  await page.keyboard.press("Space");
  report.push(`old vocab.json: .desc elements ${await page.locator(".desc").count()}, "undefined" on page ${(await page.textContent("#app")).includes("undefined")}`);
  await page.goto(base + "#words");
  await page.fill("#w-find", "red");
  report.push(`old vocab.json search "red": .desc ${await page.locator(".desc").count()}, "undefined" ${(await page.textContent("#app")).includes("undefined")}`);
  await ctx.close();

  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.txt"), report.join("\n") + "\n", "utf8");
  console.log(report.join("\n"));
})();
