// The kanji in the browser: a word card's note and recording, the popup over a review, and the Kanji tab, each case a way they broke [a popup's 1–4 graded the card underneath].
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, next, net, listed: shuffled, day, deckOf, studySaves, reviewed, deckWith, KANJI, HISTORY, started, pastIntros, answer } = require("./browser.js");
// Reviews in the order the deck lists them, as these cases read it [Math.random 0: the one due review before the new words].
const listed = { ...shuffled, rand0: true };

// ---------- Kanji ----------
// A word card's 🔊 spoke the kana through the browser's voice, which most phones lack; the word's WaniKani recording plays instead.
test("a word with a recording plays it, and its button shows without a Japanese voice", async () => {
  const page = await open(started(), "#words/review");
  await page.locator("#got").waitFor();
  assert.equal(await page.locator(".face.back > .speak.rec").count(), 1);
  await page.click(".face.back > .speak");
  assert.match((await page.evaluate(() => window.__played)).at(-1), /\/data\/words\/79cb-7c-3042-304d\.mp3$/);
  await page.close();
});

test("a word without a recording keeps the browser's speech and plays no clip [後 read あと has none]", async () => {
  const page = await open(started(), "#words/review");
  await page.locator("#got").waitFor();
  while (!/後/.test(await page.textContent(".face.front"))) await page.click("#got");
  assert.equal(await page.locator(".face.back > .speak").count(), 1);
  assert.equal(await page.locator(".face.back > .speak.rec").count(), 0);
  await page.$eval(".face.back > .speak", (b) => b.click());
  assert.deepEqual(await page.evaluate(() => window.__played), []);
  await page.close();
});

// The readings under the kanji, then each reading's words, a muted reading or word marked ~ [学: [["ガク", "まな.ぶ~"], [["ガク", "大学 · 学校 · 学生"]]]].
const readings = (page, scope) => page.evaluate((s) => {
  const t = (el) => el.textContent + (el.closest(".unmet") ? "~" : "");
  return [[...document.querySelectorAll(`${s} .kanji-reading .kr`)].map(t),
    [...document.querySelectorAll(`${s} .ku-row`)].map((r) => [t(r.querySelector(".ku")), [...r.querySelectorAll(".kr-words > span")].map(t).join(" · ")])];
}, scope);

// The note under a word's answer, a line per kanji with the met words sharing it, and its parts and radicals last, on the back only [学生: Parts 子, Radicals ⺍ 冖].
const kanjiDeck = () => deckWith({
  "学校|がっこう#r": reviewed({ first: day - 2, last: day - 2, due: day + 9 }), "大学|だいがく#r": reviewed({ first: day - 1, last: day - 1, due: day + 9 }),
  // 学生's Japanese side the only review due, so it comes first; its English side waits for tomorrow, as the two never come back to back.
  "学生|がくせい#r": reviewed({ first: day - 3, last: day - 3, due: day - 1 }), "学生|がくせい#p": reviewed({ first: day - 2, last: day - 2, due: day + 1 }),
});
// 学生's English side due instead [its Japanese side tomorrow].
const englishDeck = () => {
  const d = kanjiDeck();
  d.cards["学生|がくせい#r"].due = day + 1;
  d.cards["学生|がくせい#p"].due = day;
  return d;
};
test("a word's kanji note shows on the back of both sides and never on the front", async () => {
  for (const [study, front] of [[kanjiDeck(), /学生/], [englishDeck(), /student/]]) {
    const page = await open({ ...listed, local: { "study.user": "u1", study } }, "#words/review");
    await page.locator(".face.front").waitFor();
    assert.match(await page.textContent(".face.front"), front);
    assert.equal(await page.locator(".face.front .kanji-note").count(), 0);
    assert.equal(await page.locator(".kanji-note").isVisible(), false);
    await page.click("#card");
    assert.deepEqual(await page.locator(".kanji-note .kn").allTextContents(), ["学 study, learning · also in 大学, 学校", "生 life, genuine"]);
    assert.deepEqual(await page.locator(".pieces .pc").allTextContents(), ["Parts 子 child, sign of the rat", "Radicals ⺍ three strokes · 冖 crown, cover"]);
    await page.close();
  }
});

// A tap on a note's kanji must not leave the review, since a route change ends the session.
test("a note's kanji opens a popup over the card, keys don't grade under it, and closing it keeps the session", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  const left = await page.textContent("#left");
  // Until the next frame focus would stay on the button that opened it, and a quick space would open a second 学 popup.
  assert.equal(await page.evaluate(() => { const b = document.querySelector(".kn-k[data-kanji='学']"); b.focus(); b.click(); return document.activeElement === b; }), false);
  await page.keyboard.press("3");
  await page.keyboard.press(" ");
  assert.equal(await page.locator(".modal").count(), 1);
  assert.match(await page.textContent(".modal"), /学[\s\S]*study, learning/);
  await page.click(".modal .stroke-toggle");
  await page.locator(".modal .strokes path").nth(7).waitFor();
  assert.equal(await page.locator(".modal .strokes path").count(), 8);
  // Tab stays out of the page behind the popup [two Tabs reached Again, and Space graded it].
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => !document.activeElement.closest("#app")), true);
  await page.keyboard.press(" ");
  assert.equal(await page.textContent("#left"), left);
  assert.equal((await deckOf(page)).cards["学生|がくせい#r"].n, 1);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".modal").count(), 0);
  assert.match(page.url(), /#words\/review$/);
  await page.click("[data-g='3']");
  assert.equal((await deckOf(page)).cards["学生|がくせい#r"].n, 2);
  await page.close();
});

// The only Close sat under the popup, so a phone scrolled past a whole kanji to shut it.
test("a popup's × stays in its corner while a long popup scrolls, and closes it", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.setViewportSize({ width: 360, height: 640 });
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  assert.equal(await page.$eval(".modal", (m) => { m.scrollTop = m.scrollHeight; return m.scrollTop > 0; }), true);
  const [x, box] = await Promise.all([page.locator(".modal-x").boundingBox(), page.locator(".modal").boundingBox()]);
  assert.ok(x.y >= box.y && x.y + x.height <= box.y + box.height, `× at ${x.y} outside the popup at ${box.y}–${box.y + box.height}`);
  await page.click(".modal-x");
  assert.equal(await page.locator(".modal").count(), 0);
  assert.match(page.url(), /#words\/review$/);
  await page.close();
});

