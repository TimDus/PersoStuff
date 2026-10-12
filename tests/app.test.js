// The site is meant to be useless without a listed Google account, yet still work on a train once you've signed in.
// Each case drives the real page in Chrome against a fake Supabase, because the ways this breaks are all in app.js:
// a signed-out visitor reaching the worksheets, a refused account seeing the nav, a phone's progress replaced by the PC's,
// or an offline boot locking you out. The real row-level security is checked separately against the live project.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
let server, base, browser;

test.before(async () => {
  if (!fs.existsSync(path.join(root, "content", "worksheets.json"))) throw new Error("run `npm run build-content` first");
  server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (req.url.split("?")[0] === "/") return fs.createReadStream(path.join(root, "index.html")).pipe(res);
      res.writeHead(404); return res.end();
    }
    const head = fs.readFileSync(file).subarray(0, 2);
    const sniffed = head[0] === 0x89 ? "image/png" : head[0] === 0xff && head[1] === 0xd8 ? "image/jpeg" : "application/octet-stream";
    res.writeHead(200, { "content-type": types[path.extname(file)] || sniffed });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ channel: "chrome" });
});
test.after(async () => {
  await browser?.close();
  server?.close();
});

// A page wired to a fake backend [cfg.offline, or localStorage.__offline set mid-test, fails every call like a dead network].
async function open(cfg, hash = "") {
  const page = await browser.newPage();
  await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
  await page.addInitScript((cfg) => {
    if (cfg.local && !localStorage.getItem("__seeded")) {
      Object.entries(cfg.local).forEach(([k, v]) => localStorage.setItem("hira." + k, JSON.stringify(v)));
      localStorage.setItem("__seeded", "1");
    }
    const log = (window.__log = []);
    const down = () => { if (cfg.offline || localStorage.getItem("__offline")) throw new TypeError("Failed to fetch"); };
    const listed = () => { down(); if (!cfg.allowed) throw new Error("Object not found"); };
    window.__played = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__played.push(this.src); return play.call(this); };
    window.HIRA_TEST_BACKEND = {
      session: async () => (localStorage.getItem("__out") ? null : cfg.user),
      signIn: async () => log.push("signIn"),
      signOut: async () => { log.push("signOut"); localStorage.setItem("__out", "1"); },
      isAllowed: async () => { down(); return cfg.allowed; },
      content: async () => { listed(); log.push("content"); return (await fetch("content/worksheets.json")).json(); },
      signedUrls: async (paths) => { listed(); return new Map(paths.map((p) => [p, "content/" + p])); },
      loadProgress: async () => { down(); return JSON.parse(localStorage.getItem("__remote")) ?? cfg.remote ?? null; },
      saveProgress: async (id, data) => { down(); log.push({ save: structuredClone(data) }); localStorage.setItem("__remote", JSON.stringify(data)); },
      loadStudy: async () => { down(); if (cfg.studyDown) throw new TypeError("Failed to fetch"); return JSON.parse(localStorage.getItem("__remoteStudy")) ?? cfg.remoteStudy ?? null; },
      saveStudy: async (id, study) => { down(); log.push({ study: structuredClone(study) }); localStorage.setItem("__remoteStudy", JSON.stringify(study)); },
    };
  }, cfg);
  // A fixed start time that then runs on [cfg.clock = 03:58 today, for the 4 am day].
  if (cfg.clock) { await page.clock.install({ time: cfg.clock }); await page.clock.resume(); }
  await page.goto(base + hash);
  await page.waitForLoadState("networkidle");
  return page;
}
const me = { id: "u1", email: "me@example.com" };
const saves = (page) => page.evaluate(() => window.__log.filter((l) => l.save).map((l) => l.save));

test("signed out: only the sign-in screen, nothing loaded", async () => {
  const page = await open({ user: null }, "#sheets");
  assert.equal(await page.locator("#google").isVisible(), true);
  assert.equal(await page.locator("nav").isVisible(), false);
  assert.equal(await page.locator(".cell, .lesson-card").count(), 0);
  await page.click("#google");
  assert.deepEqual(await page.evaluate(() => window.__log), ["signIn"]);
  await page.close();
});

test("a refused Google sign-in shows Supabase's reason", async () => {
  const page = await open({ user: null }, "?error_description=Signups+not+allowed+for+this+instance#learn");
  assert.match(await page.textContent(".gate-error"), /Signups not allowed/);
  assert.equal(new URL(page.url()).search, "");
  await page.close();
});

test("an account that isn't listed is stopped at the door", async () => {
  const page = await open({ user: me, allowed: false }, "#sheets");
  assert.match(await page.textContent(".gate"), /me@example\.com isn't on the list/);
  assert.equal(await page.locator("nav").isVisible(), false);
  assert.equal(await page.locator(".lesson-card, .cell, .grid").count(), 0);
  await page.close();
});

test("a listed account gets the worksheets and Tofugu's audio", async () => {
  const page = await open({ user: me, allowed: true }, "#sheets");
  assert.equal(await page.locator("main .grid h2").count(), 9 + 5);
  await page.goto(base + "#learn/1");
  await page.locator(".speak.clip").first().click();
  assert.match((await page.evaluate(() => window.__played))[0], /content\/audio\/3042\.mp3$/);
  await page.close();
});

test("progress from another device merges in, and new answers sync back", async () => {
  const page = await open({
    user: me, allowed: true,
    remote: { progress: { か: { box: 4, right: 6, wrong: 0 } }, "quiz.best": {}, "sheets.done": {}, "reading.done": [], savedAt: 50, resetAt: 0 },
    local: { progress: { き: { box: 2, right: 1, wrong: 0 } }, "sync.savedAt": 60 },
  }, "#chart");
  assert.equal(await page.getAttribute("td[data-kana='か']", "class"), "box-4");
  assert.equal(await page.getAttribute("td[data-kana='き']", "class"), "box-2");
  const first = (await saves(page)).at(-1);
  assert.deepEqual(Object.keys(first.progress).sort(), ["か", "き"]);

  await page.goto(base + "#quiz/a/1");
  const kana = await page.textContent("#kana");
  const romaji = await page.evaluate((k) => HIRAGANA.KANA.find((x) => x.kana === k).romaji, kana);
  await page.type("#in", romaji);
  await page.waitForFunction((k) => window.__log.some((l) => l.save?.progress?.[k]), kana, { timeout: 5000 });
  const last = (await saves(page)).at(-1);
  assert.deepEqual(Object.keys(last.progress).sort(), ["か", "き", kana].sort());
  await page.close();
});

test("offline after a past sign-in: lessons work, worksheets explain why not", async () => {
  const page = await open({ user: me, allowed: true, offline: true, local: { "sync.allowed": true } }, "#learn");
  assert.equal(await page.locator("nav").isVisible(), true);
  assert.equal(await page.locator(".lesson-card").count(), 13 + 10);
  assert.match(await page.textContent("#sync-note"), /Offline/);
  await page.goto(base + "#sheets");
  assert.match(await page.textContent("main"), /Can't load the worksheets/);
  await page.close();
});

test("offline on a device that never checked in stays locked", async () => {
  const page = await open({ user: me, allowed: true, offline: true }, "#learn");
  assert.match(await page.textContent(".gate"), /Can't reach the server/);
  await page.close();
});

test("signing out clears this device's copy of the account", async () => {
  const page = await open({ user: me, allowed: true, local: { progress: { く: { box: 3, right: 3, wrong: 0 } } } }, "#learn");
  await page.click("#signout");
  await page.waitForSelector("#google");
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => /^hira\.(progress|quiz|sheets|reading|sync)/.test(k)));
  assert.deepEqual(left, []);
  await page.close();
});

test("a lesson card reveals Tofugu's drawing on request, and hides it again", async () => {
  const page = await open({ user: me, allowed: true }, "#learn/2");
  assert.equal(await page.locator(".kana-card .art").count(), 0);
  await page.locator(".kana-card").first().locator(".art-toggle").click();
  const img = page.locator(".kana-card").first().locator("img.art");
  await img.waitFor();
  assert.match(await img.getAttribute("src"), /content\/img\/304b$/);
  assert.ok(await img.evaluate((i) => i.complete && i.naturalWidth > 0), "the drawing actually decodes");
  await page.locator(".kana-card").first().locator(".art-toggle").click();
  assert.equal(await page.locator(".kana-card .art").count(), 0);
  await page.goto(base + "#chart");
  await page.click("td[data-kana='が']");
  assert.equal(await page.locator(".modal .art-toggle").count(), 0, "dakuten have no drawings");
  await page.click("[data-close]");
  await page.click("td[data-kana='か']");
  assert.equal(await page.locator(".modal .art-toggle").count(), 1);
  await page.close();
});

test("a flashcard keeps its drawing hidden until the card is flipped", async () => {
  const page = await open({ user: me, allowed: true }, "#cards/a");
  const slot = page.locator(".card-art");
  assert.equal(await slot.evaluate((e) => getComputedStyle(e).visibility), "hidden");
  await page.click("#card");
  assert.equal(await slot.evaluate((e) => getComputedStyle(e).visibility), "visible");
  await page.close();
});

test("after a quiz miss the drawing can be opened and Enter still moves on", async () => {
  const page = await open({ user: me, allowed: true }, "#quiz/a/1");
  const first = await page.textContent("#kana");
  await page.fill("#in", "zz");
  await page.press("#in", "Enter");
  await page.click("#fb .art-toggle");
  await page.locator("#fb img.art").waitFor();
  await page.keyboard.press("Enter");
  assert.notEqual(await page.textContent("#kana"), first);
  await page.close();
});

// A miss came back once and the counter's total stayed put, so it sat at 15 / 15 while the quiz kept asking.
test("a quiz miss comes back twice, the counter counts it, and no kana repeats within five", async () => {
  const page = await open({ user: me, allowed: true }, "#quiz/a,k,s/1");
  const seen = [await page.textContent("#kana")];
  await page.fill("#in", "zz");
  await page.press("#in", "Enter");
  await page.keyboard.press("Enter");
  assert.equal(await page.textContent("#prog"), "2 / 17");
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const k = await page.textContent("#kana");
    seen.push(k);
    await page.type("#in", await romajiOf(page, k));
    await page.waitForFunction((n) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent.startsWith(n + " /"), seen.length + 1);
  }
  assert.equal(seen.length, 17);
  assert.equal(seen.filter((k) => k === seen[0]).length, 3);
  assert.deepEqual(seen.flatMap((k, i) => (seen.slice(i + 1, i + 6).includes(k) ? [i] : [])), [], seen.join(""));
  await page.close();
});

