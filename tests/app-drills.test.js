// The drills in the browser, Verbs, Particles and Grammar, each driven end to end [a right answer, a miss asked again, a best kept in the synced deck].
const test = require("node:test");
const assert = require("node:assert/strict");
const { open, next, drill, deckOf, reviewed, deckWith } = require("./browser.js");

// ---------- Verbs ----------
// A conjugation drill grades the learner, so these drive it end to end [met words first, romaji into kana, a best per selection].
// Romaji for a kana answer, the way a learner types it [かいて = kaite, よんで = yonde, いって = itte].
const romajiFor = (page, kana) => page.evaluate((s) => {
  const table = new Map(HIRAGANA.KANA.filter((k) => k.script === "hiragana").map((k) => [k.kana, k.romaji]));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i + 1] && table.has(s.slice(i, i + 2))) { out += table.get(s.slice(i, i + 2)); i++; continue; }
    if (s[i] === "っ") { const next = table.get(s.slice(i + 1, i + 3)) || table.get(s[i + 1]); out += next[0] === "c" ? "t" : next[0]; continue; }
    if (s[i] === "ん") { out += /^[aiueoy]/.test(table.get(s[i + 1]) || "") ? "n'" : "n"; continue; }
    out += table.get(s[i]) ?? s[i];
  }
  return out;
}, kana);
const question = (page) => page.evaluate(() => {
  const q = document.querySelector(".verb-q");
  return { k: q.dataset.k, form: q.dataset.form };
});
const wantOf = (page, q) => page.evaluate(async ({ k, form }) => {
  const words = await (await fetch("data/vocab.json")).json();
  return HiraConj.conjugate(words.find((w) => w.k === k), form);
}, q);
const verbsSel = (sel) => ({ "verbs.sel": { forms: ["masu"], kinds: ["verb"], count: 10, ...sel } });
async function answerRight(page) {
  const prog = await page.textContent("#prog");
  await page.type("#in", await romajiFor(page, (await wantOf(page, await question(page))).r));
  await page.press("#in", "Enter");
  await next(page, prog);
}

// The tab first opened on a drill of four forms nobody had taught [polite, polite negative, polite past, polite past negative].
test("a fresh Verbs tab lists the steps and its review waits for Step 1", async () => {
  const page = await open(drill, "#verbs");
  await page.locator(".verb-step").first().waitFor();
  assert.equal(await page.locator(".verb-step").count(), 15);
  assert.equal(await page.locator(".verb-step.done").count(), 0);
  assert.match(await page.getAttribute("#review", "class"), /\bdisabled\b/);
  assert.match(await page.textContent("#review-note"), /Step 1/);
  await page.close();
});

test("a step's lesson shows the form on real words, and finishing its drill marks it done for the review", async () => {
  const page = await open({ ...drill, local: { "study.user": "u1", study: deckWith({ "飲む|のむ#r": reviewed() }) } }, "#verbs/learn/masu");
  await page.locator(".verb-lesson").waitFor();
  assert.match(await page.textContent(".verb-lesson h1"), /ます/);
  assert.equal(await page.textContent(".verb-ex tbody tr:first-child .jp"), "飲む");
  assert.match(await page.textContent(".verb-ex tbody tr:first-child"), /飲みます/);
  await page.click("#drill");
  await page.locator(".verb-q").waitFor();
  assert.equal(await page.textContent("#prog"), "1 / 10");
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    assert.equal(await page.getAttribute(".verb-q", "data-form"), "masu");
    await answerRight(page);
  }
  assert.doesNotMatch(await page.textContent(".panel"), /best/i);
  assert.deepEqual(Object.keys((await deckOf(page)).verbs.best), ["step:masu"]);
  await page.goto("/#verbs");
  await page.locator(".verb-step.done").waitFor();
  assert.match(await page.textContent("#review-note"), /^1 of 15/);
  assert.doesNotMatch(await page.getAttribute("#review", "class"), /\bdisabled\b/);
  await page.close();
});

const stepsDone = (ids) => ({ kana: {}, resetAt: 0, best: Object.fromEntries(ids.map((id) => [`step:${id}`, { ms: 9000, acc: 100 }])) });
// Each question's form with its word's kind [食べる asked as ない = "nai|verb"].
const askedPair = (page) => page.evaluate(async () => {
  const q = document.querySelector(".verb-q").dataset;
  const w = (await (await fetch("data/vocab.json")).json()).find((x) => x.k === q.k);
  const c = HiraConj.classOf(w);
  return `${q.form}|${c === "adj-na" ? "adj-na" : c.startsWith("adj") ? "adj-i" : "verb"}`;
});

// Steps 1 and 7 done put ない on verbs too, when the picker's chips stood for the finished steps and crossed every form with every kind.
test("the review asks only what the finished steps taught, even when done out of order", async () => {
  const page = await open({ ...drill, local: { "study.user": "u1", study: { ...deckWith({}), verbs: stepsDone(["masu", "adj-i"]) } } }, "#verbs/review");
  await page.locator(".verb-q").waitFor();
  const asked = new Set();
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    asked.add(await askedPair(page));
    await answerRight(page);
  }
  const taught = ["masu|verb", "nai|adj-i", "ta|adj-i", "nakatta|adj-i", "te|adj-i"];
  assert.deepEqual([...asked].filter((p) => !taught.includes(p)), []);
  assert.ok(asked.has("masu|verb") && [...asked].some((p) => p.endsWith("|adj-i")), [...asked].join(" "));
  assert.deepEqual(Object.keys((await deckOf(page)).verbs.best).sort(), ["step:adj-i", "step:masu"]);
  await page.close();
});