// Words, Verbs and the rest share the words load, so the kanji meanings it fetches alongside must not be able to sink it.
test("without data/kanji.json the cards still run, their note lines just lack the meaning", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } });
  await page.route("**/data/kanji.json", (r) => r.fulfill({ status: 404 }));
  await page.goto("#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  assert.deepEqual(await page.locator(".kanji-note .kn").allTextContents(), ["学 · also in 大学, 学校", "生"]);
  await page.goto("#verbs");
  await page.locator("#go").waitFor();
  await page.close();
});

test("a recording that won't load falls back to the browser's speech [offline, never played before]", async (t) => {
  const page = await open(started(), "#words/review");
  await page.locator("#got").waitFor();
  if (!(await page.evaluate(() => document.body.classList.contains("has-voice")))) { await page.close(); return t.skip("no Japanese voice on this machine"); }
  await page.route("**/data/words/**", (r) => r.abort());
  await page.evaluate(() => { window.__spoke = []; speechSynthesis.speak = (u) => window.__spoke.push(u.text); });
  await page.click(".face.back > .speak");
  await page.waitForFunction(() => window.__spoke.length, null, { timeout: 3000 });
  assert.deepEqual(await page.evaluate(() => window.__spoke), ["あき"]);
  await page.close();
});

test("leaving the page with a popup open leaves the next page usable", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.evaluate(() => { location.hash = "#words"; });
  await page.locator("#go").waitFor();
  assert.equal(await page.locator(".modal").count(), 0);
  await page.click("#go", { timeout: 3000 });
  await page.locator(".face.front").waitFor();
  await page.close();
});

// A second tap aborts the first play, which isn't a failed load [two quick taps on 秋 played the clip and spoke あき over it].
test("a second tap before the recording starts plays it once and speaks nothing", async (t) => {
  const page = await open(started(), "#words/review");
  await page.locator("#got").waitFor();
  if (!(await page.evaluate(() => document.body.classList.contains("has-voice")))) { await page.close(); return t.skip("no Japanese voice on this machine"); }
  const held = [];
  await page.route("**/data/words/**", (r) => held.push(r));
  await page.evaluate(() => {
    window.__spoke = []; speechSynthesis.speak = (u) => window.__spoke.push(u.text);
    window.__ends = []; const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { const p = play.call(this); p.then(() => window.__ends.push("ok"), (e) => window.__ends.push(e.name)); return p; };
  });
  await page.click(".face.back > .speak");
  await page.click(".face.back > .speak");
  await page.waitForFunction(() => window.__played.length === 2);
  await new Promise((r) => setTimeout(r, 300));
  held.forEach((r) => r.continue().catch(() => {}));
  await new Promise((r) => setTimeout(r, 1000));
  assert.deepEqual(await page.evaluate(() => window.__spoke), []);
  assert.deepEqual(await page.evaluate(() => window.__ends), ["AbortError", "ok"]);
  await page.close();
});

// Koohii's keywords and stories come from the private bucket through one signed link; other members wrote the stories.
const koohii = { 学: { kw: "study", frame: 346, mine: "My <em>roof</em> &amp; <strong>study</strong>.", stories: [
  { by: "first", text: "Under a <em>crown</em> of <em>sparks</em>, a <em>child</em> sits down to <strong>study</strong>.", stars: 300 },
  { by: "second", text: "Bad <img src=x onerror=window.__x=1> and &lt;script&gt; text", stars: 120 },
  { by: "third", text: "Ends in a broken <img src=x onerror=window.__x=1", stars: 40 }] } };
test("with Koohii loaded a note line shows Heisig's keyword, and the popup its frame, the account's story, then the top stories by author", async () => {
  // A card is drawn with the keyword known when it's drawn, so the review starts once Koohii's file is in.
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: kanjiDeck() } }, "#words");
  await page.waitForFunction(() => HiraStudy.keyword("学") === "study");
  await page.click("#go");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  assert.deepEqual(await page.locator(".kanji-note .kn").allTextContents(), ["学 study · also in 大学, 学校", "生 life, genuine"]);
  await page.click(".kn-k[data-kanji='学']");
  assert.match(await page.textContent(".modal .kanji-meta"), /RTK 346/);
  assert.deepEqual(await page.locator(".modal .story-by").allTextContents(), ["From the site's Koohii account", "first", "second", "third"]);
  assert.equal(await page.locator(".modal .story em").count(), 4);
  assert.match(await page.textContent(".modal"), /Remembering the Kanji © James W\. Heisig/);
  await page.close();
});

test("a story's markup keeps em and strong only, a broken tag included", async () => {
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.locator(".modal .story").nth(3).waitFor();
  assert.equal(await page.locator(".modal img, .modal script").count(), 0);
  assert.equal(await page.evaluate(() => window.__x), undefined);
  assert.match(await page.locator(".modal .story").nth(2).textContent(), /and <script> text/);
  await page.close();
});

