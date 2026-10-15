// The vocabulary deck lives in its own `study` column because the deployed sync rewrites `data` with the kana keys only;
// these drive the section against the fake backend: its tabs, the first day, the schedule an answer writes, practice
// that must not write, and the deck following the account like the kana do.
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, next, saves, listed, romajiOf, dayOf, day, deckOf, studySaves, reviewed, deckWith, started, pastIntros, answer } = require("./browser.js");

test("the Japanese section has its own tabs, and the kana tabs stay as they were", async () => {
  const page = await open(listed, "#words");
  const tabs = () => page.locator("nav a:visible").evaluateAll((as) => as.map((a) => a.dataset.tab));
  assert.deepEqual(await tabs(), ["words", "kanji", "verbs", "particles", "grammar"]);
  await page.click(".sections a[data-section-link='kana']");
  assert.deepEqual(await tabs(), ["learn", "cards", "quiz", "sheets", "reading", "chart"]);
  await page.close();
});

// Words follow the kanji: a word with kanji opens once each of its kanji has a card, so a fresh account starts on kana words.
test("a fresh account is offered 20 new kana words, and a word with kanji once its kanji have cards", async () => {
  const page = await open(listed, "#words");
  await page.locator("#new").waitFor();
  assert.deepEqual([await page.textContent("#new"), await page.textContent("#due")], ["20", "0"]);
  await page.click("#go");
  assert.equal(await page.textContent("#left"), "20 left");
  assert.doesNotMatch(await page.textContent(".face.front .word"), /[一-鿿]/);
  await page.close();
  const ready = await open({ ...listed, local: { "study.user": "u1", study: { ...deckWith({}), kanji: { cards: { 秋: reviewed() }, settings: { newPerDay: 10, at: 0 } } } } }, "#words/review");
  await ready.locator(".face.front").waitFor();
  assert.equal(await ready.locator(".face.front ruby rt").first().textContent(), "あき");
  await ready.close();
});

// A new word was asked cold, before the learner had ever seen it; KanjiMemorize shows it first, and so does this now.
test("a new word opens with its answer and Got it and is asked for real a few cards on; its English side never opens that way", async () => {
  const page = await open(started(), "#words/review");
  await page.locator("#got").waitFor();
  assert.match(await page.textContent(".face.front"), /秋/);
  assert.equal(await page.locator(".face.back").isVisible(), true);
  assert.equal(await page.locator("[data-g]").count(), 0);
  await page.keyboard.press(" ");
  assert.doesNotMatch(await page.textContent(".face.front"), /秋/);
  await pastIntros(page);
  assert.match(await page.textContent(".face.front"), /秋/);
  assert.equal(await page.locator(".face.back").isVisible(), false);
  assert.equal(await page.locator("[data-g]").count(), 4);
  assert.equal((await deckOf(page))?.cards?.["秋|あき#r"], undefined);
  await page.close();
  const met = await open({ ...listed, local: { "study.user": "u1", study: deckWith({ "秋|あき#r": reviewed({ first: day - 1, last: day - 1, due: day + 5 }) }) } }, "#words/review");
  await met.locator(".face.front").waitFor();
  assert.match(await met.textContent(".face.front"), /fall \(season\)/);
  assert.equal(await met.locator("#got").count(), 0);
  await met.close();
});

