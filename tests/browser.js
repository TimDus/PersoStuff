// The browser harness the app-*.test.js files share: a local server, Chrome, and pages wired to a fake Supabase [one Chrome per file, so files run side by side].
const test = require("node:test");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = path.join(__dirname, "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg" };
let server, base, browser, cachingBrowser;
// Requests per path, and a switch that drops every data file [a server gone mid-visit].
const net = { hits: {}, dropData: false };

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
    const name = new URL(req.url, "http://x").pathname;
    net.hits[name] = (net.hits[name] || 0) + 1;
    if (net.dropData && name.startsWith("/data/")) return req.socket.destroy();
    // Data files kept like GitHub Pages keeps them [max-age=600], which only a page without routes caches.
    res.writeHead(200, { "content-type": types[path.extname(file)] || sniffed, ...(name.startsWith("/data/") && { "cache-control": "max-age=600" }) });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ channel: "chrome" });
});
test.after(async () => {
  await browser?.close();
  await cachingBrowser?.close();
  server?.close();
});

// A page wired to a fake backend [cfg.offline, or localStorage.__offline set mid-test, fails every call like a dead network].
async function open(cfg, hash = "") {
  // A route turns Chrome's HTTP cache off, so a case about caching blocks the CDN by DNS instead [cfg.cached].
  cachingBrowser ||= cfg.cached && await chromium.launch({ channel: "chrome", args: ["--host-resolver-rules=MAP cdn.jsdelivr.net ~NOTFOUND"] });
  const page = await (cfg.cached ? cachingBrowser : browser).newPage({ baseURL: base });
  if (!cfg.cached) await page.route("**/cdn.jsdelivr.net/**", (r) => r.abort());
  await page.addInitScript((cfg) => {
    if (cfg.local && !localStorage.getItem("__seeded")) {
      Object.entries(cfg.local).forEach(([k, v]) => localStorage.setItem("hira." + k, JSON.stringify(v)));
      localStorage.setItem("__seeded", "1");
    }
    // A fixed order for cases that type ahead [Math.random 0: #quiz/a,k/1 opens あ, い].
    if (cfg.rand0) Math.random = () => 0;
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
      // Koohii's file only when a case brings one, so the real content/koohii.json never decides a case [cfg.koohii; koohiiHang never answers, koohiiHold keeps the first ask until __releaseKoohii, koohiiFailOnce drops the first ask].
      signedUrls: async (paths) => {
        listed();
        if (paths.includes("koohii.json") && cfg.koohiiHang) return new Promise(() => {});
        if (paths.includes("koohii.json") && cfg.koohiiHold && !window.__koohiiHeld) { window.__koohiiHeld = 1; await new Promise((r) => (window.__releaseKoohii = r)); }
        if (paths.includes("koohii.json") && cfg.koohiiFailOnce && !window.__koohiiFailed) { window.__koohiiFailed = 1; throw new TypeError("Failed to fetch"); }
        return new Map(paths.filter((p) => p !== "koohii.json" || cfg.koohii)
          .map((p) => [p, p === "koohii.json" ? `data:application/json,${encodeURIComponent(JSON.stringify(cfg.koohii))}` : "content/" + p])); },
      loadProgress: async () => { down(); return JSON.parse(localStorage.getItem("__remote")) ?? cfg.remote ?? null; },
      saveProgress: async (id, data) => { down(); log.push({ save: structuredClone(data) }); localStorage.setItem("__remote", JSON.stringify(data)); },
      loadStudy: async () => { down(); if (cfg.studyDown) throw new TypeError("Failed to fetch"); return JSON.parse(localStorage.getItem("__remoteStudy")) ?? cfg.remoteStudy ?? null; },
      saveStudy: async (id, study) => { down(); log.push({ study: structuredClone(study) }); localStorage.setItem("__remoteStudy", JSON.stringify(study)); },
    };
  }, cfg);
  // A fixed start time that then runs on [cfg.clock = 03:58 today, for the 4 am day; true starts it now, for `next` to skip pauses].
  if (cfg.clock) { await page.clock.install(cfg.clock === true ? {} : { time: cfg.clock }); await page.clock.resume(); clocked.add(page); }
  await page.goto(hash || "/");
  await page.waitForLoadState("networkidle");
  return page;
}
const clocked = new WeakSet();
// The next question or kana, skipping the pause after a right answer when the page runs a fake clock [grammar's 800 ms, 20 times a run].
async function next(page, prog) {
  if (clocked.has(page)) await page.clock.fastForward(1200);
  await page.waitForFunction((p) => document.querySelector("h1")?.textContent === "Done!" || document.querySelector("#prog")?.textContent !== p, prog);
}
const me = { id: "u1", email: "me@example.com" };
const saves = (page) => page.evaluate(() => window.__log.filter((l) => l.save).map((l) => l.save));
const listed = { user: me, allowed: true };
// A listed account on a fake clock, so `next` skips each right answer's pause [a 20-card grammar run waits 16 s].
const drill = { ...listed, clock: true };
const romajiOf = (page, kana) => page.evaluate((k) => HIRAGANA.KANA.find((x) => x.kana === k).romaji, kana);
const answerOne = async (page) => page.type("#in", await romajiOf(page, await page.textContent("#kana")));
// The study deck as the Japanese-section files seed and read it [reviewed() is a card due tomorrow at a 1-day interval].
const { dayOf } = require("../srs.js");
const day = dayOf(Date.now());
const deckOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("hira.study") || "null"));
const studySaves = (page) => page.evaluate(() => window.__log.filter((l) => l.study).map((l) => l.study));
const reviewed = (over) => ({ st: "review", ivl: 1, ease: 2.5, due: day + 1, n: 1, lapses: 0, first: day, last: day, ...over });
const deckWith = (cards) => ({ cards, settings: { newPerDay: 20, at: 0 }, savedAt: 1 });
// Every kanji started, so new words come in list order [秋 first] rather than only the kana words a fresh account gets.
// Two days back, as a page clock at 3:58 am is still yesterday, and a kanji answered that day holds its word back.
const KANJI = Object.keys(require("../data/kanji.json"));
const HISTORY = require("../data/history.json");
// A fresh deck in list order, as the cases read it [Math.random 0: 秋 the first new word].
const started = (cfg = {}) => ({ ...listed, rand0: true, ...cfg, local: { "study.user": "u1", study: { ...deckWith({}),
  kanji: { cards: Object.fromEntries(KANJI.map((c) => [c, reviewed({ first: day - 2, last: day - 2, due: day + 30 })])), settings: { newPerDay: 10, at: 0 } } } } });
// New words open as an introduction with a single Got it, and are asked a few cards later [a fresh deck: 4 introductions, then 秋 asked].
const pastIntros = async (page) => { while (await page.locator("#got").count()) await page.click("#got"); };
const answer = async (page, g) => { await pastIntros(page); await page.click("#card"); await page.click(`[data-g='${g}']`); };

module.exports = { open, next, net, me, saves, listed, drill, romajiOf, answerOne, dayOf, day, deckOf, studySaves, reviewed, deckWith, KANJI, HISTORY, started, pastIntros, answer };