test("without signed links there is no illustration button", async () => {
  const page = await open({ user: me, allowed: true, offline: true, local: { "sync.allowed": true } }, "#learn/1");
  assert.equal(await page.locator(".art-toggle").first().isVisible(), false);
  await page.close();
});

// Katakana was added below hiragana; these guard the order, the borrowed sounds and the katakana-only parts.
const listed = { user: me, allowed: true };
const romajiOf = (page, kana) => page.evaluate((k) => HIRAGANA.KANA.find((x) => x.kana === k).romaji, kana);

test("katakana comes after hiragana on the Learn page, the picker and the chart", async () => {
  const page = await open(listed, "#learn");
  const hrefs = await page.$$eval(".lesson-card", (as) => as.map((a) => a.getAttribute("href")));
  assert.equal(hrefs[0], "#learn/1");
  assert.ok(hrefs.indexOf("#learn/k1") > hrefs.indexOf("#reading"), "katakana steps follow the hiragana reading card");
  await page.goto(base + "#quiz");
  assert.deepEqual(await page.$$eval(".picker-script h3", (h) => h.map((x) => x.textContent)), ["Hiragana", "Katakana"]);
  await page.goto(base + "#chart");
  assert.deepEqual(await page.$$eval("main h2", (h) => h.map((x) => x.textContent.split(" ")[0])), ["Hiragana", "Katakana"]);
  await page.close();
});

test("a katakana lesson borrows the hiragana recording and has its own drawing", async () => {
  const page = await open(listed, "#learn/k1");
  assert.equal(await page.locator(".kana-card .big").first().textContent(), "ア");
  await page.locator(".kana-card").first().locator(".speak.clip").click();
  await page.locator(".kana-card").first().locator(".art-toggle").click();
  await page.locator(".kana-card").first().locator("img.art").waitFor();
  assert.match((await page.evaluate(() => window.__played)).at(-1), /content\/audio\/3042\.mp3$/, "ア plays あ");
  assert.match(await page.locator(".kana-card img.art").first().getAttribute("src"), /content\/img\/30a2$/);
  await page.close();
});

test("extended sounds play their own clips", async () => {
  const page = await open(listed, "#chart");
  await page.click("td[data-kana='ファ']");
  await page.locator(".modal .speak.clip").click();
  assert.match((await page.evaluate(() => window.__played)).at(-1), /content\/audio\/30d5-30a1\.mp3$/);
  assert.equal(await page.locator(".modal .art-toggle").count(), 0, "no drawing for extended sounds");
  await page.close();
});

test("the chart keeps every extended sound, even three that share a column", async () => {
  const page = await open(listed, "#chart");
  for (const k of ["シェ", "ジェ", "チェ", "ヴ", "ン", "ヂャ"]) assert.equal(await page.locator(`td[data-kana='${k}']`).count(), 1, k);
  await page.close();
});

// A slip like "si" for し or "sya" for しゃ counted as right because it was another accepted spelling; only the standard one counts now.
test("the quiz and the worksheets take only the standard spelling", async () => {
  const page = await open(listed, "#quiz/k-x-t,k-x-dh/1");
  const typed = { ティ: "thi", トゥ: "twu", ディ: "dhi", ドゥ: "dwu" };
  for (let n = 0; n < 4; n++) {
    const kana = await page.textContent("#kana");
    await page.type("#in", typed[kana]);
    await page.press("#in", "Enter");
    assert.equal((await page.textContent("#fb .ans")).split(" ")[0], await romajiOf(page, kana));
    await page.keyboard.press("Enter");
  }
  assert.equal(await page.textContent("#bad"), "4");
  assert.equal(await page.textContent("#ok"), "0");
  await page.goto(base + "#sheets/s");
  const cells = await page.$$eval(".cell .kana", (els) => els.map((e) => e.textContent));
  const inputs = await page.$$(".cell input");
  for (let i = 0; i < inputs.length; i++) await inputs[i].fill(cells[i] === "し" ? "si" : await romajiOf(page, cells[i]));
  await page.click("#check");
  const shi = cells.filter((k) => k === "し").length;
  assert.ok(shi > 0);
  assert.ok((await page.textContent("#score")).includes(` ${cells.length - shi} / ${cells.length}`), "every し marked wrong");
  await page.close();
});

test("a katakana worksheet checks katakana answers", async () => {
  const page = await open(listed, "#sheets");
  assert.deepEqual(await page.$$eval("main > h2", (h) => h.map((x) => x.textContent)), ["Hiragana", "Katakana"]);
  await page.goto(base + "#sheets/k-ak");
  const cells = await page.$$eval(".cell .kana", (els) => els.map((e) => e.textContent));
  const inputs = await page.$$(".cell input");
  for (let i = 0; i < inputs.length; i++) await inputs[i].fill(await romajiOf(page, cells[i]));
  await page.click("#check");
  assert.match(await page.textContent("#score"), /48 \/ 48/);
  await page.close();
});