// Koohii's file loads beside the words, never in front of them [a sign request that hung kept Words on "Loading words…"].
test("a Koohii link that never answers doesn't hold up the words", async () => {
  const page = await open({ ...listed, koohii, koohiiHang: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor({ timeout: 5000 });
  await page.click("#card");
  assert.equal(await page.locator(".kanji-note .kn").first().textContent(), "学 study, learning · also in 大学, 学校");
  await page.close();
});

test("a Koohii load that failed is tried again on the next visit to the words", async () => {
  const page = await open({ ...listed, koohii, koohiiFailOnce: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  assert.match(await page.locator(".kanji-note .kn").first().textContent(), /^学 study, learning/);
  await page.click("a[href='#words']");
  await page.locator("#go").waitFor();
  await page.waitForFunction(() => HiraStudy.keyword("学") === "study", null, { timeout: 5000 });
  await page.click("#go");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  assert.match(await page.locator(".kanji-note .kn").first().textContent(), /^学 study ·/);
  await page.close();
});

// A popup drawn before Koohii's file landed kept KANJIDIC's meaning and no stories until it was closed and opened again.
test("a popup opened while Koohii loads fills in when it lands", async () => {
  const page = await open({ ...listed, koohii, koohiiHold: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  assert.equal(await page.textContent(".modal .kanji-kw"), "study, learning");
  assert.deepEqual(await readings(page, ".modal"), [["ガク", "まな.ぶ~"], [["ガク", "大学 · 学校 · 学生"]]]);
  // A stroke order opened meanwhile stays open [the first redraw rebuilt the whole popup and wiped it].
  await page.click(".modal .stroke-toggle");
  await page.locator(".modal .strokes").waitFor();
  await page.evaluate(() => window.__releaseKoohii());
  await page.locator(".modal .story").first().waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-kw"), "study");
  assert.match(await page.textContent(".modal .kanji-meta"), /RTK 346/);
  assert.equal(await page.locator(".modal .strokes").count(), 1);
  assert.equal(await page.textContent(".modal .stroke-toggle"), "Hide stroke order");
  await page.close();
});

// Koohii's late redraw rebuilds the head, so a story kept in the head, or a redraw of every slot, would lose it.
test("a history story shown before Koohii's file lands stays when it does", async () => {
  const page = await open({ ...listed, koohii, koohiiHold: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.locator(".modal .kanji-story").waitFor({ timeout: 3000 });
  await page.evaluate(() => window.__releaseKoohii());
  await page.locator(".modal .story").first().waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-kw"), "study");
  assert.equal(await page.textContent(".modal .kanji-story"), HISTORY["学"].history);
  await page.close();
});

test("a popup asks for Koohii again after a failed load", async () => {
  const page = await open({ ...listed, koohii, koohiiFailOnce: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.locator(".modal .story").first().waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-kw"), "study");
  await page.close();
});

test("a popup waiting on a Koohii load that fails asks once more", async () => {
  const page = await open({ ...listed, koohii, koohiiHold: true, koohiiFailOnce: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.evaluate(() => window.__releaseKoohii());
  await page.locator(".modal .story").first().waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-kw"), "study");
  await page.close();
});

test("a kanji Koohii's file lacks keeps KANJIDIC's meaning, with no Heisig line and no stories", async () => {
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: kanjiDeck() } }, "#words");
  await page.waitForFunction(() => HiraStudy.keyword("学") === "study");
  await page.click("#go");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='生']");
  assert.equal(await page.textContent(".modal .kanji-kw"), "life, genuine");
  assert.doesNotMatch(await page.textContent(".modal"), /Heisig/);
  assert.equal(await page.locator(".modal .stories").isVisible(), false);
  await page.close();
});

// ---------- Kanji tab ----------
// A new kanji opens with its answer, and a grade lands in study.kanji, which
// mergeStudy merges card by card: taken whole from the newer side, one device's kanji reviews would wipe the other's.
const VOCAB = require("../data/vocab.json");
const withKanji = (cards, settings = { newPerDay: 10, at: 0 }) => ({ ...kanjiDeck(), kanji: { cards, settings } });
// A drag across the drawing pad, in its own 109-unit box [10,10 to 90,90 is a stroke corner to corner].
async function drag(page, sel, pts) {
  const r = await page.locator(sel).boundingBox();
  const at = ([x, y]) => [r.x + (x / 109) * r.width, r.y + (y / 109) * r.height];
  await page.mouse.move(...at(pts[0]));
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...at(p), { steps: 4 });
  await page.mouse.up();
}

// Heisig's frames for the first kanji, which only break ties now the word list leads [火 173, 秋 966, 口 11, 足 1372, 後 1479].
const frames = Object.fromEntries([["火", "fire", 173], ["秋", "autumn", 966], ["口", "mouth", 11], ["足", "leg", 1372], ["後", "behind", 1479]]
  .map(([c, kw, frame]) => [c, { kw, frame, mine: null, stories: [] }]));
// Heisig's order alone kept 今日 and 来年 waiting 74 and 85 days; the kanji now come as the word list needs them, parts first.
test("the Kanji hub offers the next kanji as the word list needs them, and a review introduces, grades and syncs them", async () => {
  const page = await open({ ...listed, koohii: { ...koohii, ...frames }, local: { "study.user": "u1", study: withKanji({}, { newPerDay: 5, at: 0 }) } }, "#kanji");
  await page.locator("#k-new").waitFor();
  assert.deepEqual([await page.textContent("#k-new"), await page.textContent("#k-due")], ["5", "0"]);
  assert.match(await page.textContent("#k-sum"), /0 of 902 started · 0 learned/);
  assert.equal(await page.locator(".kgrid a").count(), 902);
  assert.deepEqual((await page.locator(".kgrid a.next").allTextContents()).sort(), [..."火秋口足後"].sort());
  await page.click("#go");
  await page.locator("#got").waitFor();
  assert.equal(await page.textContent(".face.front .kanji-prompt"), "fire");
  assert.equal(await page.textContent(".face.back .kanji-big"), "火");
  assert.match(await page.textContent(".hint"), /New kanji/);
  await pastIntros(page);
  assert.equal((await deckOf(page)).kanji.cards["火"], undefined, "an introduction stores nothing");
  await page.click("#card");
  await page.click("[data-g='3']");
  assert.deepEqual((await deckOf(page)).kanji.cards["火"], { st: "review", ivl: 1, ease: 2.5, due: day + 1, n: 1, lapses: 0, first: day, last: day });
  for (let i = 0; i < 4; i++) await answer(page, 3);
  await page.locator("h1", { hasText: "Done" }).waitFor();
  assert.deepEqual(Object.keys((await studySaves(page)).at(-1).kanji.cards).sort(), [..."火秋口足後"].sort());
  await page.close();
});

// 秋 the word answered this morning, then 秋 the kanji asked tonight with the answer still fresh: the second came out Good unearned.
test("a kanji whose word of it alone was answered today waits for tomorrow, in the hub's count and the review", async () => {
  const before = reviewed({ first: day - 5, last: day - 3, due: day });
  const study = { ...deckWith({ "秋|あき#r": reviewed({ first: day - 5 }), "足|あし#r": reviewed({ first: day - 5, last: day - 3, due: day + 5 }) }),
    kanji: { cards: { 秋: before, 足: before }, settings: { newPerDay: 5, at: 0 } } };
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study } }, "#kanji");
  await page.locator("#k-due").waitFor();
  assert.equal(await page.textContent("#k-due"), "1");
  const offered = (await page.textContent("#go")).match(/\d+/)[0];
  await page.click("#go");
  await page.locator(".face.front .kanji-prompt").waitFor();
  assert.match(await page.textContent(".face.front .kanji-prompt"), /foot/);
  assert.equal(await page.textContent("#left"), `${offered} left`, "the review asks what the hub offered");
  await page.close();
});

// 学 due as a review, so its back is the one asked for whatever the order of new kanji.
test("a kanji card's back opens with the kanji alone and its readings under it, the words under the history note, then the stroke order and the stories", async () => {
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: withKanji({ 学: reviewed({ first: day - 5, last: day - 1, due: day }) }, { newPerDay: 5, at: 0 }) } }, "#kanji");
  await page.locator("#k-due").waitFor();
  await page.click("#go");
  await page.locator(".face.front .kanji-prompt", { hasText: "study" }).waitFor();
  await page.click("#card");
  assert.deepEqual(await readings(page, ".face.back"), [["ガク", "まな.ぶ~"], [["ガク", "大学 · 学校 · 学生"]]]);
  // Nothing over the kanji, the words wait under the history note [ガク stood large over 学 and read as the thing to grade].
  const order = await page.$$eval(".face.back .kanji-top, .face.back .kanji-big, .face.back .kanji-reading, .face.back .kanji-why, .face.back .kr-used", (els) => els.map((e) => ["kanji-top", "kanji-big", "kanji-reading", "kanji-why", "kr-used"].find((c) => e.classList.contains(c))));
  assert.deepEqual(order, ["kanji-big", "kanji-reading", "kanji-why", "kr-used"]);
  assert.equal(await page.locator(".face.back .kanji-reading .kr-words").count(), 0);
  assert.match(await page.textContent(".face.back .kanji-comps"), /子 child/);
  assert.equal(await page.locator(".face.back .stroke-toggle").count(), 1, "Paper mode keeps the Stroke order button");
  assert.equal(await page.locator(".face.back .story").count(), 4);
  await page.close();
});

// 学 due with only 大学 met: 学校 and 学生 read ガク too, so they show muted, and まな.ぶ with no met word is muted as well.
const metOnly = (words, cards) => ({ ...deckWith(Object.fromEntries(words.map((k) => [`${k}#r`, reviewed({ first: day - 1, last: day - 1, due: day + 9 })]))),
  kanji: { cards, settings: { newPerDay: 5, at: 0 } } });
test("a kanji card's back mutes an unmet word and reading and leaves the word out of its word list", async () => {
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: metOnly(["大学|だいがく"], { 学: reviewed({ first: day - 5, last: day - 1, due: day }) }) } }, "#kanji/review");
  await page.locator(".face.front .kanji-prompt", { hasText: "study" }).waitFor();
  await page.click("#card");
  assert.deepEqual(await readings(page, ".face.back"), [["ガク", "まな.ぶ~"], [["ガク", "大学 · 学生~ · 学校~"]]]);
  assert.deepEqual(await page.locator(".face.back .kanji-words .kw-row .jp").allTextContents(), ["大学だいがく"]);
  await page.close();
});

