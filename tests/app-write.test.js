// Writing: the mouse traces KanjiVG's own strokes over the pad [あ's 3 paths, box units turned into screen pixels].
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, next, drill } = require("./browser.js");

// The automatic check these cases drive [a page with nothing stored opens in Self].
const perStroke = { ...drill, local: { "write.check": "stroke" } };
const padKana = (page) => page.getAttribute("#say [data-say]", "data-say");
// A kana's strokes as points, `steps` to a curve [2 draws the 23 extended sounds with a quarter of the 5,240 mouse moves].
const strokesOf = (page, kana, steps = 8) => page.evaluate(async ({ kana, steps }) => {
  const all = await HiraStrokes.load();
  return [...kana].flatMap((c, j) => all[c].d.map((d) => HiraWrite.pathPoints(d, steps).map(([x, y]) => [x + 109 * j, y])));
}, { kana, steps });
const padBox = async (page) => ({ r: await page.locator("#pad").boundingBox(), w: await page.evaluate(() => document.querySelector("#pad").viewBox.baseVal.width) });
async function drawStroke(page, pts, dx = 0, dy = 0, box) {
  const { r, w } = box || await padBox(page);
  const at = ([x, y]) => [r.x + ((x + dx) / w) * r.width, r.y + ((y + dy) / 109) * r.height];
  await page.mouse.move(...at(pts[0]));
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...at(p));
  await page.mouse.up();
}
const writeKana = async (page) => { for (const s of await strokesOf(page, await padKana(page))) await drawStroke(page, s); };
const deckWrite = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("hira.study") || "{}").write);

// Enter after a miss on the last kana opens Done, and later Enters must leave it be [it redrew with a later time and flushed again].
test("Enter on the writing quiz's Done page after a last-kana miss doesn't draw it again", async () => {
  const page = await open(perStroke, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  while ((await page.textContent("#prog")) !== "5 / 5") {
    const prog = await page.textContent("#prog");
    await writeKana(page);
    await next(page, prog);
  }
  const [first, ...rest] = await strokesOf(page, await padKana(page));
  for (let i = 0; i < 3; i++) await drawStroke(page, first, 0, 40);
  for (const st of [first, ...rest]) await drawStroke(page, st);
  await page.locator("#next").waitFor();
  await page.keyboard.press("Enter");
  const done = await page.waitForSelector("h1:has-text('Done!')");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  assert.equal(await done.evaluate((h) => h.isConnected), true);
  await page.close();
});

test("the Write switch on the quiz page starts a writing run of the picked kana", async () => {
  const page = await open(drill, "#quiz");
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
  const page = await open(perStroke, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const done = [];
  while (await page.locator("#pad").count()) {
    const prog = await page.textContent("#prog");
    done.push(await padKana(page));
    await writeKana(page);
    await next(page, prog);
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

// The shared drill store only; no test finishes a whole-category writing run [write.best["a,k,s,t,n,h,m,y,r,w/1"]].
test("the deck's drill store keeps writing bests apart from the verb drills' bests", async () => {
  const page = await open(drill, "#quiz");
  await page.locator("#go").waitFor();
  const got = await page.evaluate(() => {
    HiraStudy.write.setBest("a/1", { ms: 9000, acc: 100 });
    return [HiraStudy.write.best("a/1"), HiraStudy.verbs.best("a/1"), JSON.parse(localStorage.getItem("hira.study")).write.best["a/1"]];
  });
  assert.deepEqual(got, [{ ms: 9000, acc: 100 }, undefined, { ms: 9000, acc: 100 }]);
  await page.close();
});

test("a stroke missed three times shows faintly to trace, and the kana counts as a miss", async () => {
  const page = await open(perStroke, "#write/a/1");
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
  const page = await open({ ...drill, local: { "write.check": "whole" } }, "#write/a/1");
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
  await next(page, prog);
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 2, right: 1, wrong: 0 });
  await page.close();
});

test("a combination is written in two cells, the small kana in the second", async () => {
  const page = await open(perStroke, "#write/y-ky/1");
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.locator("#pad .guide rect").count(), 2);
  const kana = await padKana(page);
  const prog = await page.textContent("#prog");
  await writeKana(page);
  await next(page, prog);
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 2, right: 1, wrong: 0 });
  await page.close();
});