// The Particles tab: a sentence's gap answered by a choice, a miss shown and asked again, and the best kept in the synced deck.
const { SENTENCES } = require("../particles.js");
const gapCard = async (page) => SENTENCES[+(await page.getAttribute(".gap-q", "data-id"))];
const choose = async (page, right) => {
  const c = await gapCard(page), prog = await page.textContent("#prog");
  const opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
  const i = opts.findIndex((p) => c.ok.includes(p) === right);
  await page.keyboard.press(String(i + 1));
  return { c, prog, picked: opts[i] };
};
test("a particle gap takes a right choice, shows and requeues a wrong one, and keeps the best in the deck", async () => {
  const page = await open(drill, "#particles/run");
  await page.locator(".gap-q").waitFor();
  assert.equal(await page.textContent("#prog"), "1 / 10");
  const first = await choose(page, true);
  assert.equal(await page.textContent("#ok"), "1");
  assert.equal(await page.textContent(".gap.filled"), first.picked);
  assert.match(await page.getAttribute(`.gap-opt[data-p="${first.picked}"]`, "class"), /\bright\b/);
  await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, first.prog);
  const miss = await choose(page, false);
  assert.equal(await page.textContent("#bad"), "1");
  assert.ok(miss.c.ok.includes(await page.textContent(".feedback .ans")));
  assert.match(await page.getAttribute(`.gap-opt[data-p="${miss.picked}"]`, "class"), /\bwrong\b/);
  assert.match(await page.getAttribute(`.gap-opt[data-p="${await page.textContent(".feedback .ans")}"]`, "class"), /\bright\b/);
  await page.keyboard.press("Enter");
  assert.equal(await page.textContent("#prog"), "3 / 11");
  let seenAgain = false;
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const { c, prog } = await choose(page, true);
    if (c === miss.c) seenAgain = true;
    await next(page, prog);
  }
  assert.ok(seenAgain, "the missed sentence came back");
  const best = (await deckOf(page)).particles.best["10"];
  assert.equal(best.acc, 91);
  await page.close();
});

test("the Verbs tab drills met verbs in the chosen form, romaji turning into kana as it's typed", async () => {
  const page = await open({ ...drill, local: { ...verbsSel({}), "study.user": "u1", study: deckWith({ "食べる|たべる#r": reviewed() }) } }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  assert.deepEqual(await page.locator("nav a:visible").evaluateAll((as) => as.map((a) => a.dataset.tab)), ["words", "kanji", "verbs", "particles", "grammar"]);
  await page.type("#in", "tabe");
  assert.equal(await page.inputValue("#in"), "たべ");
  await page.fill("#in", "");
  await page.type("#in", "annaishimasu");
  assert.equal(await page.inputValue("#in"), "あんないします");
  await page.fill("#in", "");
  const seen = [];
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const q = await question(page);
    seen.push(q.k + " " + q.form);
    assert.equal(q.form, "masu");
    await answerRight(page);
  }
  assert.equal(seen.length, 10);
  assert.ok(seen.includes("食べる|たべる masu"), seen.join(", "));
  assert.match(await page.textContent("main"), /100%/);
  await page.close();
});

test("a wrong form shows the right one in its spelling and comes back later in the drill", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  const first = await question(page);
  const want = await wantOf(page, first);
  await page.type("#in", "zzz");
  await page.press("#in", "Enter");
  assert.match(await page.textContent("#fb"), new RegExp(want.w));
  await page.press("#in", "Enter");
  const later = [];
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    later.push(JSON.stringify(await question(page)));
    await answerRight(page);
  }
  assert.ok(later.includes(JSON.stringify(first)), "the missed form came back");
  await page.close();
});

test("adjectives are drilled when ticked [高い → plain negative = 高くない]", async () => {
  const page = await open({ ...drill, local: verbsSel({ forms: ["nai"], kinds: ["adj-i"] }) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  assert.equal(await page.textContent("#type"), "い-adjective");
  const want = await wantOf(page, await question(page));
  assert.match(want.r, /くない$/);
  await page.close();
});

test("a finished drill keeps its best for that choice of forms, in the synced deck", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) await answerRight(page);
  const best = await page.evaluate(() => JSON.parse(localStorage.getItem("hira.study")).verbs.best["masu|verb|10"]);
  assert.equal(best.acc, 100);
  await page.waitForFunction(() => window.__log.some((l) => l.study?.verbs?.best?.["masu|verb|10"]), null, { timeout: 3000 });
  await page.close();
});

// A short drill's time can't be beaten by a longer one, so each question count keeps its own [10 in 0:04 vs 40 in 0:15].
test("a best is kept per question count", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) await answerRight(page);
  await page.click("text=Choose forms");
  await page.locator("#count").waitFor();
  assert.match(await page.textContent("#best"), /Best/);
  await page.selectOption("#count", "20");
  await page.waitForFunction(() => document.querySelector("#count").value === "20");
  assert.equal(await page.textContent("#best"), "");
  await page.close();
});