test("a kanji card's back with no met word shows every reading muted", async () => {
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: metOnly([], { 学: reviewed({ first: day - 5, last: day - 1, due: day }) }) } }, "#kanji/review");
  await page.locator(".face.front .kanji-prompt", { hasText: "study" }).waitFor();
  await page.click("#card");
  assert.deepEqual(await readings(page, ".face.back"), [["ガク~", "まな.ぶ~"], [["ガク~", "学生~ · 学校~ · 大学~"]]]);
  assert.equal(await page.locator(".face.back .kanji-words .kw-row").count(), 0);
  await page.close();
});

// 封's story writes <em>measure</em>ments and 重's links primidi.com, so a match on the raw HTML missed one and found ri in the other.
test("a story's keyword counts through its tags and only at the start of a word", async () => {
  const his = { 封: { kw: "seal", frame: 168, mine: null, stories: [{ by: "first", text: "Take <em>measure</em>ments to <strong>seal</strong> it.", stars: 9 }] },
    寸: { kw: "measurement", frame: 45, mine: null, stories: [] },
    重: { kw: "heavy", frame: 1805, mine: null, stories: [{ by: "first", text: "A <strong>heavy</strong> computer, see http://www.primidi.com/ for more.", stars: 9 }] },
    里: { kw: "ri", frame: 185, mine: null, stories: [] } };
  const page = await open({ ...listed, koohii: { ...koohii, ...his }, local: { "study.user": "u1", study: deckWith({}) } }, "#kanji/封");
  await page.locator(".kanji-page .story").waitFor({ timeout: 3000 });
  assert.match(await page.textContent(".kanji-page .stories"), /in these stories: 寸 measurement ·/);
  await page.evaluate(() => { location.hash = "#kanji/重"; });
  await page.locator(".kanji-page[data-c='重'] .story").waitFor();
  assert.doesNotMatch(await page.textContent(".kanji-page .stories"), /in these stories/);
  await page.close();
});

// 村's parts line said 寸 inch while every story built it from glue, so the card and its stories named the part two ways.
test("a part's Heisig name shows beside its label when this kanji's stories use it", async () => {
  const his = { 村: { kw: "village", frame: 207, mine: null, stories: [{ by: "first", text: "A <em>tree</em> with <em>glue</em> on it.", stars: 9 }] },
    寸: { kw: "measurement", frame: 45, mine: null, stories: [] },
    封: { kw: "seal", frame: 168, mine: null, stories: [{ by: "first", text: "Take <em>measure</em>ments to <strong>seal</strong> it.", stars: 9 }] } };
  const page = await open({ ...listed, koohii: { ...koohii, ...his }, local: { "study.user": "u1", study: deckWith({}) } }, "#kanji/村");
  await page.locator(".kanji-page .story").waitFor({ timeout: 3000 });
  assert.match(await page.textContent(".kanji-page .kanji-comps"), /寸 inch \(glue in the stories\)/);
  await page.evaluate(() => { location.hash = "#kanji/封"; });
  await page.locator(".kanji-page[data-c='封'] .kanji-comps").waitFor();
  assert.doesNotMatch(await page.textContent(".kanji-page .kanji-comps"), /in the stories/, "封's stories never say glue");
  await page.close();
});