// Self is graded like a flashcard [a drawn え is shown under the answer, and 2 says you had it].
test("a page with no mode stored opens in Self, and nothing is judged until the answer is shown", async () => {
  const page = await open(drill, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.getAttribute("#checkmode .on", "data-check"), "self");
  const kana = await padKana(page);
  const strokes = await strokesOf(page, kana);
  for (const s of [...strokes].reverse()) await drawStroke(page, s, 0, 30);
  assert.equal(await page.locator("#pad .ink polyline").count(), strokes.length);
  assert.equal(await page.locator("#pad .ink .bad, #pad .hint path").count(), 0, "no marks and no answer yet");
  assert.equal((await deckWrite(page))?.kana?.[kana], undefined);
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#pad .hint path").count(), strokes.length, "the answer drawn over the drawing");
  assert.equal(await page.locator("#pad .hint text").count(), strokes.length, "numbered in its order");
  assert.equal(await page.locator("#pad .ink text").count(), strokes.length, "and the drawing numbered in its own");
  await page.keyboard.press("2");
  await page.waitForFunction(() => document.querySelector("#prog").textContent === "2 / 5");
  assert.deepEqual((await deckWrite(page))?.kana?.[kana], { box: 2, right: 1, wrong: 0 });
  assert.equal(await page.locator("#pad .hint path, #pad .ink *").count(), 0, "the next kana starts on a clean pad");
  await page.close();
});

test("a stored mode the page doesn't know opens in Self", async () => {
  const page = await open({ ...drill, local: { "write.check": "zz" } }, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.getAttribute("#checkmode .on", "data-check"), "self");
  assert.equal(await page.locator("#acts #show").count(), 1);
  await page.close();
});

// The speaker above the pad kept the focus, so Space played the sound again instead of showing the answer.
test("Space after clicking the speaker in Self shows the answer", async () => {
  const page = await open(drill, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const strokes = await strokesOf(page, await padKana(page));
  await page.click("#say [data-say]");
  await drawStroke(page, strokes[0]);
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#pad .hint path").count(), strokes.length);
  assert.equal((await page.evaluate(() => window.__played)).length, 1, "the sound played once, for the click");
  await page.close();
});

test("Again in Self counts a miss and the kana comes back later in the round", async () => {
  const page = await open(drill, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const kana = await padKana(page);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#pad .hint path").count(), (await strokesOf(page, kana)).length, "an empty pad can still be shown");
  await page.keyboard.press("1");
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 1, right: 0, wrong: 1 });
  assert.equal(await page.textContent("#bad"), "1");
  assert.match(await page.textContent("#prog"), /^2 \/ [67]$/);
  await page.close();
});