// A 20 picked with only 15 questions to ask was filed under 20, so a later full run of 20 could never beat it.
test("a best is filed under the number of questions asked, not the number picked", async () => {
  const page = await open({ ...drill, local: verbsSel({ count: 20 }) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  assert.match(await page.textContent("#prog"), /\/ 15$/);
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) await answerRight(page);
  assert.deepEqual(Object.keys((await deckOf(page)).verbs.best), ["masu|verb|15"]);
  await page.close();
});

// An adjective has no ます form, so masu,nai and nai alone were one drill with two bests.
test("a best leaves out the forms that gave no question", async () => {
  const page = await open({ ...drill, local: verbsSel({ forms: ["masu", "nai"], kinds: ["adj-i"] }) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) await answerRight(page);
  assert.deepEqual(Object.keys((await deckOf(page)).verbs.best), ["nai|adj-i|10"]);
  await page.close();
});

// The list keeps most する nouns bare, so the drill shows and wants the する [電話 → polite = 電話します].
test("a noun that takes する is asked with it and answered with it", async () => {
  const page = await open({ ...drill, local: { ...verbsSel({}), "study.user": "u1", study: deckWith({ "電話|でんわ#r": reviewed() }) } }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  while ((await question(page)).k !== "電話|でんわ") await answerRight(page);
  const ok = await page.textContent("#ok");
  assert.match(await page.textContent("#word"), /する$/);
  assert.equal(await page.textContent("#type"), "noun + する");
  await page.type("#in", "denwashimasu");
  await page.press("#in", "Enter");
  assert.equal(await page.textContent("#ok"), String(+ok + 1));
  assert.equal(await page.inputValue("#in"), "でんわします");
  await page.close();
});

// Only a bare noun gets the + する, and a katakana answer typed in romaji is shown back in katakana [練習する: suru verb; tesutoshimasu → テストします].
test("the type line and a right answer read as the word does", async () => {
  const page = await open({ ...drill, local: { ...verbsSel({ count: 20 }), "study.user": "u1", study: deckWith({ "テスト|テスト#r": reviewed() }) } }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  const types = {};
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const q = await question(page);
    types[q.k] = await page.textContent("#type");
    if (q.k === "テスト|テスト") {
      await page.type("#in", "tesutoshimasu");
      await page.press("#in", "Enter");
      assert.equal(await page.inputValue("#in"), "テストします");
      await page.waitForFunction(() => document.querySelector("#in")?.value !== "テストします" || document.querySelector("h1")?.textContent === "Done!");
    } else await answerRight(page);
  }
  assert.equal(types["テスト|テスト"], "noun + する");
  assert.equal(types["練習する|れんしゅうする"], "suru verb");
  assert.equal(types["言う|いう"], "godan verb");
  await page.close();
});

// A selection saved by an older version may name a form that's gone [label() threw on "gone" and the drill never drew].
test("a stale saved selection drills only the forms that exist", async () => {
  const page = await open({ ...drill, local: verbsSel({ forms: ["gone", "masu"] }) }, "#verbs/run");
  await page.locator(".verb-q").waitFor({ timeout: 3000 });
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    assert.equal((await question(page)).form, "masu");
    await answerRight(page);
  }
  assert.deepEqual(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("hira.study")).verbs.best)), ["masu|verb|10"]);
  await page.close();
});

// Writing the kana back into the box must leave the caret where the learner typed [たべ|ました + ra = たべら|ました].
test("a correction typed mid-answer keeps the caret in place", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  await page.fill("#in", "たべました");
  await page.evaluate(() => document.querySelector("#in").setSelectionRange(2, 2));
  await page.keyboard.type("ra");
  assert.deepEqual(await page.evaluate(() => [document.querySelector("#in").value, document.querySelector("#in").selectionStart]), ["たべらました", 3]);
  // An nn before the caret waits for its next key like one at the end [anna before します = あんなします, not あんあします].
  await page.fill("#in", "します");
  await page.evaluate(() => document.querySelector("#in").setSelectionRange(0, 0));
  await page.keyboard.type("anna");
  assert.deepEqual(await page.evaluate(() => [document.querySelector("#in").value, document.querySelector("#in").selectionStart]), ["あんなします", 3]);
  await page.close();
});

// Enter after a miss on the last question opens Done, and later Enters must leave it be [it redrew with 0:04, 0:05, 0:07].
test("Enter on the Done page after a last-question miss doesn't draw it again", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  while ((await page.textContent("#prog")) !== "10 / 10") await answerRight(page);
  await page.type("#in", "zzz");
  await page.press("#in", "Enter");
  await page.press("#in", "Enter");
  const done = await page.waitForSelector("h1:has-text('Done!')");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  assert.equal(await done.evaluate((h) => h.isConnected), true);
  await page.close();
});

test("the drill's answer box keeps focus through a right answer, a miss and Continue", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  await page.evaluate(() => {
    window.__blurs = 0;
    document.querySelector("#in").addEventListener("blur", () => window.__blurs++);
  });
  await answerRight(page);
  await page.type("#in", "zzz");
  await page.press("#in", "Enter");
  await page.click("#next");
  assert.deepEqual(await page.evaluate(() => [window.__blurs, document.activeElement.id]), [0, "in"]);
  await page.close();
});