test("katakana sentences read as romaji, long vowels and small vowels included", async () => {
  const page = await open(listed, "#reading/2/0");
  assert.equal(await page.locator(".row .btn").filter({ hasText: "Katakana" }).count(), 1);
  await page.keyboard.press("r");
  assert.equal(await page.textContent(".romaji-line"), "haroo! mai neemu izu mami. watto abauto yuu?");
  const n = await page.evaluate(() => [...document.querySelectorAll(".dot")].length);
  let found = false;
  for (let j = 0; j < n && !found; j++) {
    await page.goto(base + `#reading/2/${j}`);
    if ((await page.textContent("#sent")).includes("ズィス")) {
      await page.keyboard.press("r");
      assert.match(await page.textContent(".romaji-line"), /raiku zisu\./);
      found = true;
    }
  }
  assert.ok(found, "the ズィス sentence exists");
  await page.close();
});

test("the long-vowel step hides its Show button once the answer is out", async () => {
  const page = await open(listed, "#learn/k19");
  assert.equal(await page.locator("#burger").isVisible(), false);
  await page.click("#reveal-burger");
  assert.equal(await page.locator("#reveal-burger").isVisible(), false);
  assert.match(await page.textContent("#burger"), /^beekonchiizubaagaa/);
  await page.close();
});