// A clicked button kept the focus, so the next Space pressed Undo again instead of showing the answer.
test("Space after clicking Undo in Self shows the answer", async () => {
  const page = await open(drill, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const strokes = await strokesOf(page, await padKana(page));
  await drawStroke(page, strokes[0]);
  await drawStroke(page, strokes[1]);
  await page.click("#undo");
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#pad .ink polyline").count(), 1);
  assert.equal(await page.locator("#pad .hint path").count(), strokes.length);
  await page.close();
});

// Learn shows each stroke as a trail to trace, then asks the kana on an empty pad [あ: 3 traced strokes, then 3 from memory].
const demoD = (page) => page.locator("#pad .hint .demo").evaluateAll((ps) => ps.map((p) => p.getAttribute("d")));
const kvg = (page, c) => page.evaluate(async (c) => (await HiraStrokes.load())[c].d, c);

test("Learn demonstrates each stroke to trace, then asks the kana from memory, and records nothing", async () => {
  const page = await open(drill, "#write/a/1/learn");
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.getAttribute("#checkmode .on", "data-check"), "learn");
  assert.equal(await padKana(page), "あ", "chart order");
  const d = await kvg(page, "あ");
  const strokes = await strokesOf(page, "あ");
  assert.deepEqual(await demoD(page), [d[0]]);
  await page.evaluate(() => { document.querySelector("#pad .demo").__old = true; });
  await drawStroke(page, strokes[0], 0, 40);
  assert.deepEqual(await demoD(page), [d[0]], "a miss shows the same stroke again");
  assert.equal(await page.evaluate(() => document.querySelector("#pad .demo").__old), undefined, "drawn in afresh");
  await drawStroke(page, strokes[0]);
  assert.deepEqual(await demoD(page), [d[1]]);
  await page.click("#hint");
  assert.deepEqual(await demoD(page), [d[1]], "Show again while tracing");
  for (const s of strokes.slice(1)) await drawStroke(page, s);
  await page.waitForFunction(() => !document.querySelector("#pad .ink *"));
  assert.deepEqual(await demoD(page), [], "from memory: an empty pad and no demo");
  assert.equal(await padKana(page), "あ");
  const prog = await page.textContent("#prog");
  for (const s of strokes) await drawStroke(page, s);
  await next(page, prog);
  assert.equal(await padKana(page), "い");
  assert.equal(await page.textContent("#ok"), "1");
  assert.equal((await deckWrite(page))?.kana?.["あ"], undefined);
  await page.close();
});

test("a stroke missed from memory in Learn replays its demo, and the kana is listed as missed", async () => {
  const page = await open(drill, "#write/a/1/learn");
  await page.locator("#pad rect").first().waitFor();
  const strokes = await strokesOf(page, "あ");
  for (const s of strokes) await drawStroke(page, s);
  // Straight on into memory: the trace goes, the quick first stroke stays [the 400 ms wipe once took it with the trace].
  await drawStroke(page, strokes[0]);
  await page.waitForTimeout(450);
  assert.equal(await page.locator("#pad .ink *").count(), 1);
  await drawStroke(page, strokes[1], 0, 40);
  assert.deepEqual(await demoD(page), [(await kvg(page, "あ"))[1]]);
  for (const s of strokes.slice(1)) await drawStroke(page, s);
  while (await page.locator("#pad").count()) {
    const prog = await page.textContent("#prog");
    const rest = await strokesOf(page, await padKana(page));
    for (const s of [...rest, ...rest]) await drawStroke(page, s);
    await next(page, prog);
  }
  assert.equal(await page.textContent("h1"), "Done!");
  assert.deepEqual(await page.locator(".miss-list .miss").evaluateAll((m) => m.map((e) => e.firstChild.textContent)), ["あ"]);
  assert.equal(await deckWrite(page), undefined, "nothing recorded");
  await page.close();
});