// A Japanese keyboard hands over the kanji spelling, which counts like the kana [食べます for 食べる → polite].
test("the kanji spelling from a Japanese keyboard counts as the answer", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  // Past any kana-only word, whose spelling is its kana [する].
  let want = await wantOf(page, await question(page));
  while (want.w === want.r) { await answerRight(page); want = await wantOf(page, await question(page)); }
  const ok = await page.textContent("#ok");
  // With the space an IME leaves behind, and shown back in the spelling typed [食べます + a full-width space → 食べます].
  await page.fill("#in", want.w + String.fromCharCode(0x3000));
  await page.press("#in", "Enter");
  await page.waitForFunction((n) => document.querySelector("#ok").textContent === String(+n + 1), ok, { timeout: 2000 });
  assert.equal(await page.inputValue("#in"), want.w);
  await page.close();
});

test("a drill question shows the word's meaning, so a kana-only verb says which one it is", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  const k = (await question(page)).k;
  const m = await page.evaluate(async (key) => (await (await fetch("data/vocab.json")).json()).find((w) => w.k === key).m, k);
  assert.equal(await page.textContent("#meaning"), m);
  await page.close();
});

// ---------- Grammar ----------
// A grammar card hides its pattern, so a card that gave it away or graded a right form wrong would pass for a working drill.
const GRAMMAR = require("../data/grammar.json");
const grammarSel = (sel) => ({ "grammar.sel": { points: ["tekudasai"], count: 10, ...sel } });
const grammarCard = (page) => page.getAttribute(".gr-q", "data-id").then((i) => GRAMMAR.sentences[+i]);
async function grammarRight(page) {
  const prog = await page.textContent("#prog");
  await page.type("#in", await romajiFor(page, (await grammarCard(page)).gap.r));
  await page.press("#in", "Enter");
  await next(page, prog);
}
const isDone = async (page) => (await page.locator("h1", { hasText: "Done!" }).count()) > 0;

test("the Grammar page lists the 40 points by group, and a point's page explains it with examples, a Tofugu link and a drill", async () => {
  const page = await open(drill, "#grammar");
  await page.locator(".gr-group").first().waitFor();
  assert.deepEqual(await page.locator(".gr-group h2").allTextContents(), [...new Set(GRAMMAR.points.map((p) => p.group))]);
  assert.deepEqual(await page.locator(".gr-point").evaluateAll((as) => as.map((a) => a.getAttribute("href"))), GRAMMAR.points.map((p) => `#grammar/${p.id}`));
  await page.click(".gr-point[href='#grammar/tekudasai']");
  await page.locator(".gr-explain").waitFor();
  assert.equal(await page.textContent("h1"), GRAMMAR.points.find((p) => p.id === "tekudasai").title);
  assert.ok((await page.locator(".examples .ex").count()) >= 2);
  assert.match(await page.getAttribute("a.tofugu", "href"), /^https:\/\/www\.tofugu\.com\/japanese-grammar\/[a-z-]+\/$/);
  assert.equal(await page.getAttribute("#drill", "href"), "#grammar/tekudasai/run");
  await page.close();
});