// 旦's Heisig keyword is "nightbreak" while its stories say the sun rises, so it shows a plain one and names his beside the stories.
test("a kanji with a plain keyword shows it, with Heisig's over the stories and no keyword credit in its head", async () => {
  const stories = { 旦: { kw: "nightbreak", frame: 30, mine: null, stories: [{ by: "first", text: "A <strong>nightbreak</strong> story.", stars: 9 }] } };
  const page = await open({ ...listed, koohii: { ...koohii, ...stories }, local: { "study.user": "u1", study: deckWith({}) } }, "#kanji/旦");
  await page.locator(".kanji-page .story").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".kanji-page .kanji-kw"), "dawn");
  assert.doesNotMatch(await page.textContent(".kanji-page .kanji-head"), /Heisig/);
  assert.match(await page.textContent(".kanji-page .stories"), /^\s*Heisig's keyword in these stories: 旦 nightbreak · Remembering the Kanji © James W\. Heisig/);
  // 学 keeps Heisig's keyword and its credit where it was.
  await page.evaluate(() => { location.hash = "#kanji/学"; });
  await page.locator(".kanji-page[data-c='学'] .story").first().waitFor();
  assert.match(await page.textContent(".kanji-page .kanji-head"), /Keyword from Remembering the Kanji/);
  assert.doesNotMatch(await page.textContent(".kanji-page .stories"), /in these stories/);
  await page.close();
});

// 昼's top story plays the shakuhachi at nightbreak, while its parts line now says Japanese foot and dawn.
test("a kanji built from parts with plain keywords names Heisig's for them over its stories", async () => {
  const his = { 昼: { kw: "daytime", frame: 1156, mine: null, stories: [{ by: "first", text: "A <em>shaku</em> at <em>nightbreak</em>.", stars: 9 }] },
    尺: { kw: "shaku", frame: 1151, mine: null, stories: [] }, 旦: { kw: "nightbreak", frame: 30, mine: null, stories: [] } };
  const page = await open({ ...listed, koohii: { ...koohii, ...his }, local: { "study.user": "u1", study: deckWith({}) } }, "#kanji/昼");
  await page.locator(".kanji-page .story").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".kanji-page .kanji-kw"), "daytime");
  assert.match(await page.textContent(".kanji-page .kanji-head"), /Keyword from Remembering the Kanji/);
  assert.match(await page.textContent(".kanji-page .stories"), /^\s*Heisig's keywords in these stories: 尺 shaku, 旦 nightbreak · Remembering the Kanji/);
  await page.close();
});

// 村's stories call 寸 "glue", its primitive, so naming Heisig's "measurement" over them was a new contradiction.
test("a part's Heisig keyword is named over the stories only when they use it", async () => {
  const his = { 村: { kw: "village", frame: 221, mine: null, stories: [{ by: "first", text: "Trees <em>glued</em> into a <strong>village</strong>.", stars: 9 }] },
    寸: { kw: "measurement", frame: 45, mine: null, stories: [] } };
  const page = await open({ ...listed, koohii: { ...koohii, ...his }, local: { "study.user": "u1", study: deckWith({}) } }, "#kanji/村");
  await page.locator(".kanji-page .story").waitFor({ timeout: 3000 });
  assert.doesNotMatch(await page.textContent(".kanji-page .stories"), /in these stories/);
  await page.close();
});

test("the new-a-day choice caps the day's new kanji and is kept in the deck", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator("#k-new").waitFor();
  assert.equal(await page.textContent("#k-new"), "10");
  await page.selectOption("#kper", "5");
  await page.waitForFunction(() => document.querySelector("#k-new")?.textContent === "5");
  assert.deepEqual((await deckOf(page)).kanji.settings.newPerDay, 5);
  await page.close();
});

test("Draw mode puts a pad under the keyword that draws without turning the card, and the answer draws the strokes", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: withKanji({ 学: reviewed({ first: day - 5, last: day - 1, due: day }) }) } }, "#kanji");
  await page.locator("#k-due").waitFor();
  await page.click("[data-mode='draw']");
  assert.equal(await page.evaluate(() => localStorage.getItem("hira.kanji.mode")), JSON.stringify("draw"));
  await page.click("#go");
  await page.locator(".face.front .kpad").waitFor();
  assert.equal(await page.textContent(".face.front .kanji-prompt"), "study, learning");
  await drag(page, ".kpad svg", [[20, 20], [60, 40], [90, 90]]);
  assert.equal(await page.locator(".kpad svg path").count(), 1);
  assert.equal(await page.locator(".face.back").isVisible(), false);
  await page.click(".kpad [data-clear]");
  assert.equal(await page.locator(".kpad svg path").count(), 0);
  assert.equal(await page.locator(".face.back").isVisible(), false);
  await page.keyboard.press(" ");
  await page.locator(".face.back .strokes path").nth(7).waitFor();
  assert.equal(await page.locator(".face.back .strokes path").count(), 8);
  assert.equal(await page.locator(".face.back .stroke-toggle").count(), 0);
  await page.close();
});

