// The kana pages in the browser: lessons, the quiz, worksheets, katakana and stroke order, each case a way they broke [a miss sat at 15 / 15 while the quiz kept asking].
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, next, me, listed, drill, romajiOf, answerOne } = require("./browser.js");

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
  await page.goto("#chart");
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
// Enter after a miss on the last kana opens Done, and later Enters must leave it be [it redrew at 0:01, 0:03, 0:05].
test("Enter on the quiz's Done page after a last-kana miss doesn't draw it again", async () => {
  const page = await open(listed, "#quiz/a/1");
  await page.locator("#kana").waitFor();
  while ((await page.textContent("#prog")) !== "5 / 5") {
    const prog = await page.textContent("#prog");
    await page.type("#in", await romajiOf(page, await page.textContent("#kana")));
    await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, prog);
  }
  await page.fill("#in", "zz");
  await page.press("#in", "Enter");
  await page.press("#in", "Enter");
  const done = await page.waitForSelector("h1:has-text('Done!')");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  assert.equal(await done.evaluate((h) => h.isConnected), true);
  await page.close();
});

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
test("katakana comes after hiragana on the Learn page, the picker and the chart", async () => {
  const page = await open(listed, "#learn");
  const hrefs = await page.$$eval(".lesson-card", (as) => as.map((a) => a.getAttribute("href")));
  assert.equal(hrefs[0], "#learn/1");
  assert.ok(hrefs.indexOf("#learn/k1") > hrefs.indexOf("#reading"), "katakana steps follow the hiragana reading card");
  await page.goto("#quiz");
  assert.deepEqual(await page.$$eval(".picker-script h3", (h) => h.map((x) => x.textContent)), ["Hiragana", "Katakana"]);
  await page.goto("#chart");
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
  await page.goto("#sheets/s");
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
  await page.goto("#sheets/k-ak");
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
    await page.goto(`#reading/2/${j}`);
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

// Typed hashes threw or hung: #__proto__ found Object.prototype, a group named twice left holes in the order, 1e9 rounds never finished.
test("a hand-typed hash with an odd name, a repeated group or a huge round count still opens a page", async () => {
  const page = await open(listed, "#learn");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const hash of ["#__proto__", "#constructor"]) {
    await page.goto(hash);
    await page.locator(".lesson-card").first().waitFor();
  }
  await page.goto("#quiz/a,a/1");
  assert.equal(await page.textContent("#prog"), "1 / 5");
  await page.goto("#quiz/a/1e9");
  assert.equal(await page.textContent("#prog"), "1 / 25");
  assert.deepEqual(errors, []);
  await page.close();
});

// A skipped break kept counting, and at its end took over the next break [4:59 left beside "Start round 3" and "⏰ Break's over"].
test("a skipped worksheet break stops its clock", async () => {
  const page = await open(drill, "#sheets/k");
  await page.click("#check");
  await page.click("#brk");
  await page.click("#go");
  await page.click("#check");
  await page.click("#brk");
  await page.clock.fastForward(6 * 60000);
  assert.match(await page.textContent("#left"), /^4:0\d$/);
  assert.match(await page.textContent("#go"), /^Skip/);
  await page.close();
});

// A double-click on Check put its second click on the Break button drawn in the same spot, so the corrections went by unseen.
test("a double-clicked Check answers shows the corrections", async () => {
  const page = await open(listed, "#sheets/k");
  await page.dblclick("#check");
  assert.equal(await page.locator("#brk").count(), 1);
  assert.ok(await page.locator(".cell.wrong").count() > 0);
  await page.close();
});

test("the last worksheet of each script leads to that script's reading", async () => {
  const page = await open(listed, "#learn");
  for (const [id, reading] of [["youon", "#reading/0/0"], ["k-rwn", "#reading/2/0"]]) {
    await page.goto("#sheets/" + id);
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
  await page.goto("#learn/14");
  assert.equal(await page.textContent("main h1"), "ぱ ぴ ぷ ぺ ぽ");
  assert.equal(await page.locator(".task a", { hasText: "Worksheet" }).getAttribute("href"), "#sheets/dakuten");
  await page.goto("#learn/k6");
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
  await page.goto("#learn/kextended");
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
  await page.goto("#learn/k11");
  assert.equal(await page.locator(".kana-row").count(), 12, "katakana adds ヂャ");
  await page.close();
});

// The extended sounds were one step of 25 cells that each needed a click; each group is its own step of full cards now.
test("each extended-sound group is its own step of full cards", async () => {
  const page = await open(listed, "#learn/k14");
  assert.equal(await page.textContent("main h1"), "ファ フィ フェ フォ");
  assert.equal(await page.locator(".kana-card").count(), 4);
  assert.match(await page.locator(".kana-card").first().textContent(), /フ \(fu\) \+ ァ = ファ \(fa\)/);
  await page.goto("#learn/k12");
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
  await page.goto("#learn/16");
  await page.click("a.btn >> text=Reading practice");
  assert.equal(await page.textContent("#back"), "← Step 16");
  await page.goto("#chart");
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
      await next(page, prog);
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
  // Offline until the second press, so the fresh ask and its kept-copy fallback both fail [the train, then a station].
  let calls = 0, offline = true;
  await page.route("**/data/strokes.json", (r) => (++calls, offline ? r.abort() : r.continue()));
  const toggle = page.locator(".kana-card").first().locator(".stroke-toggle");
  await toggle.click();
  await page.waitForFunction(() => /Can.t load/.test(document.querySelector(".stroke-toggle").textContent));
  const failed = calls;
  offline = false;
  await toggle.click();
  await page.locator(".kana-card").first().locator(".strokes path").first().waitFor();
  assert.equal(calls, failed + 1);
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