test("a grammar card names no pattern, hides its N5 readings until answered, and takes the form typed in romaji", async () => {
  const page = await open({ ...drill, local: grammarSel({ points: ["tekudasai", "tai", "teiru"], count: 20 }) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  let hidden = false;
  while (!(await isDone(page))) {
    const s = await grammarCard(page), p = GRAMMAR.points.find((x) => x.id === s.p);
    const shown = await page.textContent(".gr-q");
    assert.ok(!shown.includes(p.title) && !shown.includes(p.attach), shown);
    assert.equal(await page.textContent("#en"), s.en);
    if (!hidden && (await page.locator(".gr-q rt.ask").count())) {
      assert.equal(await page.locator(".gr-q rt.ask").first().isVisible(), false);
      hidden = true;
      const ok = await page.textContent("#ok"), prog = await page.textContent("#prog");
      await page.type("#in", await romajiFor(page, s.gap.r));
      await page.press("#in", "Enter");
      assert.equal(await page.textContent("#ok"), String(+ok + 1));
      assert.equal(await page.locator(".gr-q rt.ask").first().isVisible(), true);
      assert.equal(await page.$eval(".gap.filled", (g) => { const c = g.cloneNode(true); c.querySelectorAll("rt").forEach((r) => r.remove()); return c.textContent; }), s.gap.w);
      await next(page, prog);
    } else await grammarRight(page);
  }
  assert.ok(hidden, "no card had an N5 reading to hide");
  assert.match(await page.textContent("main"), /100%/);
  await page.close();
});

test("a grammar miss shows the answer and names its pattern with a link, and the card comes back later", async () => {
  const page = await open({ ...drill, local: grammarSel({}) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  const first = await grammarCard(page);
  await page.type("#in", "zzz");
  await page.press("#in", "Enter");
  assert.equal(await page.textContent("#fb .ans"), first.gap.w);
  assert.equal(await page.textContent(`#fb a[href='#grammar/${first.p}']`), GRAMMAR.points.find((p) => p.id === first.p).title);
  assert.equal(await page.textContent("#bad"), "1");
  await page.press("#in", "Enter");
  let again = false;
  while (!(await isDone(page))) {
    if ((await grammarCard(page)) === first) again = true;
    await grammarRight(page);
  }
  assert.ok(again, "the missed sentence came back");
  await page.close();
});

test("another right answer the sentence lists counts as right", async () => {
  const other = (s) => s.ok.find((o) => o.r !== s.gap.r);
  const withOk = [...new Set(GRAMMAR.sentences.filter(other).map((s) => s.p))];
  assert.ok(withOk.length, "no sentence lists another right answer");
  const page = await open({ ...drill, local: grammarSel({ points: withOk, count: 40 }) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  let tried = 0;
  while (!(await isDone(page)) && tried < 3) {
    const s = await grammarCard(page);
    if (!other(s)) { await grammarRight(page); continue; }
    const ok = await page.textContent("#ok"), prog = await page.textContent("#prog");
    await page.type("#in", await romajiFor(page, other(s).r));
    await page.press("#in", "Enter");
    assert.equal(await page.textContent("#ok"), String(+ok + 1), `${other(s).w} for ${s.en}`);
    if (/[一-鿿]/.test(other(s).w)) assert.ok(await page.locator(".gap.filled rt").count(), `${other(s).w} filled with no reading`);
    await next(page, prog);
    tried++;
  }
  assert.ok(tried, "no card with another answer came up");
  await page.close();
});

test("a finished grammar run keeps its best per points and count, in the synced deck", async () => {
  const page = await open({ ...drill, local: grammarSel({ points: ["tekudasai", "tai"] }) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  while (!(await isDone(page))) await grammarRight(page);
  assert.equal((await deckOf(page)).grammar.best["tai,tekudasai|10"].acc, 100);
  await page.waitForFunction(() => window.__log.some((l) => l.study?.grammar?.best?.["tai,tekudasai|10"]), null, { timeout: 3000 });
  await page.close();
});

test("the picker drills only the points picked, and a stale saved pick keeps only points that exist", async () => {
  const page = await open({ ...drill, local: grammarSel({ points: ["tekudasai", "gone"] }) }, "#grammar");
  await page.locator("[data-point]").first().waitFor();
  assert.deepEqual(await page.locator("[data-point].on").evaluateAll((cs) => cs.map((c) => c.dataset.point)), ["tekudasai"]);
  await page.click("[data-point='tai']");
  await page.click("#go");
  await page.locator(".gr-q").waitFor();
  const seen = new Set();
  while (!(await isDone(page))) { seen.add((await grammarCard(page)).p); await grammarRight(page); }
  assert.deepEqual([...seen].sort(), ["tai", "tekudasai"]);
  assert.deepEqual(Object.keys((await deckOf(page)).grammar.best), ["tai,tekudasai|10"]);
  await page.close();
});

test("a particle point's drill is the Particles drill on that particle only, and keeps no best", async () => {
  const page = await open(drill, "#grammar/wo");
  await page.locator("#drill").waitFor();
  assert.equal(await page.getAttribute("#drill", "href"), "#particles/run/" + encodeURIComponent("を") + "/wo");
  await page.click("#drill");
  await page.locator(".gap-q").waitFor();
  const n = SENTENCES.filter((c) => c.ok.includes("を")).length;
  assert.equal(await page.textContent("#prog"), `1 / ${Math.min(10, n)}`);
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    assert.ok((await gapCard(page)).ok.includes("を"));
    const { prog } = await choose(page, true);
    await next(page, prog);
  }
  assert.equal((await deckOf(page))?.particles?.best, undefined);
  await page.close();
});

test("Enter on the grammar Done page after a last-question miss doesn't draw it again", async () => {
  const page = await open({ ...drill, local: grammarSel({}) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  while ((await page.textContent("#prog")) !== "10 / 10") await grammarRight(page);
  await page.type("#in", "zzz");
  await page.press("#in", "Enter");
  await page.press("#in", "Enter");
  const done = await page.waitForSelector("h1:has-text('Done!')");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  assert.equal(await done.evaluate((h) => h.isConnected), true);
  await page.close();
});

test("a point's own drill asks each of its sentences once when the count is higher, and files its best under the number asked", async () => {
  const n = GRAMMAR.sentences.filter((s) => s.p === "tekudasai").length;
  const page = await open({ ...drill, local: grammarSel({ points: ["tai"], count: 20 }) }, "#grammar/tekudasai/run");
  await page.locator(".gr-q").waitFor();
  assert.equal(await page.textContent("#prog"), `1 / ${n}`);
  const seen = new Set();
  while (!(await isDone(page))) { seen.add((await grammarCard(page)).id); await grammarRight(page); }
  assert.equal(seen.size, n);
  assert.deepEqual(Object.keys((await deckOf(page)).grammar.best), [`tekudasai|${n}`]);
  await page.close();
});

test("the hub shows the best of a pick that holds fewer sentences than its question count", async () => {
  const n = GRAMMAR.sentences.filter((s) => s.p === "tekudasai").length;
  const study = { ...deckWith({}), grammar: { kana: {}, best: { [`tekudasai|${n}`]: { ms: 20000, acc: 90 } }, resetAt: 0 } };
  const page = await open({ ...drill, local: { ...grammarSel({ count: 20 }), "study.user": "u1", study } }, "#grammar");
  await page.locator("[data-point]").first().waitFor();
  assert.match(await page.textContent("#best"), /Best: 0:20 at 90%/);
  await page.close();
});

test("two grammar cards with the same answer never come back to back [行きませんか twice in a row gives the second away]", async () => {
  const page = await open({ ...drill, local: grammarSel({ points: ["masenka"], count: 10 }) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  const answers = [];
  while (!(await isDone(page))) { answers.push((await grammarCard(page)).gap.r); await grammarRight(page); }
  assert.deepEqual(answers.filter((a, i) => a === answers[i - 1]), [], answers.join(" "));
  await page.close();
});

test("Again on a particle point's drill draws afresh from that particle's sentences", async () => {
  const pool = SENTENCES.filter((c) => c.ok.includes("に"));
  assert.ok(pool.length > 10);
  const page = await open(drill, "#particles/run/" + encodeURIComponent("に"));
  const sets = [];
  for (let run = 0; run < 3; run++) {
    await page.locator(".gap-q").waitFor();
    const ids = [];
    while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
      const { c, prog } = await choose(page, true);
      ids.push(c.id);
      await next(page, prog);
    }
    assert.ok(ids.every((id) => pool.some((c) => c.id === id)));
    sets.push([...ids].sort().join(","));
    await page.click("#re");
  }
  assert.ok(new Set(sets).size > 1, "three runs drew the same sentences");
  await page.close();
});

test("a particle filter that fits nothing opens the Particles picker", async () => {
  const page = await open(drill, "#particles/run/xyz");
  await page.locator("#go").waitFor();
  assert.equal(await page.textContent("h1"), "Particles");
  assert.equal(await page.locator(".gap-q").count(), 0);
  await page.close();
});

test("a point whose answer never changes drills with its sibling [より with の中で]", async () => {
  const page = await open(drill, "#grammar/nohouga-yori");
  await page.locator("#drill").waitFor();
  assert.match(await page.textContent("#drill"), /の中で/);
  await page.click("#drill");
  await page.locator(".gr-q").waitFor();
  const seen = new Set();
  while (!(await isDone(page))) { seen.add((await grammarCard(page)).p); await grammarRight(page); }
  assert.deepEqual([...seen].sort(), ["nohouga-yori", "nonakade-ichiban"]);
  await page.close();
});

test("a particle drill opened from a grammar point leads back to that point", async () => {
  const page = await open(drill, "#grammar/wo");
  await page.locator("#drill").waitFor();
  await page.click("#drill");
  await page.locator(".gap-q").waitFor();
  assert.equal(await page.getAttribute(".row a", "href"), "#grammar/wo");
  assert.equal(await page.textContent(".row a"), "← を");
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const { prog } = await choose(page, true);
    await next(page, prog);
  }
  assert.equal(await page.getAttribute(".panel a.btn", "href"), "#grammar/wo");
  await page.click("#re");
  await page.locator(".gap-q").waitFor();
  assert.equal(await page.getAttribute(".row a", "href"), "#grammar/wo");
  await choose(page, false);
  await page.keyboard.press("Enter");
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const { prog } = await choose(page, true);
    await next(page, prog);
  }
  await page.click("#miss");
  await page.locator(".gap-q").waitFor();
  assert.equal(await page.getAttribute(".row a", "href"), "#grammar/wo");
  await page.close();
});

test("after a miss made with the mouse, Enter and Space still continue", async () => {
  const page = await open(drill, "#particles/run");
  await page.locator(".gap-q").waitFor();
  for (const key of ["Enter", " "]) {
    const c = await gapCard(page), prog = await page.textContent("#prog");
    const wrong = (await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p))).find((p) => !c.ok.includes(p));
    await page.click(`.gap-opt[data-p="${wrong}"]`);
    await page.locator("#next").waitFor();
    // No keyboard ring drawn for a mouse [a black outline on Continue after every click].
    assert.equal(await page.evaluate(() => document.querySelector("#next").matches(":focus-visible")), false);
    // The "oh, it was that one" click on the green answer must not strand the keys either.
    await page.click(".gap-opt.right");
    await page.keyboard.press(key);
    await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, prog, { timeout: 2000 });
  }
  await page.close();
});

test("a number key on the Particles Done page does nothing and throws nothing", async () => {
  const page = await open(drill, "#particles/run");
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.locator(".gap-q").waitFor();
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const { prog } = await choose(page, true);
    await next(page, prog);
  }
  const done = await page.waitForSelector("h1:has-text('Done!')");
  await page.keyboard.press("1");
  await page.keyboard.press("2");
  assert.deepEqual(errors, []);
  assert.equal(await done.evaluate((h) => h.isConnected), true);
  await page.close();
});

test("the Done page lists each missed question once, and Drill the missed ones asks exactly those", async () => {
  const page = await open({ ...drill, local: verbsSel({}) }, "#verbs/run");
  await page.locator(".verb-q").waitFor();
  // The first question missed twice, so Done could list it twice; the next new one missed once.
  const misses = new Map();
  const first = JSON.stringify(await question(page));
  let second = null;
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const q = JSON.stringify(await question(page));
    if (!second && q !== first) second = q;
    if ((misses.get(q) || 0) < (q === first ? 2 : q === second ? 1 : 0)) {
      misses.set(q, (misses.get(q) || 0) + 1);
      await page.type("#in", "zzz");
      await page.press("#in", "Enter");
      await page.press("#in", "Enter");
    } else await answerRight(page);
  }
  assert.equal(misses.get(first), 2);
  const missed = new Set(misses.keys());
  assert.equal(await page.locator(".verb-misses > div").count(), missed.size);
  await page.click("#miss");
  await page.locator(".verb-q").waitFor();
  const asked = new Set();
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) { asked.add(JSON.stringify(await question(page))); await answerRight(page); }
  assert.deepEqual([...asked].sort(), [...missed].sort());
  await page.close();
});

test("あります and います drill together from either page, so each card is ある or いる", async () => {
  for (const id of ["ga-arimasu", "ga-imasu"]) {
    const page = await open(drill, `#grammar/${id}`);
    await page.locator("#drill").waitFor();
    await page.click("#drill");
    await page.locator(".gr-q").waitFor();
    const seen = new Set();
    while (!(await isDone(page))) { seen.add((await grammarCard(page)).p); await grammarRight(page); }
    assert.deepEqual([...seen].sort(), ["ga-arimasu", "ga-imasu"], id);
    await page.close();
  }
});

test("a point picked on the hub brings its siblings, counted and keyed as its page's drill [あります alone also asks います]", async () => {
  const both = GRAMMAR.sentences.filter((s) => ["ga-arimasu", "ga-imasu"].includes(s.p)).length;
  const study = { ...deckWith({}), grammar: { kana: {}, best: { [`ga-arimasu,ga-imasu|${Math.min(20, both)}`]: { ms: 20000, acc: 90 } }, resetAt: 0 } };
  const page = await open({ ...drill, local: { ...grammarSel({ points: ["ga-arimasu"], count: 20 }), "study.user": "u1", study } }, "#grammar");
  await page.locator("[data-point]").first().waitFor();
  assert.match(await page.textContent(".panel"), new RegExp(`${both} sentences`));
  assert.match(await page.textContent("#best"), /Best: 0:20 at 90%/);
  await page.click("#go");
  await page.locator(".gr-q").waitFor();
  const seen = new Set();
  while (!(await isDone(page))) { seen.add((await grammarCard(page)).p); await grammarRight(page); }
  assert.deepEqual([...seen].sort(), ["ga-arimasu", "ga-imasu"]);
  await page.close();
});

test("picking です alone on the hub drills it with its siblings, so the answer isn't always です", async () => {
  const page = await open({ ...drill, local: grammarSel({ points: ["desu"], count: 20 }) }, "#grammar/run");
  await page.locator(".gr-q").waitFor();
  const answers = new Set();
  while (!(await isDone(page))) { answers.add((await grammarCard(page)).gap.r); await grammarRight(page); }
  assert.ok(answers.size > 2, [...answers].join(" "));
  await page.close();
});

test("a typed point's drill leads back to that point, also after Again", async () => {
  const page = await open({ ...drill, local: grammarSel({ count: 10 }) }, "#grammar/tekudasai/run");
  await page.locator(".gr-q").waitFor();
  assert.equal(await page.getAttribute(".row a", "href"), "#grammar/tekudasai");
  while (!(await isDone(page))) await grammarRight(page);
  assert.equal(await page.getAttribute(".panel a.btn", "href"), "#grammar/tekudasai");
  await page.click("#re");
  await page.locator(".gr-q").waitFor();
  assert.equal(await page.getAttribute(".row a", "href"), "#grammar/tekudasai");
  await page.type("#in", "zzz");
  await page.press("#in", "Enter");
  await page.press("#in", "Enter");
  while (!(await isDone(page))) await grammarRight(page);
  await page.click("#miss");
  await page.locator(".gr-q").waitFor();
  assert.equal(await page.getAttribute(".row a", "href"), "#grammar/tekudasai");
  await page.close();
});

test("after a miss made with the keyboard alone, Enter and Space still continue", async () => {
  const page = await open(drill, "#particles/run");
  await page.locator(".gap-q").waitFor();
  for (const key of ["Enter", " "]) {
    const c = await gapCard(page), prog = await page.textContent("#prog");
    const wrong = (await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p))).find((p) => !c.ok.includes(p));
    await page.focus(`.gap-opt[data-p="${wrong}"]`);
    await page.keyboard.press("Enter");
    await page.locator("#next").waitFor();
    await page.keyboard.press(key);
    await page.waitForFunction((p) => document.querySelector("#prog").textContent !== p, prog, { timeout: 2000 });
    // One card on, not two [1 / 10, a miss, then 2 / 11].
    assert.equal(parseInt(await page.textContent("#prog")), parseInt(prog) + 1);
  }
  await page.close();
});