test("a kanji's page has its components, stories and words, and the popup shows the same without leaving the review", async () => {
  const page = await open({ ...listed, koohii, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji/学");
  await page.locator(".kanji-comps").waitFor();
  await page.waitForFunction(() => document.querySelectorAll(".story").length === 4);
  assert.match(await page.textContent(".kanji-comps"), /⺍[\s\S]*冖[\s\S]*子 child, sign of the rat/);
  assert.equal(await page.getAttribute(".kanji-comps a", "href"), "#kanji/子");
  assert.equal(await page.locator(".kanji-words .kw-row").count(), 13);
  assert.equal(await page.locator("#app a[href='#kanji']").count(), 1);
  await page.goto("#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  assert.match(await page.textContent(".modal .kanji-comps"), /子 child/);
  assert.equal(await page.locator(".modal .kanji-comps a").count(), 0, "a link would leave the review");
  await page.close();
});

// 海's parts read "氵" and nothing else, so nothing said the left side meant water, and 水's page never said it turns into 氵.
test("a radical form names its full kanji, the full kanji names its forms, and a shape gets a name", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji/海");
  await page.locator(".kanji-comps").waitFor({ timeout: 3000 });
  assert.match(await page.textContent(".kanji-comps"), /氵 the 水 radical, water/);
  assert.equal(await page.locator(".kanji-comps a[href='#kanji/水']").count(), 1);
  await page.goto("#kanji/水");
  // 水 is 氵 on the left and 氺 at the bottom [海; 様].
  await page.locator(".kanji-page[data-c='水'] .kanji-forms").first().waitFor({ timeout: 3000 });
  const forms = await page.locator(".kanji-forms").allTextContents();
  // The first 8 of 37 in study order, as the word list reaches them [海 in 海, 池 in 池], not kanji.json's 泳 汚 温 海.
  assert.equal(forms[0], "As a radical it's written 氵: 海 池 漢 浴 洗 濯 洋 渡 …");
  assert.deepEqual(forms.slice(1), ["As a radical it's written 氺: 様"]);
  await page.goto("#kanji/近");
  await page.locator(".kanji-page[data-c='近'] .kanji-comps").waitFor({ timeout: 3000 });
  assert.match(await page.textContent(".kanji-comps"), /⻌ \w/);
  // 漢 has its 氵 from the Han river, which nothing in "China" suggests.
  await page.goto("#kanji/漢");
  await page.locator(".kanji-page[data-c='漢'] .kanji-why").waitFor({ timeout: 3000 });
  assert.match(await page.textContent(".kanji-why"), /Han/);
  await page.close();
});

// The story waited behind a History fold, and the user found a fold one tap too many [漢: the Han river, then the bronze vessel].
test("a kanji's page and popup show its history note and the whole story, no fold", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji/漢");
  await page.setViewportSize({ width: 360, height: 740 });
  await page.locator(".kanji-page[data-c='漢'] .kanji-story").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".kanji-why"), HISTORY["漢"].note);
  assert.equal(await page.locator(".kanji-page details").count(), 0);
  assert.equal(await page.locator(".kanji-story").isVisible(), true);
  assert.equal(await page.textContent(".kanji-story"), HISTORY["漢"].history);
  await page.goto("#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.locator(".modal .kanji-story").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-why"), HISTORY["学"].note);
  assert.equal(await page.locator(".modal details").count(), 0);
  assert.equal(await page.locator(".modal .kanji-story").isVisible(), true);
  await page.close();
});

// A review card's back has room for the note, and the story stays on the page and the popup.
test("a kanji review's answer shows the history note and not the story", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: withKanji({ 漢: reviewed({ first: day - 5, last: day - 1, due: day }) }) } }, "#kanji/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  assert.equal(await page.textContent(".face.back .kanji-why"), HISTORY["漢"].note);
  assert.equal(await page.locator(".face.back .kanji-story").count(), 0);
  await page.close();
});

// history.json loads apart from the words, so a failed load must leave the page whole and be asked for again on the next view.
test("a kanji page opens without its history when history.json fails, and the next view asks again", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let calls = 0;
  await page.route("**/data/history.json", (r) => (++calls === 1 ? r.fulfill({ status: 404 }) : r.continue()));
  await page.goto("#kanji/漢");
  await page.locator(".kanji-page[data-c='漢'] .kanji-comps").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".kanji-why, .kanji-story").count(), 0);
  await page.goto("#kanji/学");
  await page.locator(".kanji-page[data-c='学'] .kanji-story").waitFor({ timeout: 3000 });
  assert.equal(calls, 2);
  assert.deepEqual(errors, []);
  await page.close();
});

// A popup that waited for history.json opened late, so a quick 3 graded the card under it; it opens at once and fills in instead.
test("a popup opened before history.json lands gets its note and story when the file arrives", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  let release;
  const held = new Promise((r) => (release = r));
  await page.route("**/data/history.json", async (r) => { await held; r.continue(); });
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='学']");
  await page.locator(".modal .kanji-comps").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".modal .kanji-why, .modal .kanji-story").count(), 0);
  release();
  await page.locator(".modal .kanji-story").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-why"), HISTORY["学"].note);
  await page.close();
});

// The parts no word uses are deck kanji too, so their grid links and pages must open [未, only in 味 and 妹].
test("a kanji that is only a part has a page, and the hub lists it under its own heading", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator(".kgrid").first().waitFor();
  assert.ok((await page.locator("h2").allTextContents()).includes("Only as parts"));
  await page.click(".kgrid a:text('未')");
  await page.locator(".kanji-page[data-c='未']").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".kanji-page .kanji-words .kw-row").count(), 0);
  await page.close();
});

// Koohii's smart dictionary: a word whose kanji are all learned is marked, so it reads as known.
test("a word whose kanji all have mature cards is marked on its back", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: withKanji({ 学: reviewed({ ivl: 21 }), 生: reviewed({ ivl: 25 }) }) } }, "#words/review");
  await page.locator(".face.front").waitFor();
  assert.equal(await page.locator(".smart").isVisible(), false);
  await page.click("#card");
  assert.equal(await page.locator(".face.back .smart").isVisible(), true);
  await page.close();
});

// #kanji/<x> looked x up in kanjiInfo, which has Object's keys and is empty when kanji.json fails [#kanji/constructor threw; every grid link led back to the hub].
test("a kanji's page opens for any kanji in the word list, with or without kanji.json, and for nothing else", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/data/kanji.json", (r) => r.fulfill({ status: 404 }));
  await page.goto("#kanji/constructor");
  await page.locator("#k-new").waitFor();
  await page.click(".kgrid a:text('学')");
  await page.locator(".kanji-page").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".kanji-page .kanji-words .kw-row").count(), 13);
  assert.deepEqual(errors, []);
  await page.close();
});

// 四's page listed シ, よっ.つ, よ and よん in one line over the kanji, with nothing to say which one to learn first; then シ stood
// large over it, and a reading that big was graded as if it were asked. Order says which is main now, size doesn't.
test("a kanji's readings sit under it as one list, the main one first and no larger, before the stroke order", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: deckWith({}) } }, "#kanji/四");
  await page.locator(".kanji-page .kanji-reading").waitFor({ timeout: 3000 });
  assert.deepEqual(await readings(page, ".kanji-page"), [["シ~", "よっ.つ~", "よん~", "よ~"], [["シ~", "四~"], ["よっ.つ~", "四つ~"], ["よん~", "四~"]]]);
  const order = await page.$$eval(".kanji-page .kanji-top, .kanji-page .kanji-big, .kanji-page .kanji-reading, .kanji-page .stroke-toggle", (els) => els.map((e) => ["kanji-top", "kanji-big", "kanji-reading", "stroke-toggle"].find((c) => e.classList.contains(c))));
  assert.deepEqual(order, ["kanji-big", "kanji-reading", "stroke-toggle"]);
  const sizes = await page.$$eval(".kanji-page .kanji-reading .kr", (els) => els.map((e) => getComputedStyle(e).fontSize));
  assert.deepEqual(new Set(sizes).size, 1, `reading sizes ${sizes}`);
  await page.close();
});