// "Again" restarts a run in place, without the cleanup a page change does; the old run's timer and keys must not survive it.
test("pressing Again on a finished quiz leaves one timer running", async () => {
  const page = await open(listed, "#quiz/a/1");
  for (let n = 0; n < 5; n++) {
    await page.type("#in", await romajiOf(page, await page.textContent("#kana")));
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(3000);
  await page.click("#re");
  const seen = new Set();
  for (let n = 0; n < 14; n++) { seen.add(await page.textContent("#time")); await page.waitForTimeout(100); }
  assert.deepEqual([...seen].filter((t) => t !== "0:00" && t !== "0:01"), [], `timer showed ${[...seen].join(", ")}`);
  await page.close();
});


// Progress belongs to one account and survives a bad connection; each case is a way answers were lost or misfiled.
const answerOne = async (page) => page.type("#in", await romajiOf(page, await page.textContent("#kana")));

test("signing out with answers the server never got asks first, and keeps them on Cancel", async () => {
  const page = await open(listed, "#quiz/k/1");
  await page.evaluate(() => localStorage.setItem("__offline", "1"));
  await answerOne(page);
  await page.waitForFunction(() => /Offline/.test(document.querySelector("#sync-note").textContent), null, { timeout: 5000 });
  const asked = [];
  page.once("dialog", (d) => { asked.push(d.message()); d.dismiss(); });
  await page.click("#signout");
  await page.waitForTimeout(300);
  assert.match(asked[0] || "", /haven't reached the server/);
  assert.equal(Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.progress")))).length, 1);
  assert.equal(await page.locator("#google").count(), 0, "still signed in");
  await page.close();
});

test("another account signing in on this browser doesn't inherit the last one's progress", async () => {
  const page = await open({
    user: me, allowed: true,
    remote: { progress: { さ: { box: 2, right: 1, wrong: 0 } }, "quiz.best": {}, "sheets.done": {}, "reading.done": [], savedAt: 50, resetAt: 0 },
    local: { progress: { か: { box: 5, right: 20, wrong: 0 } }, "sheets.done": { k: 95 }, "sync.user": "someone-else" },
  }, "#chart");
  const remote = await page.evaluate(() => JSON.parse(localStorage.getItem("__remote")));
  assert.equal(remote?.progress?.か, undefined, "nothing of the other account's reached this row");
  assert.deepEqual(Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.progress")))), ["さ"]);
  assert.equal(await page.getAttribute("td[data-kana='か']", "class"), "box-0");
  await page.close();
});

test("a boot with nothing new doesn't write the row again", async () => {
  const row = { progress: { か: { box: 4, right: 6, wrong: 0 } }, "quiz.best": {}, "sheets.done": {}, "reading.done": [], resetAt: 0, savedAt: 50 };
  const page = await open({ user: me, allowed: true, remote: row, local: { progress: row.progress, "sync.savedAt": 50 } }, "#learn");
  assert.equal(await page.locator(".lesson-card").count(), 13 + 10);
  assert.deepEqual(await saves(page), []);
  await page.close();
});

test("a reset outranks the last one even when this device's clock is behind", async () => {
  const later = Date.now() + 1e9;
  const page = await open({
    user: me, allowed: true,
    remote: { progress: { か: { box: 5, right: 20, wrong: 0 } }, "quiz.best": {}, "sheets.done": {}, "reading.done": [], savedAt: later, resetAt: later },
    local: { "sync.resetAt": later },
  }, "#chart");
  page.once("dialog", (d) => d.accept());
  await page.click("#reset");
  await page.waitForFunction((t) => window.__log.some((l) => l.save?.resetAt > t), later, { timeout: 5000 });
  assert.deepEqual((await saves(page)).at(-1).progress, {});
  await page.close();
});

test("leaving a quiz right after the last answer stays on the page you went to", async () => {
  const page = await open(listed, "#quiz/a/1");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (let n = 0; n < 4; n++) { await answerOne(page); await page.waitForTimeout(250); }
  const romaji = await romajiOf(page, await page.textContent("#kana"));
  await page.evaluate((r) => {
    const input = document.querySelector("#in");
    input.value = r;
    input.dispatchEvent(new Event("input"));
    location.hash = "#chart";
  }, romaji);
  await page.waitForTimeout(500);
  assert.equal(await page.textContent("main h1"), "Kana chart");
  assert.deepEqual(errors, []);
  await page.close();
});

test("a quiz link naming no known kana opens the picker, not a 0-kana run", async () => {
  const page = await open(listed, "#quiz/zz/1");
  assert.equal(await page.locator("#go").count(), 1);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.quiz.best"))), {});
  await page.close();
});

test("the last worksheet of each script leads to that script's reading", async () => {
  const page = await open(listed, "#learn");
  for (const [id, reading] of [["youon", "#reading/0/0"], ["k-rwn", "#reading/2/0"]]) {
    await page.goto(base + "#sheets/" + id);
    while (await page.locator("#check").count()) {
      await page.click("#check");
      if (await page.locator("#fin").count()) { await page.click("#fin"); break; }
      await page.click("#skip");
    }
    assert.equal(await page.locator("a.btn", { hasText: "Reading practice" }).getAttribute("href"), reading, id);
  }
  await page.close();
});

// The picker split step 7 into まみむめも and やゆよ, so its chips no longer lined up with the Learn steps.
test("the picker's main-kana chips are the Learn steps, step 7 included", async () => {
  const page = await open(listed, "#quiz");
  const steps = await page.evaluate(() => [...HIRAGANA.LESSONS, ...HIRAGANA.KATA_LESSONS].slice(0, 9).concat(HIRAGANA.KATA_LESSONS.slice(0, 5))
    .map((l) => l.title.replace(/ /g, "")));
  const chips = await page.$$eval(".picker", (ps) => [ps[0], ps[3]].flatMap((p) => [...p.querySelectorAll(".chip")].map((c) => c.textContent)));
  assert.deepEqual(chips, steps);
  await page.click("[data-none='hiragana:main']");
  await page.click(".chip >> text=まみむめもやゆよ");
  assert.equal(await page.textContent("#count"), "8 kana × 1");
  await page.click("#go");
  assert.match(decodeURIComponent(page.url()), /#quiz\/m,y\/1$/);
  await page.close();
});

// Every dakuten kana showed its column's story, so ぎ read "the car (ka) crashes into the guard rail (ga)".
test("a dakuten kana past the first in its column explains itself, not the column's story", async () => {
  const page = await open(listed, "#chart");
  await page.click("td[data-kana='ぎ']");
  assert.match(await page.textContent(".modal"), /き \(ki\) \+ ゛ = ぎ \(gi\)/);
  assert.doesNotMatch(await page.textContent(".modal"), /car/);
  await page.click("[data-close]");
  await page.click("td[data-kana='ピ']");
  assert.match(await page.textContent(".modal"), /ヒ \(hi\) \+ ゜ = ピ \(pi\)/);
  await page.close();
});

// Dakuten lessons showed bare cells that needed a click per kana, all 25 on one page; each column is its own step of full cards now.
test("each dakuten column is its own step of full cards, no popup needed", async () => {
  const page = await open(listed, "#learn/10");
  assert.equal(await page.textContent("main h1"), "が ぎ ぐ げ ご");
  assert.equal(await page.locator(".kana-card").count(), 5);
  const gi = page.locator(".kana-card", { has: page.locator(".big", { hasText: /^ぎ$/ }) });
  assert.match(await gi.textContent(), /き \(ki\) \+ ゛ = ぎ \(gi\)/);
  assert.equal(await page.locator(".kana-card .art-toggle").count(), 0, "Tofugu drew no dakuten");
  await page.goto(base + "#learn/14");
  assert.equal(await page.textContent("main h1"), "ぱ ぴ ぷ ぺ ぽ");
  assert.equal(await page.locator(".task a", { hasText: "Worksheet" }).getAttribute("href"), "#sheets/dakuten");
  await page.goto(base + "#learn/k6");
  assert.equal(await page.locator(".kana-card").count(), 5);
  await page.close();
});

// Splitting dakuten and extended sounds into a step per column put 31 cards on the Learn page; each set is one card that opens its steps.
test("the Learn page shows one card per set, which opens that set's steps", async () => {
  const page = await open(listed, "#learn");
  const hrefs = await page.$$eval(".lesson-card", (as) => as.map((a) => a.getAttribute("href")));
  assert.deepEqual(hrefs.filter((h) => /dakuten|extended/.test(h)), ["#learn/dakuten", "#learn/kdakuten", "#learn/kextended"]);
  assert.ok(!hrefs.includes("#learn/10") && hrefs.includes("#learn/15"), "set steps hide, the step after them shows");
  assert.match(await page.textContent(".lesson-card[href='#learn/dakuten']"), /Steps 10–14[\s\S]*Dakuten · 5 steps · 25 kana/);
  await page.click(".lesson-card[href='#learn/dakuten']");
  assert.equal(await page.textContent("main h1"), "Dakuten");
  const steps = await page.$$eval(".lesson-card", (as) => as.map((a) => a.getAttribute("href")));
  assert.deepEqual(steps, Array.from({ length: 5 }, (_, i) => "#learn/" + (10 + i)));
  await page.goto(base + "#learn/kextended");
  assert.equal(await page.locator(".lesson-card").count(), 7);
  await page.close();
});

// A step per combination column was 11 steps of 3 kana each; they are one step again, a row of three full cards per column.
test("the combinations are one step with a row per column", async () => {
  const page = await open(listed, "#learn/15");
  assert.equal(await page.textContent("main h1"), "きゃ しゅ ちょ");
  assert.equal(await page.locator(".kana-row").count(), 11);
  assert.equal(await page.locator(".kana-row .row-cards > .kana-card").count(), 33, "three full cards a row");
  const sh = page.locator(".kana-row", { has: page.locator(".big", { hasText: /^しゃ$/ }) });
  assert.match(await sh.textContent(), /し \(shi\) \+ small ゃゅょ[\s\S]*しゃ\s*sha[\s\S]*しゅ\s*shu[\s\S]*しょ\s*sho/);
  assert.match(decodeURIComponent(await page.locator(".task a", { hasText: "Start quiz" }).getAttribute("href")), /^#quiz\/y-ky,.*,y-py\/2$/);
  assert.equal(await page.locator(".task a", { hasText: "Worksheet" }).getAttribute("href"), "#sheets/youon");
  await page.goto(base + "#learn/k11");
  assert.equal(await page.locator(".kana-row").count(), 12, "katakana adds ヂャ");
  await page.close();
});

// The extended sounds were one step of 25 cells that each needed a click; each group is its own step of full cards now.
test("each extended-sound group is its own step of full cards", async () => {
  const page = await open(listed, "#learn/k14");
  assert.equal(await page.textContent("main h1"), "ファ フィ フェ フォ");
  assert.equal(await page.locator(".kana-card").count(), 4);
  assert.match(await page.locator(".kana-card").first().textContent(), /フ \(fu\) \+ ァ = ファ \(fa\)/);
  await page.goto(base + "#learn/k12");
  const va = page.locator(".kana-card", { has: page.locator(".big", { hasText: /^ヴァ$/ }) });
  assert.match(await va.textContent(), /ヴ \(vu\) \+ ァ = ヴァ \(va\)/, "spelled from ヴ, listed after it");
  await page.close();
});

// The Learn page's reading card led to a page with no way back but the browser's own button.
test("reading opened from Learn links back to where it came from, and only then", async () => {
  const page = await open(listed, "#learn");
  await page.click(".lesson-card[href='#reading']");
  assert.equal(await page.getAttribute("#back", "href"), "#learn");
  await page.click("a.btn >> text=Practice #2");
  assert.equal(await page.textContent("#back"), "← All steps", "switching sheets keeps the way back");
  await page.click("#back");
  await page.waitForSelector(".lesson-card");
  await page.goto(base + "#learn/16");
  await page.click("a.btn >> text=Reading practice");
  assert.equal(await page.textContent("#back"), "← Step 16");
  await page.goto(base + "#chart");
  await page.click("nav a[data-tab='reading']");
  await page.waitForSelector("#sent");
  assert.equal(await page.locator("#back").count(), 0, "the menu's Reading has nowhere to go back to");
  await page.close();
});

// ん waited for Enter on "n" in case "nn" followed, the only kana that didn't move on by itself.
test("typing n for ん moves on by itself like every other kana", async () => {
  const page = await open(listed, "#quiz/w,k-w/1");
  for (let n = 0; n < 6; n++) {
    const kana = await page.textContent("#kana");
    await page.type("#in", kana === "ん" || kana === "ン" ? "n" : await romajiOf(page, kana));
    await page.waitForTimeout(250);
  }
  assert.match(await page.textContent("main"), /100%accuracy/);
  await page.close();
});

// A quiz only offered the misses back, so a kana you got right after a long think never came up again.
test("a finished quiz offers the missed plus the slowest quarter, and drills them", async () => {
  const page = await open(listed, "#quiz/a,k/1");
  const missed = await page.textContent("#kana");
  await page.fill("#in", "zz");
  await page.press("#in", "Enter");
  await page.keyboard.press("Enter");
  // Three kana answered at 0.9s, 0.6s and 0.3s against the rest at once [9 clean kana, 25% = 3].
  const slow = ["こ", "く", "け", "か"].filter((k) => k !== missed).slice(0, 3);
  const play = async () => {
    const seen = [];
    while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
      const k = await page.textContent("#kana");
      seen.push(k);
      const wait = [900, 600, 300][slow.indexOf(k)];
      if (wait) await page.waitForTimeout(wait);
      // The counter, not `seen`, says the answer landed [the opening miss puts it one ahead, and く got typed twice: "kuke"].
      const prog = await page.textContent("#prog");
      await page.type("#in", await romajiOf(page, k));
      await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
    }
    return seen;
  };
  await play();
  const drills = await page.locator("button.slow").allTextContents();
  assert.deepEqual(drills, ["Missed + slowest 25% 4 kana"], "50% runs into the instant ones, a tie that takes in all 10");
  await page.click("button.slow");
  const seen = await play();
  assert.equal(seen.length, 12);
  assert.deepEqual([...new Set(seen)].sort(), [missed, ...slow].sort());
  await page.close();
});

// Stroke order opens on request and closes again [あ draws 3 numbered strokes, a second press clears them].
test("a lesson card draws a kana's strokes in order on request, and hides them again", async () => {
  const page = await open(listed, "#learn/1");
  const card = page.locator(".kana-card").first();
  assert.equal(await card.locator(".strokes").count(), 0);
  await card.locator(".stroke-toggle").click();
  await card.locator(".strokes path").first().waitFor();
  assert.equal(await card.locator(".strokes path").count(), 3);
  assert.deepEqual(await card.locator(".strokes text").allTextContents(), ["1", "2", "3"]);
  await card.locator(".stroke-toggle").click();
  assert.equal(await card.locator(".strokes").count(), 0);
  await page.close();
});

test("a combination kana shows the strokes of each of its characters", async () => {
  const page = await open(listed, "#chart");
  await page.click("td[data-kana='キャ']");
  await page.click(".modal .stroke-toggle");
  await page.locator(".modal .strokes path").first().waitFor();
  const counts = await page.locator(".modal .strokes svg").evaluateAll((svgs) => svgs.map((s) => s.querySelectorAll("path").length));
  assert.deepEqual(counts, [3, 2]);
  // ャ draws after キ instead of alongside it [its first stroke is the 4th, delay index 3].
  assert.equal(await page.locator(".modal .strokes svg").nth(1).locator("path").first().evaluate((p) => p.style.getPropertyValue("--i")), "3");
  await page.close();
});

test("a flashcard's stroke order waits behind the flip with the drawing", async () => {
  const page = await open(listed, "#cards/a");
  assert.equal(await page.locator(".card-art .stroke-toggle").count(), 1);
  assert.equal(await page.locator(".card-art").evaluate((e) => getComputedStyle(e).visibility), "hidden");
  await page.close();
});

test("stroke order that fails to load says so, and the next press tries again", async () => {
  const page = await open(listed, "#learn/1");
  let calls = 0;
  await page.route("**/data/strokes.json", (r) => (++calls === 1 ? r.abort() : r.continue()));
  const toggle = page.locator(".kana-card").first().locator(".stroke-toggle");
  await toggle.click();
  await page.waitForFunction(() => /Can.t load/.test(document.querySelector(".stroke-toggle").textContent));
  await toggle.click();
  await page.locator(".kana-card").first().locator(".strokes path").first().waitFor();
  assert.equal(calls, 2);
  await page.close();
});

// A stroke that hasn't started showed a dot where it ends [round cap on a dash pattern exactly one path long].
test("a stroke waiting its turn puts no ink on screen", async () => {
  const page = await open(listed, "#learn/1");
  await page.addStyleTag({ content: "* { animation-play-state: paused !important; }" });
  await page.locator(".kana-card").first().locator(".stroke-toggle").click();
  const svg = page.locator(".kana-card .strokes svg").first();
  await svg.locator("path").first().waitFor({ state: "attached" });
  const png = (await svg.screenshot()).toString("base64");
  const ink = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
    c.getContext("2d").drawImage(img, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 120 && d[i + 1] < 120 && d[i + 2] < 120) n++;
    return n;
  }, png);
  assert.equal(ink, 0);
  await page.close();
});

// The slot copied the drawing's full-width rule, which in a combination card's column layout pushed the button into the
// next card [on #learn/15 at 360 px the button sat at x 118–202 under きゅ, and the page grew to 422 px].
test("on a phone, a combination card keeps its stroke order inside the card", async () => {
  const page = await open(listed, "#learn/15");
  await page.setViewportSize({ width: 360, height: 740 });
  const outside = () => page.locator(".kana-row .kana-card").evaluateAll((cards) => cards.filter((c) => {
    const box = c.getBoundingClientRect();
    return [...c.querySelectorAll(".stroke-toggle, .strokes svg")].some((el) => {
      const r = el.getBoundingClientRect();
      return r.left < box.left - 0.5 || r.right > box.right + 0.5;
    });
  }).length);
  assert.equal(await outside(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  await page.locator(".kana-row .stroke-toggle").first().click({ timeout: 3000 });
  await page.locator(".kana-row .strokes path").first().waitFor();
  assert.equal(await outside(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
  await page.close();
});

// The popup grew past a phone screen once the strokes opened under the drawing [シ ran from y -91 to 731 on a 640 px screen].
test("on a phone, the chart popup with drawing and strokes open fits the screen and still closes", async () => {
  const page = await open(listed, "#chart");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.click("td[data-kana='シ']");
  await page.click(".modal .art-toggle");
  await page.locator(".modal img.art").waitFor();
  await page.click(".modal .stroke-toggle");
  await page.locator(".modal .strokes path").first().waitFor();
  const box = await page.locator(".modal").boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 640, `modal spans y ${box.y} to ${box.y + box.height}`);
  await page.click(".modal [data-close]", { timeout: 3000 });
  assert.equal(await page.locator(".modal").count(), 0);
  await page.close();
});

test("clicking a drawn kana plays its strokes again from the first", async () => {
  const page = await open(listed, "#learn/1");
  await page.locator(".kana-card .stroke-toggle").first().click();
  await page.locator(".kana-card .strokes path").first().waitFor();
  await page.evaluate(() => { document.querySelector(".strokes svg").__old = true; });
  await page.click(".kana-card .strokes");
  assert.equal(await page.evaluate(() => document.querySelector(".strokes svg").__old), undefined);
  await page.close();
});

test("a second press while the strokes are still loading cancels them", async () => {
  const page = await open(listed, "#learn/1");
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route("**/data/strokes.json", async (r) => { await held; r.continue(); });
  const toggle = page.locator(".kana-card").first().locator(".stroke-toggle");
  await toggle.click();
  await toggle.click();
  release();
  await page.waitForResponse("**/data/strokes.json");
  await page.waitForTimeout(200);
  assert.equal(await page.locator(".strokes").count(), 0);
  assert.equal(await toggle.textContent(), "Stroke order");
  await page.close();
});

// ---------- Japanese section ----------
// The vocabulary deck lives in its own `study` column because the deployed sync rewrites `data` with the kana keys only;
// these drive the section against the fake backend: its tabs, the first day, the schedule an answer writes, practice
// that must not write, and the deck following the account like the kana do.
const { dayOf } = require("../srs.js");
const day = dayOf(Date.now());
const deckOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("hira.study") || "null"));
const studySaves = (page) => page.evaluate(() => window.__log.filter((l) => l.study).map((l) => l.study));
const reviewed = (over) => ({ st: "review", ivl: 1, ease: 2.5, due: day + 1, n: 1, lapses: 0, first: day, last: day, ...over });
const deckWith = (cards) => ({ cards, settings: { newPerDay: 20, at: 0 }, savedAt: 1 });
const answer = async (page, g) => { await page.click("#card"); await page.click(`[data-g='${g}']`); };

test("the Japanese section has its own tabs, and the kana tabs stay as they were", async () => {
  const page = await open(listed, "#words");
  const tabs = () => page.locator("nav a:visible").evaluateAll((as) => as.map((a) => a.dataset.tab));
  assert.deepEqual(await tabs(), ["words"]);
  await page.click(".sections a[data-section-link='kana']");
  assert.deepEqual(await tabs(), ["learn", "cards", "quiz", "sheets", "reading", "chart"]);
  await page.close();
});

test("a fresh account is offered 20 new words, Japanese side first, with the reading over the kanji", async () => {
  const page = await open(listed, "#words");
  await page.locator("#new").waitFor();
  assert.deepEqual([await page.textContent("#new"), await page.textContent("#due")], ["20", "0"]);
  await page.click("#go");
  assert.equal(await page.textContent("#left"), "20 left");
  assert.equal(await page.locator(".face.front ruby rt").first().textContent(), "あき");
  await page.close();
});

test("Good on a new word brings it back tomorrow and syncs the deck apart from the kana", async () => {
  const page = await open(listed, "#words/review");
  await page.locator(".face.front").waitFor();
  await answer(page, 3);
  const card = (await deckOf(page)).cards["秋|あき#r"];
  assert.deepEqual([card.due, card.ivl, card.n], [day + 1, 1, 1]);
  // Leaving a session part-way uploads at once rather than after the 20 s quiet spell.
  await page.click("a[href='#words']");
  await page.waitForFunction(() => window.__log.some((l) => l.study?.cards?.["秋|あき#r"]), null, { timeout: 3000 });
  await page.close();
});

test("Again brings a word back three cards later in the same session", async () => {
  const page = await open(listed, "#words/review");
  await page.locator(".face.front").waitFor();
  const first = await page.locator(".face.front").innerHTML();
  await answer(page, 1);
  for (let i = 0; i < 3; i++) {
    assert.notEqual(await page.locator(".face.front").innerHTML(), first);
    await answer(page, 3);
  }
  assert.equal(await page.locator(".face.front").innerHTML(), first);
  assert.equal(await page.textContent("#left"), "17 left");
  await page.close();
});

test("practice after the day's reviews never changes the deck", async () => {
  const seed = deckWith({ "秋|あき#r": reviewed(), "足|あし#r": reviewed({ miss: day }) });
  const page = await open({ ...listed, local: { "study.user": "u1", study: seed } }, "#words/practice/today");
  await page.locator(".face.front").waitFor();
  const before = (await deckOf(page)).cards;
  await answer(page, 1);
  while (!(await page.locator("h1", { hasText: "Practice done" }).count())) await answer(page, 3);
  assert.deepEqual((await deckOf(page)).cards, before);
  await page.close();
});

test("a deck from another device merges in card by card", async () => {
  const page = await open({
    ...listed,
    remoteStudy: deckWith({ "秋|あき#r": reviewed({ n: 5, ivl: 9, due: day + 9 }) }),
    local: { "study.user": "u1", study: deckWith({ "足|あし#r": reviewed(), "秋|あき#r": reviewed() }) },
  }, "#words");
  await page.waitForFunction(() => window.__log.some((l) => l.study), null, { timeout: 5000 });
  const merged = (await studySaves(page)).at(-1).cards;
  assert.deepEqual(Object.keys(merged).sort(), ["秋|あき#r", "足|あし#r"]);
  assert.equal(merged["秋|あき#r"].n, 5);
  await page.close();
});

test("a word's English side asks with its meaning and type the day after, and shows the word as the answer", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: deckWith({ "秋|あき#r": reviewed({ first: day - 1, last: day - 1, due: day }) }) } }, "#words/review");
  await page.locator(".face.front ruby").waitFor();
  await answer(page, 3);
  assert.match(await page.textContent(".face.front"), /fall \(season\).*noun/s);
  assert.equal(await page.locator(".face.front ruby").count(), 0);
  await page.click("#card");
  assert.equal(await page.locator(".face.back ruby rt").first().textContent(), "あき");
  await page.close();
});