test("Enter on a link while a miss shows follows the link instead of moving on", async () => {
  const page = await open(drill, "#particles/run");
  await page.locator(".gap-q").waitFor();
  await choose(page, false);
  await page.locator("#next").waitFor();
  await page.focus(".row a");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => location.hash === "#particles", null, { timeout: 2000 });
  await page.locator("#go").waitFor();
  await page.close();
});

// ---------- Listening ----------
// Hearing a word and picking its meaning was the one direction no page asked; each case is a way the round could cheat or go deaf.
const heard = (page) => page.evaluate(async () => {
  const k = document.querySelector(".listen-q").dataset.k;
  const w = (await (await fetch("data/vocab.json")).json()).find((x) => x.k === k);
  return { k, m: w.m, w: w.w, clip: HiraSync.wordClip(k) };
});
const pickMeaning = async (page, right) => {
  const h = await heard(page), prog = await page.textContent("#prog");
  const opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
  await page.keyboard.press(String(opts.findIndex((m) => (m === h.m) === right) + 1));
  return { ...h, prog };
};
const listening = { ...drill, local: { "study.user": "u1", study: deckWith({ "花|はな#r": reviewed(), "食べる|たべる#r": reviewed(), "後|あと#r": reviewed() }) } };

test("the Words hub offers Listening for met words with a recording, and a round plays each, takes its meaning by ear and keeps the best", async () => {
  const page = await open(listening, "#words");
  assert.match(await page.textContent('a[href="#words/listen"]'), /\(2\)/);
  await page.click('a[href="#words/listen"]');
  await page.click("#go");
  await page.locator(".listen-q").waitFor();
  assert.equal(await page.textContent("#prog"), "1 / 2");
  const first = await heard(page);
  assert.ok((await page.evaluate(() => window.__played)).at(-1).endsWith(first.clip));
  assert.equal(await page.locator("#word").isVisible(), false);
  assert.equal(await page.locator(".gap-opt").count(), 4);
  assert.equal(await page.locator(".gap-opt.jp").count(), 0);
  const before = (await page.evaluate(() => window.__played)).length;
  await page.keyboard.press(" ");
  assert.equal((await page.evaluate(() => window.__played)).length, before + 1);
  const miss = await pickMeaning(page, false);
  assert.equal(await page.textContent("#bad"), "1");
  assert.ok((await page.textContent(".gap-opt.right")).startsWith(miss.m));
  assert.ok((await page.textContent("#word")).includes(miss.w[0]));
  assert.equal(await page.locator("#word").isVisible(), true);
  await page.keyboard.press("Enter");
  assert.equal(await page.textContent("#prog"), "2 / 3");
  let seenAgain = false;
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    assert.equal(await page.locator("#word").isVisible(), false, "the next word is hidden again");
    const h = await pickMeaning(page, true);
    if (h.k === miss.k) seenAgain = true;
    assert.equal(await page.locator("#word").isVisible(), true);
    await next(page, h.prog);
  }
  assert.ok(seenAgain, "the missed word came back");
  assert.equal((await deckOf(page)).listening.best["2"].acc, 67);
  await page.close();
});