// KanjiVG's sound parts were never shown, so 晴's page didn't say that 青 and 静 read セイ like it.
test("a kanji's page lists the list's kanji sharing its sound and reading as links, and its popup lists them plain", async () => {
  const deck = deckWith({ "晴れる|はれる#r": reviewed({ first: day - 1, last: day - 1, due: day }) });
  const page = await open({ ...listed, local: { "study.user": "u1", study: deck } }, "#kanji/晴");
  await page.locator(".kanji-family").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".kanji-family"), "Same sound セイ: 青 静");
  assert.deepEqual(await page.locator(".kanji-family a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), ["#kanji/青", "#kanji/静"]);
  assert.deepEqual(await readings(page, ".kanji-page"), [["は.れる", "セイ~"], [["は.れる", "晴れる · 晴れ~ · 素晴らしい~"]]]);
  await page.goto("#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kn-k[data-kanji='晴']");
  await page.locator(".modal .kanji-family").waitFor({ timeout: 3000 });
  assert.equal(await page.textContent(".modal .kanji-family"), "Same sound セイ: 青 静");
  assert.equal(await page.locator(".modal .kanji-family a").count(), 0, "a link would leave the review");
  await page.close();
});

// A kanji.json cached from before the readings threw on `on` and left the Kanji page blank [no error on screen, just nothing].
// The parts-first kanji.json added 124 kanji and `v`, so a copy from before has neither [778 entries, 海 without 氵 = 水].
test("a kanji's page, the hub and the review still open on a cached kanji.json without readings, sound parts or parts first", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const words = new Set(VOCAB.flatMap((w) => [...w.w]));
  const old = Object.fromEntries(Object.entries(require("../data/kanji.json")).filter(([c]) => words.has(c)).map(([c, { on, kun, p, v, ...rest }]) => [c, rest]));
  assert.equal(Object.keys(old).length, 778);
  await page.route("**/data/kanji.json", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(old) }));
  await page.goto("#kanji");
  await page.locator("#k-sum").waitFor({ timeout: 5000 });
  assert.match(await page.textContent("#k-sum"), /^0 of 778 started/);
  await page.goto("#kanji/海");
  await page.locator(".kanji-page[data-c='海'] .kanji-comps").waitFor({ timeout: 3000 });
  await page.goto("#kanji/学");
  await page.locator(".kanji-page").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".kanji-page .kanji-reading").count(), 0);
  await page.goto("#kanji/晴");
  await page.locator(".kanji-page[data-c='晴']").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".kanji-page .kanji-family").count(), 0);
  await page.goto("#kanji/review");
  await page.locator(".face.back .kanji-big").waitFor({ state: "attached", timeout: 3000 });
  assert.deepEqual(errors, []);
  await page.close();
});