test("signing out takes the vocabulary deck off this device", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: deckWith({ "秋|あき#r": reviewed() }) } }, "#words");
  await page.click("#signout");
  await page.waitForSelector("#google");
  assert.equal(await page.evaluate(() => localStorage.getItem("hira.study")), null);
  await page.close();
});

test("another account signing in on this browser starts with an empty deck", async () => {
  const page = await open({ ...listed, local: { "study.user": "someone-else", study: deckWith({ "秋|あき#r": reviewed() }), "sync.user": "someone-else" } }, "#words");
  await page.locator("#new").waitFor();
  assert.deepEqual((await deckOf(page)).cards, {});
  assert.equal(await page.textContent("#new"), "20");
  await page.close();
});

test("fewer new words a day means fewer new cards", async () => {
  const page = await open(listed, "#words");
  await page.selectOption("#per", "10");
  assert.equal(await page.textContent("#new"), "10");
  assert.equal((await deckOf(page)).settings.newPerDay, 10);
  await page.close();
});

test("a word list that fails to load says so, and Try again loads it", async () => {
  const p = await open(listed, "#learn");
  let calls = 0;
  await p.route("**/data/vocab.json", (r) => (++calls === 1 ? r.abort() : r.continue()));
  await p.goto(base + "#words");
  await p.locator("#retry").waitFor();
  await p.click("#retry");
  await p.locator("#new").waitFor();
  assert.equal(calls, 2);
  await p.close();
});