test("with no met word that has a recording, Listening is greyed out and its round opens the picker [後 read あと has none]", async () => {
  const page = await open({ ...drill, local: { "study.user": "u1", study: deckWith({ "後|あと#r": reviewed() }) } }, "#words");
  assert.match(await page.getAttribute('a[href="#words/listen"]', "class"), /\bdisabled\b/);
  await page.goto("#words/listen/run");
  await page.locator("#go").waitFor();
  assert.equal(await page.evaluate(() => location.hash), "#words/listen");
  assert.match(await page.getAttribute("#go", "class"), /\bdisabled\b/);
  assert.equal(await page.locator(".listen-q").count(), 0);
  await page.close();
});

test("a held Space plays the word once, Space on a miss moves on with one play, and the missed ones drill alone with no best", async () => {
  const page = await open(listening, "#words/listen/run");
  await page.locator(".listen-q").waitFor();
  const played = () => page.evaluate(() => window.__played.length);
  let n = await played();
  for (let i = 0; i < 5; i++) await page.keyboard.down(" ");
  await page.keyboard.up(" ");
  assert.equal(await played(), n + 1);
  // Space on a focused choice presses it, as any button does, and plays nothing.
  const miss = await heard(page);
  const opts = await page.locator(".gap-opt").evaluateAll((bs) => bs.map((b) => b.dataset.p));
  await page.locator(".gap-opt").nth(opts.findIndex((m) => m !== miss.m)).focus();
  await page.keyboard.press(" ");
  assert.equal(await page.textContent("#bad"), "1");
  assert.equal(await played(), n + 1);
  // Off the button, Space on the miss is the drill's Continue: the next word plays, once.
  await page.evaluate(() => document.activeElement.blur());
  n = await played();
  await page.keyboard.press(" ");
  assert.equal(await page.textContent("#prog"), "2 / 3");
  assert.equal(await played(), n + 1);
  while (!(await page.locator("h1", { hasText: "Done!" }).count())) {
    const h = await pickMeaning(page, true);
    await next(page, h.prog);
  }
  const best = (await deckOf(page)).listening.best;
  await page.click("#miss");
  await page.locator(".listen-q").waitFor();
  assert.equal(await page.textContent("#prog"), "1 / 1");
  assert.equal((await heard(page)).k, miss.k);
  const last = await pickMeaning(page, true);
  await next(page, last.prog);
  await page.locator("h1", { hasText: "Done!" }).waitFor();
  assert.deepEqual((await deckOf(page)).listening.best, best);
  await page.close();
});