test("Good on a new word brings it back tomorrow and syncs the deck apart from the kana", async () => {
  const page = await open(started(), "#words/review");
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
  await pastIntros(page);
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

// Furigana on the Japanese side gave the reading away before the learner had to recall it [学生 with がくせい over it],
// yet hiding every one asked for readings of kanji years above the word [写真 at N5, both kanji N4].
test("a reading at the word's level stays hidden until the card turns, one above it shows from the start", async () => {
  const due = (d) => reviewed({ first: day - 3, last: day - 3, due: d });
  const study = deckWith({ "学生|がくせい#r": due(day - 2), "写真|しゃしん#r": due(day - 1), "沢山|たくさん#r": due(day) });
  const page = await open({ ...listed, local: { "study.user": "u1", study } }, "#words/review");
  const rt = page.locator(".face.front ruby rt").first();
  const shown = () => rt.evaluate((r) => getComputedStyle(r).visibility);
  await rt.waitFor({ state: "attached" });
  assert.match(await page.textContent(".face.front"), /学生/);
  assert.equal(await shown(), "hidden");
  await page.click("#card");
  assert.equal(await shown(), "visible");
  assert.doesNotMatch(await page.textContent(".face.back"), /Usually written in kana/);
  await page.click("[data-g='3']");
  assert.match(await page.textContent(".face.front"), /写真/);
  assert.equal(await shown(), "visible");
  await answer(page, 3);
  assert.match(await page.textContent(".face.front"), /沢山/);
  assert.equal(await shown(), "visible");
  await page.click("#card");
  assert.match(await page.textContent(".face.back"), /Usually written in kana: たくさん/);
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
  // Offline until Try again, so the fresh ask and its kept-copy fallback both fail.
  let calls = 0, offline = true;
  await p.route("**/data/vocab.json", (r) => (++calls, offline ? r.abort() : r.continue()));
  await p.goto("#words");
  await p.locator("#retry").waitFor();
  const failed = calls;
  offline = false;
  await p.click("#retry");
  await p.locator("#new").waitFor();
  assert.equal(calls, failed + 1);
  await p.close();
});

test("keys other than 1 to 4 on a shown answer do nothing and break nothing", async () => {
  const page = await open(listed, "#words/review");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".face.front").waitFor();
  await pastIntros(page);
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
  await page.goto("#words");
  await page.goto("#chart");
  release();
  await page.waitForResponse("**/data/vocab.json");
  await page.waitForTimeout(300);
  assert.equal(await page.textContent("main h1"), "Kana chart");
  assert.equal(await page.locator("#new").count(), 0);
  await page.close();
});

// Another device's clock ahead left later answers here looking already sent [its push stamped 13:00, this answer 12:10].
test("an answer made after syncing with a fast-clock device still asks before Sign out drops it", async () => {
  const page = await open(started({ remoteStudy: { ...deckWith({}), savedAt: Date.now() + 3600e3 } }), "#words/review");
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
  const page = await open(started({ clock: start.getTime() }), "#words/review");
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
  const page = await open(started(), "#words/review");
  await page.locator(".face.front").waitFor();
  await pastIntros(page);
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
  const page = await open(listed, "#quiz/y,y-ky,y-sh/2");
  const seen = [];
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const prog = await page.textContent("#prog");
    const k = await page.textContent("#kana");
    seen.push(k);
    await page.type("#in", await romajiOf(page, k));
    await next(page, prog);
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
    await page.goto(hash);
    for (let n = 0; await page.locator("#kana").count(); n++) {
      const prog = await page.textContent("#prog");
      if (waits[n]) await page.waitForTimeout(waits[n]);
      await page.type("#in", await romajiOf(page, await page.textContent("#kana")));
      await next(page, prog);
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
  assert.equal(await page.$eval("#typed", (b) => getComputedStyle(b).opacity), "0");
  await page.fill("#typed", "watashinokodomowa");
  const typedOver = () => page.$$eval(".tt", (ts) => ts.slice(0, 9).map((t) => t.textContent));
  assert.deepEqual(await typedOver(), ["wa", "ta", "shi", "no", "ko", "do", "mo", "wa", ""]);
  assert.equal(await page.$eval(".caret", (c) => c.closest(".tok").dataset.k), "は");
  // A tap on a typed kana moves the caret behind its letters, and Backspace eats from there [し: watash|inoko…].
  await page.click(".tok >> nth=2");
  assert.equal(await page.$eval("#typed", (b) => b.selectionStart), 7);
  assert.equal(await page.$eval(".caret", (c) => c.closest(".tok").dataset.k), "し");
  await page.keyboard.press("Backspace");
  assert.equal(await page.inputValue("#typed"), "watashnokodomowa");
  await page.keyboard.type("i");
  await page.click(".tok >> nth=9");
  assert.match(await page.getAttribute(".tok >> nth=9", "class"), /\bpeek\b/);
  await page.press("#typed", "Enter");
  assert.equal(await page.getAttribute(".tok.off", "data-k"), "は");
  assert.equal(await page.locator(".dot.done").count(), 0);
  await page.fill("#typed", answer.toUpperCase());
  await page.press("#typed", "Enter");
  assert.match(await page.getAttribute("#typing", "class"), /\bright\b/);
  assert.equal(await page.locator(".tok.off").count(), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("hira.reading.done"))), ["0-0"]);
  await page.press("#typed", "Enter");
  assert.match(page.url(), /#reading\/0\/1$/);
  assert.equal(await page.inputValue("#typed"), "");
  await page.close();
});