test("keys other than 1 to 4 on a shown answer do nothing and break nothing", async () => {
  const page = await open(listed, "#words/review");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  for (const key of ["Shift", "a", "5", "ArrowLeft"]) await page.keyboard.press(key);
  await page.keyboard.press("3");
  assert.deepEqual(errors, []);
  assert.equal(await page.textContent("#left"), "19 left");
  await page.close();
});

// The word list arrives after a wait, and leaving meanwhile must not pull you back [Words → Chart before vocab.json lands].
test("leaving the Words page while the list loads stays on the page you went to", async () => {
  const page = await open(listed, "#learn");
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route("**/data/vocab.json", async (r) => { await held; r.continue(); });
  await page.goto(base + "#words");
  await page.goto(base + "#chart");
  release();
  await page.waitForResponse("**/data/vocab.json");
  await page.waitForTimeout(300);
  assert.equal(await page.textContent("main h1"), "Kana chart");
  assert.equal(await page.locator("#new").count(), 0);
  await page.close();
});

// Another device's clock ahead left later answers here looking already sent [its push stamped 13:00, this answer 12:10].
test("an answer made after syncing with a fast-clock device still asks before Sign out drops it", async () => {
  const page = await open({ ...listed, remoteStudy: { ...deckWith({}), savedAt: Date.now() + 3600e3 } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.evaluate(() => localStorage.setItem("__offline", "1"));
  await answer(page, 3);
  const asked = [];
  page.on("dialog", (d) => { asked.push(d.message()); d.dismiss(); });
  await page.click("#signout");
  await page.waitForTimeout(500);
  assert.equal(asked.length, 1);
  assert.ok((await deckOf(page)).cards["秋|あき#r"]);
  await page.close();
});

// Every answer pulled and pushed the whole deck [200 answers uploaded 65.6 MB].
test("answers upload together rather than one by one, and a finished session uploads at once", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: { ...deckWith({}), settings: { newPerDay: 3, at: 1 } } } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.waitForTimeout(300);
  const before = (await studySaves(page)).length;
  await answer(page, 3);
  await answer(page, 3);
  await page.waitForTimeout(2500);
  assert.equal((await studySaves(page)).length, before);
  await answer(page, 3);
  await page.locator("h1", { hasText: "Done for today" }).waitFor();
  await page.waitForFunction((n) => window.__log.filter((l) => l.study).length > n, before, { timeout: 3000 });
  await page.close();
});

