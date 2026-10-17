// The site is meant to be useless without a listed Google account, yet still work on a train once you've signed in.
// Each case drives the real page in Chrome against a fake Supabase, because the ways this breaks are all in app.js:
// a signed-out visitor reaching the worksheets, a refused account seeing the nav, a phone's progress replaced by the PC's,
// or an offline boot locking you out. The real row-level security is checked separately against the live project.
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, me, saves, listed, answerOne } = require("./browser.js");

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
  await page.goto("#learn/1");
  await page.locator(".speak.clip").first().click();
  assert.match((await page.evaluate(() => window.__played))[0], /content\/audio\/3042\.mp3$/);
  await page.close();
});

// The credits filled half a phone screen under every page once the Japanese sources joined them.
test("the credits sit folded under one line, the EDRDG named on it in the Japanese section", async () => {
  const page = await open(listed, "#learn");
  await page.locator(".lesson-card").first().waitFor();
  assert.equal(await page.locator("footer .credits a[href*='kanjivg']").isVisible(), false);
  assert.equal(await page.locator("footer summary .credits-ja").isVisible(), false);
  await page.click("footer summary");
  assert.equal(await page.locator("footer .credits a[href*='kanjivg']").isVisible(), true);
  await page.goto("#words");
  assert.match(await page.textContent("footer summary"), /JMdict and KANJIDIC2 by the EDRDG/);
  assert.equal(await page.locator("footer summary .credits-ja").isVisible(), true);
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

  await page.goto("#quiz/a/1");
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
  await page.goto("#sheets");
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

// Progress belongs to one account and survives a bad connection; each case is a way answers were lost or misfiled.

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

// After a sync with a fast-clock device, an answer was stamped before the last push, so sign-out wiped it without asking.
test("an answer after syncing with a fast-clock device still counts as unsent at sign-out", async () => {
  const later = Date.now() + 1e9;
  const page = await open({ ...listed, remote: { progress: {}, "quiz.best": {}, "sheets.done": {}, "reading.done": [], savedAt: later, resetAt: 0 } }, "#quiz/k/1");
  await page.waitForFunction((t) => +localStorage.getItem("hira.sync.pushedAt") >= t, later);
  await page.evaluate(() => localStorage.setItem("__offline", "1"));
  await answerOne(page);
  const asked = [];
  page.once("dialog", (d) => { asked.push(d.message()); d.dismiss(); });
  await page.click("#signout");
  await page.waitForTimeout(300);
  assert.match(asked[0] || "", /haven't reached the server/);
  await page.close();
});

// Boot stopped at "Can't reach the server" with the new account set, and the next online event pushed the last account's answers into its row.
test("coming online on the blocked screen pushes nothing of the last account's", async () => {
  const page = await open(listed, "#learn");
  await page.evaluate(() => {
    localStorage.setItem("hira.progress", JSON.stringify({ か: { box: 5, right: 20, wrong: 0 } }));
    localStorage.setItem("hira.sync.savedAt", String(Date.now() + 1e6));
    localStorage.setItem("hira.sync.user", JSON.stringify("someone-else"));
    localStorage.removeItem("hira.sync.allowed");
    localStorage.setItem("__offline", "1");
  });
  await page.reload();
  await page.waitForSelector("text=Can't reach the server");
  await page.evaluate(() => { localStorage.removeItem("__offline"); dispatchEvent(new Event("online")); });
  await page.waitForTimeout(500);
  const remote = await page.evaluate(() => JSON.parse(localStorage.getItem("__remote")));
  assert.equal(remote?.progress?.か, undefined);
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