test("a Learn step opens its kana in Learn, and the switch on the run moves between modes", async () => {
  const page = await open(drill, "#learn/1");
  await page.click("a.btn:has-text('Practice writing')");
  await page.locator("#pad rect").first().waitFor();
  assert.match(decodeURIComponent(page.url()), /#write\/a\/1\/learn$/);
  assert.equal(await page.getAttribute("#checkmode .on", "data-check"), "learn");
  assert.equal(await page.evaluate(() => localStorage.getItem("hira.write.check")), null, "the link doesn't change the remembered mode");
  await page.click("[data-check='self']");
  assert.match(decodeURIComponent(page.url()), /#write\/a\/1$/);
  assert.equal(await page.evaluate(() => localStorage.getItem("hira.write.check")), '"self"');
  await page.click("[data-check='learn']");
  assert.equal(await padKana(page), "あ");
  assert.equal(await page.textContent("#prog"), "1 / 5");
  assert.deepEqual(await demoD(page), [(await kvg(page, "あ"))[0]]);
  await page.close();
});

// The best belongs to runs that test you, so a Learn run of a whole category keeps none [the 23 extended sounds, written twice each].
test("a Learn run of a whole category keeps no best", async () => {
  const page = await open(drill, "#write/k-x-v,k-x-w,k-x-f,k-x-ts,k-x-e,k-x-t,k-x-dh/1/learn");
  await page.locator("#pad rect").first().waitFor();
  while (await page.locator("#pad").count()) {
    const prog = await page.textContent("#prog");
    const st = await strokesOf(page, await padKana(page), 2);
    for (let n = 0; n < 2; n++) { const box = await padBox(page); for (const s of st) await drawStroke(page, s, 0, 0, box); }
    await next(page, prog);
  }
  assert.match(await page.textContent(".stats"), /100%/);
  assert.doesNotMatch(await page.textContent(".panel"), /best|First run/i);
  assert.deepEqual((await deckWrite(page))?.best ?? {}, {});
  await page.close();
});

// A right kana settles for 400 ms, and input then belongs to no kana [a double-clicked Check graded あ twice and skipped い].
test("a second Check while a right kana settles grades it once", async () => {
  const page = await open({ ...drill, local: { "write.check": "whole" } }, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const kana = await padKana(page);
  await writeKana(page);
  await page.dblclick("#done");
  await next(page, "1 / 5");
  await page.waitForTimeout(500);
  assert.equal(await page.textContent("#prog"), "2 / 5");
  assert.deepEqual((await deckWrite(page)).kana[kana], { box: 2, right: 1, wrong: 0 });
  await page.close();
});

test("a mode switch while a right kana settles leaves it on the pad", async () => {
  const page = await open(perStroke, "#write/a/1");
  await page.locator("#pad rect").first().waitFor();
  const n = (await strokesOf(page, await padKana(page))).length;
  await writeKana(page);
  await page.click("[data-check='self']");
  assert.equal(await page.locator("#pad.right .ink path").count(), n);
  await next(page, "1 / 5");
  assert.equal(await page.textContent("#prog"), "2 / 5");
  await page.close();
});

// Keys reached a pad with no kana yet [Space then 2 before strokes.json threw twice and skipped い].
test("keys pressed before the stroke data arrives do nothing", async () => {
  const page = await open(drill, "#quiz");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let release;
  const held = new Promise((r) => { release = r; });
  await page.route("**/data/strokes.json", async (r) => { await held; r.continue(); });
  await page.evaluate(() => { location.hash = "#write/a/1"; });
  await page.locator("#checkmode").waitFor();
  await page.keyboard.press("Space");
  await page.keyboard.press("2");
  await page.keyboard.press("Backspace");
  release();
  await page.locator("#pad rect").first().waitFor();
  assert.equal(await page.textContent("#prog"), "1 / 5");
  assert.equal(await page.textContent("#ok"), "0");
  assert.deepEqual(errors, []);
  await page.close();
});

test("the chart shows reading or writing, and a reset forgets the writing too", async () => {
  const page = await open({ ...drill, remoteStudy: { cards: {}, savedAt: 5, write: { kana: { か: { box: 4, right: 5, wrong: 0 } }, best: {}, resetAt: 0 } } }, "#chart");
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

// Two answers typed in one burst left the second one carried into the box but never checked ["ai": い sat with "i" until Enter].
test("a whole answer typed while the last one settles counts at once", async () => {
  const page = await open({ ...drill, rand0: true }, "#quiz/a,k/1");
  const [first, second] = await page.evaluate(() => HiraOrder.spaced(HIRAGANA.KANA.filter((k) => ["a", "k"].includes(k.group)), 1).slice(0, 2).map((k) => k.romaji));
  await page.keyboard.type(first + second);
  await page.waitForFunction(() => document.querySelector("#prog").textContent.startsWith("3 /"), null, { timeout: 2000 });
  await page.close();
});