test("a session that runs past 4 am files its answers under the new day", async () => {
  const start = new Date();
  start.setHours(3, 58, 0, 0);
  const page = await open({ ...listed, clock: start.getTime() }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.clock.setSystemTime(start.getTime() + 5 * 60e3);
  await answer(page, 3);
  assert.equal((await deckOf(page)).cards["秋|あき#r"].first, dayOf(start.getTime() + 5 * 60e3));
  await page.close();
});

test("the sync note says Offline when only the deck failed to sync", async () => {
  const page = await open({ ...listed, studyDown: true }, "#words");
  await page.locator("#new").waitFor();
  await page.waitForTimeout(300);
  assert.match(await page.textContent("#sync-note"), /Offline/);
  await page.close();
});

test("the end of a session counts the cards that got Again, not the presses", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: { ...deckWith({}), settings: { newPerDay: 1, at: 1 } } } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await answer(page, 1);
  await answer(page, 1);
  await answer(page, 3);
  assert.match(await page.textContent("main"), /1 card · 1 Again/);
  await page.close();
});

test("practice buttons count the cards a round will show, both sides of a word", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: deckWith({ "秋|あき#r": reviewed(), "秋|あき#p": reviewed() }) } }, "#words");
  await page.locator("#new").waitFor();
  assert.match(await page.textContent("a[href='#words/practice/n5']"), /\(2\)/);
  await page.close();
});

test("Enter on a focused grade button presses that button", async () => {
  const page = await open(listed, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.focus("[data-g='4']");
  await page.keyboard.press("Enter");
  assert.equal(await page.textContent("#left"), "19 left");
  assert.equal((await deckOf(page)).cards["秋|あき#r"].ivl, 4);
  await page.close();
});

// A deck with no owner tag belongs to nobody, so it isn't handed to whoever signs in [B's row got A's 秋 with n 7].
test("a deck left on this browser without an owner isn't handed to whoever signs in", async () => {
  const page = await open({ ...listed, local: { study: deckWith({ "秋|あき#r": reviewed({ n: 7 }) }) } }, "#words");
  await page.locator("#new").waitFor();
  assert.deepEqual((await deckOf(page)).cards, {});
  await page.close();
});

// On a phone the keyboard closed after every answer: the box went read-only, and Continue took the focus [a tap per kana to get it back].
test("the answer box keeps focus through a right answer, a miss and Continue, so a phone keyboard stays up", async () => {
  const page = await open(listed, "#quiz/a,k/1");
  await page.evaluate(() => {
    const box = document.querySelector("#in");
    window.__blurs = 0;
    window.__locks = 0;
    box.addEventListener("blur", () => window.__blurs++);
    new MutationObserver((m) => { window.__locks += m.length; }).observe(box, { attributes: true, attributeFilter: ["readonly", "disabled"] });
  });
  const prog = await page.textContent("#prog");
  await page.type("#in", await romajiOf(page, await page.textContent("#kana")));
  await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, prog);
  await page.type("#in", "zz");
  await page.press("#in", "Enter");
  await page.click("#fb .speak");
  await page.click("#next");
  assert.deepEqual(await page.evaluate(() => [window.__blurs, window.__locks, document.activeElement.id]), [0, 0, "in"]);
  await page.close();
});

test("letters typed while a right answer settles start the next answer", async () => {
  const page = await open(listed, "#quiz/k/1");
  const prog = await page.textContent("#prog");
  await page.keyboard.type((await romajiOf(page, await page.textContent("#kana"))) + "k");
  await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, prog);
  assert.equal(await page.inputValue("#in"), "k");
  await page.close();
});

test("a miss on the last kana leaves it for the Missed list instead of asking it twice in a row", async () => {
  const page = await open(listed, "#quiz/a/1");
  for (let i = 0; i < 4; i++) {
    const prog = await page.textContent("#prog");
    await page.type("#in", await romajiOf(page, await page.textContent("#kana")));
    await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, prog);
  }
  const last = await page.textContent("#kana");
  await page.type("#in", "zz");
  await page.press("#in", "Enter");
  await page.press("#in", "Enter");
  await page.locator("h1", { hasText: "Done!" }).waitFor();
  assert.match(await page.textContent(".miss-list"), new RegExp(last));
  await page.close();
});

test("the quiz uses the shared-kana rule [や and きゃ never back to back]", async () => {
  const page = await open(listed, "#quiz/y,y-k,y-sh/2");
  const seen = [];
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const prog = await page.textContent("#prog");
    const k = await page.textContent("#kana");
    seen.push(k);
    await page.type("#in", await romajiOf(page, k));
    await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
  }
  const shared = await page.evaluate((s) => s.slice(1).filter((k, i) => HiraOrder.shareKana({ kana: s[i] }, { kana: k })).length, seen);
  assert.equal(shared, 0, seen.join(" "));
  await page.close();
});

// A per-day change after syncing with a fast-clock device lost the next merge and quietly reverted.
test("changing new words a day sticks after syncing with a device whose clock runs ahead", async () => {
  const ahead = Date.now() + 3600e3;
  const page = await open({ ...listed, remoteStudy: { cards: {}, settings: { newPerDay: 20, at: ahead }, savedAt: ahead } }, "#words");
  await page.locator("#new").waitFor();
  await page.selectOption("#per", "10");
  await page.evaluate(() => HiraStudy.flush());
  assert.equal((await deckOf(page)).settings.newPerDay, 10);
  await page.close();
});

// Picking a whole script took a click on every kind's all or none [four for katakana].
test("a script's own all and none set every kind under it", async () => {
  const page = await open(listed, "#quiz");
  await page.click("[data-none='hiragana']");
  await page.click("[data-all='katakana']");
  const on = await page.$$eval(".picker", (ps) => ps.map((p) => [...p.querySelectorAll(".chip")].every((c) => c.classList.contains("on"))));
  assert.deepEqual(on, [false, false, false, true, true, true, true]);
  const katakana = await page.evaluate(() => HIRAGANA.KANA.filter((k) => k.script === "katakana").length);
  assert.equal(await page.textContent("#count"), `${katakana} kana × 1`);
  await page.close();
});

// Every selection kept its own best, so a row filled with Learn-step keys nobody looks up again [29 keys, 4 of them whole].
test("only quizzes of whole categories keep a best time, and the rest leave the row", async () => {
  const t = { ms: 60000, acc: 90 };
  const extended = "k-x-v,k-x-w,k-x-f,k-x-ts,k-x-e,k-x-t,k-x-dh";
  const page = await open({
    ...listed,
    remote: { progress: {}, "quiz.best": { "a,k,s/2": t, "a,k,s,t,n,h,m,y,r,w/1": t }, "sheets.done": {}, "reading.done": [], savedAt: 50, resetAt: 0 },
  }, "#quiz");
  assert.deepEqual(Object.keys((await saves(page)).at(-1)["quiz.best"]), ["a,k,s,t,n,h,m,y,r,w/1"]);
  await page.click("[data-none='hiragana']");
  await page.click("[data-all='hiragana:main']");
  assert.equal(await page.textContent("#best"), "Best: 1:00 at 90%");
  await page.click(".chip >> text=あいうえお");
  assert.equal(await page.textContent("#best"), "Times are kept for whole categories only");

  // Answers typed at once all tie, and a drill of every kana is never offered, so two of them wait [600 and 300 ms].
  const run = async (hash, waits = []) => {
    await page.goto(base + hash);
    for (let n = 0; await page.locator("#kana").count(); n++) {
      const prog = await page.textContent("#prog");
      if (waits[n]) await page.waitForTimeout(waits[n]);
      await page.type("#in", await romajiOf(page, await page.textContent("#kana")));
      await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
    }
  };
  await run("#quiz/a/1", [600, 300]);
  assert.equal(await page.textContent(".panel p.muted"), "");
  assert.ok(await page.locator(".slow").count(), "a partial quiz still drills on time");
  await run(`#quiz/${extended}/1`);
  assert.equal(await page.textContent(".panel p.muted"), "First run — now beat it.");
  assert.deepEqual(Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.quiz.best")))).sort(),
    ["a,k,s,t,n,h,m,y,r,w/1", `${extended}/1`]);
  await page.close();
});