// The hub waits for Koohii's file, which holds Heisig's tie-breaks; a sign that never answers must not leave it on "Loading kanji…".
test("with Koohii's sign hanging the hub still opens after its wait, in the word list's order", async () => {
  const page = await open({ ...listed, koohii, koohiiHang: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator("#k-new").waitFor({ timeout: 6000 });
  // Stroke count only breaks ties, so the first ten still follow the word list [火 秋 口 足…] and 乙, one stroke, isn't among them.
  const next = await page.locator(".kgrid a.next").allTextContents();
  assert.deepEqual([next.length, next.includes("秋"), next.includes("乙")], [10, true, false]);
  await page.close();
});

// Chrome kept serving the kanji.json from before the readings, so the readings never showed while the server had them.
test("a reload asks the server for the data files again, and uses the kept copy when it can't reach it", async () => {
  const page = await open({ ...listed, cached: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji/学");
  await page.locator(".kanji-page .kanji-reading").waitFor({ timeout: 3000 });
  const before = net.hits["/data/kanji.json"];
  await page.reload();
  await page.locator(".kanji-page .kanji-reading").waitFor({ timeout: 3000 });
  assert.equal(net.hits["/data/kanji.json"], before + 1, "the reload revalidated kanji.json");
  net.dropData = true;
  try {
    await page.reload();
    await page.locator(".kanji-page").waitFor({ timeout: 3000 });
    assert.deepEqual(await readings(page, ".kanji-page"), [["ガク", "まな.ぶ~"], [["ガク", "大学 · 学校 · 学生"]]]);
  } finally {
    net.dropData = false;
  }
  await page.close();
});

// A review with nothing left drew the hub under #kanji/review, so the hub's Study button linked to the page it was on and did nothing.
test("a review with nothing left shows the hub at #kanji, and Words at #words, so their Study buttons work", async () => {
  const later = (n) => reviewed({ first: day - 3, last: day - 1, due: day + n });
  const kanji = await open({ ...listed, local: { "study.user": "u1", study: withKanji(Object.fromEntries(KANJI.map((c) => [c, later(5)]))) } }, "#kanji/review");
  await kanji.locator("#k-new").waitFor();
  assert.match(kanji.url(), /#kanji$/);
  await kanji.close();
  const cards = Object.fromEntries(VOCAB.slice(0, 5).map((w) => [`${w.k}#r`, reviewed()]));
  const words = await open({ ...listed, local: { "study.user": "u1", study: { ...deckWith(cards), settings: { newPerDay: 5, at: 0 } } } }, "#words/review");
  await words.locator("#per").waitFor();
  assert.match(words.url(), /#words$/);
  await words.selectOption("#per", "10");
  await words.click("#go");
  await words.locator(".face.front").waitFor({ timeout: 3000 });
  await words.close();
});

test("leaving a kanji review part-way uploads what was answered at once", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: withKanji({ 学: reviewed({ first: day - 5, last: day - 1, due: day }) }) } }, "#kanji/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click("[data-g='3']");
  const before = (await studySaves(page)).length;
  await page.click("#app a[href='#kanji']");
  await page.waitForFunction((n) => window.__log.filter((l) => l.study).length > n, before, { timeout: 3000 });
  assert.equal((await studySaves(page)).at(-1).kanji.cards["学"].n, 2);
  await page.close();
});

test("Draw mode's answer offers the Stroke order button when the strokes fail to load", async () => {
  const page = await open({ ...listed, local: { "kanji.mode": "draw", "study.user": "u1", study: withKanji({ 学: reviewed({ first: day - 5, last: day - 1, due: day }) }) } });
  await page.route("**/data/kanji-strokes.json", (r) => r.abort());
  await page.goto("#kanji/review");
  await page.locator(".face.front .kpad").waitFor();
  await page.keyboard.press(" ");
  await page.locator(".face.back .stroke-toggle").waitFor({ timeout: 3000 });
  assert.equal(await page.locator(".face.back .strokes").count(), 0);
  await page.close();
});

// A link with a broken escape threw URIError in route(), so the old page stayed up and the new one never drew [#kanji/%E5 left the chart on screen].
test("a link with a broken escape still routes, to its tab's own page", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#chart");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(() => { location.hash = "#kanji/%E5"; });
  await page.locator("#k-new").waitFor({ timeout: 3000 });
  assert.deepEqual(errors, []);
  await page.close();
});

// A lookup by English on the Kanji hub lights the matches in the grid it already shows, and Back from one keeps the search.
test("the Kanji hub's search lights the matching kanji, dims the rest, names them, and is still there after a kanji page", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator(".kgrid").first().waitFor();
  assert.equal(await page.locator(".kgrid.finding").count(), 0);
  await page.fill("#k-find", "eat");
  const hits = () => page.locator(".kgrid a.hit").allTextContents();
  assert.deepEqual((await hits()).sort(), ["喫", "食"]);
  assert.ok(await page.locator(".kgrid.finding").count() > 0);
  assert.match(await page.textContent("#k-hits"), /^2 kanji match/);
  await page.click("#k-hits a:text('食')");
  await page.locator(".kanji-page[data-c='食']").waitFor({ timeout: 3000 });
  await page.goBack();
  await page.locator(".kgrid").first().waitFor();
  assert.equal(await page.inputValue("#k-find"), "eat");
  assert.deepEqual((await hits()).sort(), ["喫", "食"]);
  await page.fill("#k-find", "");
  assert.equal(await page.locator(".kgrid.finding").count(), 0);
  assert.equal(await page.textContent("#k-hits"), "");
  await page.close();
});

// The stories call 旦 nightbreak while its tile says dawn, so a search by the stories' word still has to find it.
test("the Kanji hub's search finds a kanji by Heisig's keyword where a plain one is shown", async () => {
  const page = await open({ ...listed, koohii: { 旦: { kw: "nightbreak", frame: 30, mine: null, stories: [] } }, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator(".kgrid").first().waitFor();
  await page.fill("#k-find", "nightbreak");
  assert.deepEqual(await page.locator(".kgrid a.hit").allTextContents(), ["旦"]);
  await page.close();
});

// The hub draws after 3 s without Koohii's file; a query typed then has to light up when it lands.
test("a Kanji search typed before Koohii's file lands lights its kanji when it does", async () => {
  const page = await open({ ...listed, koohii: { 旦: { kw: "nightbreak", frame: 30, mine: null, stories: [] } }, koohiiHold: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator("#k-find").waitFor({ timeout: 8000 });
  await page.fill("#k-find", "nightbreak");
  assert.equal(await page.textContent("#k-hits"), "No kanji match");
  await page.evaluate(() => window.__releaseKoohii());
  await page.locator(".kgrid a.hit").waitFor({ timeout: 3000 });
  assert.deepEqual(await page.locator(".kgrid a.hit").allTextContents(), ["旦"]);
  await page.close();
});

// With Koohii's sign hanging, only the hub's own draw can light a kept query; the relight on its landing never comes.
test("a kept Kanji search lights the hub again on its return while Koohii's file never answers", async () => {
  const page = await open({ ...listed, koohiiHang: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  await page.locator("#k-find").waitFor({ timeout: 8000 });
  await page.fill("#k-find", "eat");
  await page.click("#k-hits a:text('食')");
  await page.locator(".kanji-page[data-c='食']").waitFor();
  await page.goBack();
  await page.locator("#k-find").waitFor({ timeout: 8000 });
  assert.deepEqual((await page.locator(".kgrid a.hit").allTextContents()).sort(), ["喫", "食"]);
  await page.close();
});

// The hub's relight waits on Koohii's file; landing after the hub was left, it found no box to light and threw.
test("leaving the Kanji hub before Koohii's file lands throws nothing when it does", async () => {
  const page = await open({ ...listed, koohii: { 旦: { kw: "nightbreak", frame: 30, mine: null, stories: [] } }, koohiiHold: true, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator("#k-find").waitFor({ timeout: 8000 });
  await page.click("nav a[data-tab='words']");
  await page.locator("#w-find").waitFor();
  await page.evaluate(() => window.__releaseKoohii());
  await page.waitForTimeout(300);
  assert.deepEqual(errors, []);
  await page.close();
});

// Esc follows a page's ← link, so a kanji's page or a review is left without reaching for the link.
test("Esc on a kanji's page goes back to the Kanji hub, and in a kanji review back to its hub", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji/食");
  await page.locator(".kanji-page[data-c='食']").waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#k-find").waitFor({ timeout: 8000 });
  assert.equal(new URL(page.url()).hash, "#kanji");
  await page.goto(page.url().replace(/#.*/, "#kanji/review"));
  await page.locator(".face.front").waitFor({ timeout: 8000 });
  await page.keyboard.press("Escape");
  await page.locator("#k-find").waitFor({ timeout: 8000 });
  assert.equal(new URL(page.url()).hash, "#kanji");
  await page.close();
});

test("Esc with a popup open closes only the popup, and the next Esc leaves the review", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#words/review");
  await page.locator(".face.front").waitFor();
  await page.click("#card");
  await page.click(".kanji-note .kn-k >> nth=0");
  await page.locator(".modal-back").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".modal-back").count(), 0);
  assert.equal(new URL(page.url()).hash, "#words/review");
  await page.keyboard.press("Escape");
  await page.locator("#w-find").waitFor();
  assert.equal(new URL(page.url()).hash, "#words");
  await page.close();
});

// Esc while a Japanese keyboard is composing cancels the composition, never the page under it.
test("Esc during an IME composition stays on the page", async () => {
  const page = await open({ ...listed, local: { "study.user": "u1", study: kanjiDeck() } }, "#kanji/食");
  await page.locator(".kanji-page[data-c='食']").waitFor();
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true })));
  await page.waitForTimeout(200);
  assert.equal(decodeURIComponent(new URL(page.url()).hash), "#kanji/食");
  await page.close();
});
