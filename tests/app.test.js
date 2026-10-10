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

// A page wired to a fake backend [cfg.offline makes every call fail like a dead network].
async function open(cfg, hash = "") {
  const page = await browser.newPage();
  await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
  await page.addInitScript((cfg) => {
    if (cfg.local && !localStorage.getItem("__seeded")) {
      Object.entries(cfg.local).forEach(([k, v]) => localStorage.setItem("hira." + k, JSON.stringify(v)));
      localStorage.setItem("__seeded", "1");
    }
    const log = (window.__log = []);
    const down = () => { if (cfg.offline) throw new TypeError("Failed to fetch"); };
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
  assert.equal(await page.locator("main .grid h2").count(), 9);
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
  assert.equal(await page.locator(".lesson-card").count(), 13);
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