// Reading sentences could only be ticked off as read, with nothing to check that they were.
test("a sentence typed in romaji marks the kana where it goes wrong, and counts as read once right", async () => {
  const page = await open(listed, "#reading/0/0");
  const answer = (await page.$$eval(".tok", (ts) => ts.map((t) => t.dataset.r).join(" ")));
  assert.match(answer, /^wa ta shi no ko do mo ha /);
  await page.fill("#typed", "watashinokodomowa");
  await page.press("#typed", "Enter");
  assert.equal(await page.textContent(".tok.off"), "は");
  assert.equal(await page.locator(".dot.done").count(), 0);
  await page.fill("#typed", answer.toUpperCase());
  await page.press("#typed", "Enter");
  assert.match(await page.getAttribute("#typed", "class"), /\bright\b/);
  assert.equal(await page.locator(".tok.off").count(), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.reading.done"))), ["0-0"]);
  await page.press("#typed", "Enter");
  assert.match(page.url(), /#reading\/0\/1$/);
  assert.equal(await page.inputValue("#typed"), "");
  await page.close();
});

// Writing: the mouse traces KanjiVG's own strokes over the pad [あ's 3 paths, box units turned into screen pixels].
const padKana = (page) => page.getAttribute("#say [data-say]", "data-say");
const strokesOf = (page, kana) => page.evaluate(async (kana) => {
  const all = await HiraStrokes.load();
  return [...kana].flatMap((c, j) => all[c].d.map((d) => HiraWrite.pathPoints(d).map(([x, y]) => [x + 109 * j, y])));
}, kana);
async function drawStroke(page, pts, dx = 0, dy = 0) {
  const r = await page.locator("#pad").boundingBox();
  const w = (await page.evaluate(() => document.querySelector("#pad").viewBox.baseVal.width));
  const at = ([x, y]) => [r.x + ((x + dx) / w) * r.width, r.y + ((y + dy) / 109) * r.height];
  await page.mouse.move(...at(pts[0]));
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...at(p));
  await page.mouse.up();
}
const writeKana = async (page) => { for (const s of await strokesOf(page, await padKana(page))) await drawStroke(page, s); };
const deckWrite = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("hira.study") || "{}").write);
const nextKana = (page, prog) => page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);

test("the Write switch on the quiz page starts a writing run of the picked kana", async () => {
  const page = await open(listed, "#quiz");
  await page.click("[data-mode='write']");
  assert.match(await page.textContent("#lead"), /stroke order/);
  await page.click("[data-none='hiragana']");
  await page.click(".chip >> text=あいうえお");
  await page.click("#go");
  assert.match(decodeURIComponent(page.url()), /#write\/a\/1$/);
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.textContent("#script"), "hiragana");
  assert.equal(await page.getAttribute("nav a.active", "data-tab"), "quiz");
  await page.close();
});

test("a kana written stroke by stroke counts as written, kept apart from reading, and uploads at the end", async () => {
  const page = await open(listed, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const done = [];
  while (await page.locator("#pad").count()) {
    const prog = await page.textContent("#prog");
    done.push(await padKana(page));
    await writeKana(page);
    await nextKana(page, prog);
  }
  assert.equal(await page.textContent("h1"), "Done!");
  assert.match(await page.textContent(".stats"), /100%/);
  const w = await deckWrite(page);
  assert.deepEqual(Object.keys(w.kana).sort(), [...done].sort());
  assert.deepEqual(w.kana[done[0]], { box: 2, right: 1, wrong: 0 });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.progress") || "{}")), {}, "reading progress untouched");
  // The deck's own upload waits 20 s, so a run that didn't flush would only show up long after this [5 s here].
  await page.waitForFunction(() => window.__log.some((l) => l.study?.write?.kana && Object.keys(l.study.write.kana).length === 5), null, { timeout: 5000 });
  await page.close();
});

test("a stroke missed three times shows faintly to trace, and the kana counts as a miss", async () => {
  const page = await open(listed, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const kana = await padKana(page);
  const [first, ...rest] = await strokesOf(page, kana);
  await drawStroke(page, first, 0, 40);
  await drawStroke(page, first, 0, 40);
  assert.equal(await page.locator("#pad .hint path").count(), 0, "two misses give no hint yet");
  await drawStroke(page, first, 0, 40);
  assert.equal(await page.locator("#pad .hint path").count(), 1);
  await page.click("[data-check='stroke']");
  assert.equal(await page.locator("#pad .hint path").count(), 1, "pressing the mode already on starts nothing over");
  await drawStroke(page, first);
  assert.equal(await page.locator("#pad .hint path").count(), 0, "the hint goes once the stroke is drawn");
  for (const s of rest) await drawStroke(page, s);
  await page.locator("#next").waitFor();
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 1, right: 0, wrong: 1 });
  assert.equal(await page.textContent("#bad"), "1");
  await page.close();
});

test("checking a whole kana takes every stroke in order, and a wrong one shows the outline", async () => {
  const page = await open({ ...listed, local: { "write.check": "whole" } }, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  let kana = await padKana(page);
  const strokes = await strokesOf(page, kana);
  for (const s of [...strokes].reverse()) await drawStroke(page, s);
  await page.click("#done");
  assert.equal(await page.locator("#pad .hint path").count(), strokes.length);
  assert.ok(await page.locator("#pad .ink .bad").count() > 0);
  assert.equal((await deckWrite(page)).kana[kana].wrong, 1);
  await page.click("#next");
  kana = await padKana(page);
  const prog = await page.textContent("#prog");
  for (const s of await strokesOf(page, kana)) await drawStroke(page, s);
  assert.equal(await page.locator("#pad .ink polyline").count(), (await strokesOf(page, kana)).length, "nothing is judged before Check");
  await page.keyboard.press("Enter");
  await nextKana(page, prog);
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 2, right: 1, wrong: 0 });
  await page.close();
});

test("a combination is written in two cells, the small kana in the second", async () => {
  const page = await open(listed, "#write/y-ky/1");
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.locator("#pad .guide rect").count(), 2);
  const kana = await padKana(page);
  const prog = await page.textContent("#prog");
  await writeKana(page);
  await nextKana(page, prog);
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 2, right: 1, wrong: 0 });
  await page.close();
});

test("the chart shows reading or writing, and a reset forgets the writing too", async () => {
  const page = await open({ ...listed, remoteStudy: { cards: {}, savedAt: 5, write: { kana: { か: { box: 4, right: 5, wrong: 0 } }, best: {}, resetAt: 0 } } }, "#chart");
  assert.equal(await page.getAttribute("td[data-kana='か']", "class"), "box-0");
  await page.click("#chart-mode [data-mode='write']");
  assert.equal(await page.getAttribute("td[data-kana='か']", "class"), "box-4");
  page.on("dialog", (d) => d.accept());
  await page.click("#reset");
  assert.equal(await page.getAttribute("td[data-kana='か']", "class"), "box-0");
  const w = await deckWrite(page);
  assert.deepEqual(w.kana, {});
  assert.ok(w.resetAt > 5);
  await page.close();
});
