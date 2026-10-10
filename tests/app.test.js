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
    };
  }, cfg);
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
  assert.equal(await page.locator(".lesson-card").count(), 17 + 14);
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
  assert.deepEqual(await page.$$eval(".picker-script", (h) => h.map((x) => x.textContent)), ["Hiragana", "Katakana"]);
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

test("a katakana quiz accepts the romaji and the guide's typing spellings", async () => {
  const page = await open(listed, "#quiz/k-x-t,k-x-dh/1");
  const typed = { ティ: "thi", トゥ: "twu", ディ: "dhi", ドゥ: "du" };
  for (let n = 0; n < 4; n++) {
    const kana = await page.textContent("#kana");
    await page.type("#in", typed[kana]);
    await page.waitForTimeout(250);
  }
  assert.match(await page.textContent("main"), /100%accuracy/);
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
  const page = await open(listed, "#learn/k13");
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
  assert.equal(await page.locator(".lesson-card").count(), 17 + 14);
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
