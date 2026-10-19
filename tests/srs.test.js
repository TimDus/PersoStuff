// The vocabulary scheduler decides when a word comes back, and a wrong rule only shows weeks later as a pile of forgotten words
// or a review count that never shrinks. These pin Anki's SM-2 numbers, the 4 am day, the new-word limit with both card
// directions, and the merge that lets a phone and a PC study the same deck without losing either's answers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const { dayOf, grade, preview, queue, place, mergeStudy } = require("../srs.js");

const H = 3600e3;
// Local midnight-based times in a fixed zone so the 4 am rule doesn't depend on this machine [UTC+2, offset -120].
const at = (iso) => Date.parse(iso + "+02:00");

test("a study day starts at 4 am local time, not midnight", () => {
  assert.equal(dayOf(at("2026-10-12T03:59:00"), -120), dayOf(at("2026-10-11T12:00:00"), -120));
  assert.equal(dayOf(at("2026-10-12T04:00:00"), -120), dayOf(at("2026-10-11T12:00:00"), -120) + 1);
});

test("a new card passed with Good comes back tomorrow, with Easy in four days", () => {
  const good = grade(undefined, 3, 100);
  assert.deepEqual([good.card.due, good.card.ivl, good.card.ease, good.again], [101, 1, 2.5, false]);
  const easy = grade(undefined, 4, 100);
  assert.deepEqual([easy.card.due, easy.card.ivl], [104, 4]);
});

test("Again or Hard on a new card keeps it in today's session", () => {
  for (const g of [1, 2]) {
    const r = grade(undefined, g, 100);
    assert.equal(r.again, true);
    assert.equal(r.card.st, "learn");
    assert.equal(r.card.first, 100);
  }
});

test("a review's interval grows by its ease on Good, by 1.2 on Hard, and by ease × 1.3 on Easy", () => {
  const card = { st: "review", ivl: 10, ease: 2.5, due: 100, n: 5, lapses: 0, first: 50, last: 90 };
  const hard = grade(card, 2, 100).card, good = grade(card, 3, 100).card, easy = grade(card, 4, 100).card;
  assert.deepEqual([hard.ivl, hard.ease], [12, 2.35]);
  assert.deepEqual([good.ivl, good.ease, good.due], [25, 2.5, 125]);
  assert.deepEqual([easy.ivl, easy.ease], [33, 2.65]);
});

test("a late review counts the days it waited [10 days late on a 10-day card, Good = (10 + 5) × 2.5]", () => {
  const card = { st: "review", ivl: 10, ease: 2.5, due: 90, n: 5, lapses: 0, first: 50, last: 80 };
  assert.equal(grade(card, 3, 100).card.ivl, 38);
});

test("a lapse costs 0.2 ease, never below 1.3, and relearns from tomorrow", () => {
  const card = { st: "review", ivl: 30, ease: 1.4, due: 100, n: 9, lapses: 1, first: 10, last: 70 };
  const r = grade(card, 1, 100);
  assert.deepEqual([r.again, r.card.st, r.card.ease, r.card.lapses], [true, "relearn", 1.3, 2]);
  const back = grade(r.card, 3, 100).card;
  assert.deepEqual([back.st, back.due, back.ivl], ["review", 101, 1]);
});

// Good only falls behind Hard on a short interval at the lowest ease, which random runs never reached [1 day at 1.3: Good 1, Hard 2].
test("on a review, Easy always beats Good and Good always beats Hard", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 3000 }), fc.integer({ min: 130, max: 400 }), fc.integer({ min: 0, max: 60 }), (ivl, e, late) => {
    const card = { st: "review", ivl, ease: e / 100, due: 1000 - late, n: 3, lapses: 0, first: 1, last: 1 };
    const [h, g, ez] = [2, 3, 4].map((x) => grade(card, x, 1000).card.ivl);
    return h > ivl && g > h && ez > g && ez <= 36500;
  }), { examples: [[1, 130, 0], [3, 130, 0]] });
});

const word = (k, lv = 5) => ({ k, lv });
const deck = Array.from({ length: 50 }, (_, i) => word(`w${i}|r${i}`));

test("a fresh deck offers the first 20 words, Japanese side only", () => {
  const q = queue({ words: deck, cards: {}, today: 100, newPerDay: 20 });
  assert.equal(q.length, 20);
  assert.deepEqual(q.map((c) => c.dir), Array(20).fill("r"));
  assert.equal(q[0].word.k, "w0|r0");
});

test("words met today use up the day's 20, so a second session only offers the rest", () => {
  const cards = {};
  for (let i = 0; i < 15; i++) cards[`w${i}|r${i}#r`] = { st: "review", ivl: 1, ease: 2.5, due: 101, n: 1, lapses: 0, first: 100, last: 100 };
  const q = queue({ words: deck, cards, today: 100, newPerDay: 20 });
  assert.deepEqual(q.map((c) => c.word.k), ["w15|r15", "w16|r16", "w17|r17", "w18|r18", "w19|r19"]);
});

test("the English-side card of a word arrives the day after its Japanese side was first seen", () => {
  const cards = { "w0|r0#r": { st: "review", ivl: 1, ease: 2.5, due: 101, n: 1, lapses: 0, first: 100, last: 100 } };
  assert.equal(queue({ words: deck, cards, today: 100, newPerDay: 20 }).filter((c) => c.dir === "p").length, 0);
  const next = queue({ words: deck, cards, today: 101, newPerDay: 20 });
  assert.deepEqual(next.filter((c) => c.word.k === "w0|r0").map((c) => c.dir), ["r", "p"]);
});

test("due reviews come before new words, whatever day each fell due", () => {
  const cards = {
    "w5|r5#r": { st: "review", ivl: 3, ease: 2.5, due: 99, n: 2, lapses: 0, first: 90, last: 96 },
    "w6|r6#r": { st: "review", ivl: 3, ease: 2.5, due: 97, n: 2, lapses: 0, first: 90, last: 94 },
    "w7|r7#r": { st: "review", ivl: 3, ease: 2.5, due: 105, n: 2, lapses: 0, first: 90, last: 99 },
  };
  const q = queue({ words: deck, cards, today: 100, newPerDay: 20 });
  assert.deepEqual(q.slice(0, 2).map((c) => c.key).sort(), ["w5|r5#r", "w6|r6#r"]);
  assert.ok(!q.some((c) => c.key === "w7|r7#r"));
});

// Reviews due the same day came in the word list's order every time, so a batch met together could be answered by position [the one after 学校].
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
// Most overdue first then kept a skipped day's batch together as one block, ahead of today's [w0–w2 always the first three].
test("reviews come in a fresh order each session, a day overdue mixed in with today's", () => {
  const cards = {};
  for (let i = 0; i < 10; i++) cards[`w${i}|r${i}#r`] = { st: "review", ivl: 3, ease: 2.5, due: i < 3 ? 98 : 100, n: 2, lapses: 0, first: 90, last: 97 };
  const run = (seed) => queue({ words: deck, cards, today: 100, newPerDay: 0, rand: seeded(seed) }).map((c) => c.word.k);
  const seeds = Array.from({ length: 20 }, (_, i) => i + 1);
  assert.ok(new Set(seeds.map((s) => run(s).join())).size > 1, "twenty sessions gave one order");
  assert.ok(seeds.some((s) => run(s).slice(0, 3).sort().join() !== "w0|r0,w1|r1,w2|r2"), "the overdue three always came first");
  for (const s of seeds) assert.equal(run(s).length, 10);
});

// A word's two sides came back to back, so the second was answered off the first [会う → to meet, then "to meet" → 会う].
const card = (due) => ({ st: "review", ivl: 3, ease: 2.5, due, n: 2, lapses: 0, first: 90, last: 97 });
const apart = (q, k) => Math.abs(q.findIndex((c) => c.key === `${k}#r`) - q.findIndex((c) => c.key === `${k}#p`));
test("a word's two sides have at least 10 cards between them when the session has room", () => {
  fc.assert(fc.property(fc.integer(), (seed) => {
    const cards = {};
    for (let i = 0; i < 25; i++) cards[`w${i}|r${i}#r`] = card(100);
    for (let i = 0; i < 5; i++) cards[`w${i}|r${i}#p`] = card(100);
    const q = queue({ words: deck, cards, today: 100, newPerDay: 0, rand: seeded(seed) });
    return q.length === 30 && [0, 1, 2, 3, 4].every((i) => apart(q, `w${i}|r${i}`) > 10);
  }));
});

test("with no room the two sides go as far apart as the session allows", () => {
  const cards = { "w0|r0#r": card(100), "w0|r0#p": card(100), "w1|r1#r": card(100) };
  for (const seed of [1, 2, 3, 4, 5]) assert.equal(apart(queue({ words: deck, cards, today: 100, newPerDay: 0, rand: seeded(seed) }), "w0|r0"), 2);
});

test("two words spelled alike count as one word for the gap [外 read そと and 外 read ほか]", () => {
  const words = [{ k: "外|そと", w: "外", lv: 5 }, { k: "外|ほか", w: "外", lv: 5 }, ...deck];
  const q = queue({ words, cards: {}, today: 100, newPerDay: 20 });
  assert.ok(Math.abs(q.findIndex((c) => c.key === "外|そと#r") - q.findIndex((c) => c.key === "外|ほか#r")) > 10);
});

// A card put back on Again went 3 cards on whatever was there, its other side included [会う#p just answered, 会う#r 3 later].
test("a card put back keeps 10 cards from its other side, counting the ones just answered", () => {
  const it = (k, dir) => ({ key: `${k}#${dir}`, word: { k }, dir });
  const rest = deck.slice(1, 21).map((w) => it(w.k, "r"));
  assert.equal(place(rest, it("w0|r0", "r"), 3), 3);
  assert.equal(place(rest, it("w0|r0", "r"), 3, { shown: [it("w0|r0", "p"), it("w0|r0", "r")] }), 9);
  assert.equal(place([it("w0|r0", "p"), ...rest], it("w0|r0", "r"), 3), 11);
});

// Farthest from its other side was the session's end, an Again card held back 17 cards for one more of gap.
test("a card put back with no spot 10 clear stays within reach of where it would go", () => {
  const it = (k, dir) => ({ key: `${k}#${dir}`, word: { k }, dir });
  const run = deck.slice(1, 20).map((w) => it(w.k, "r"));
  run.splice(10, 0, it("w0|r0", "p"));
  assert.equal(place(run, it("w0|r0", "r"), 3, { reach: 10 }), 3);
  assert.equal(place(run, it("w0|r0", "r"), 3), 20);
});

// Every card met on one day came back on the same days after, a batch for good [20 words met Monday, all due on day 4, 10, 25].
test("a keyed answer lands within Anki's fuzz of the exact interval, and its button shows what it gives", () => {
  const review = { st: "review", ivl: 10, ease: 2.5, due: 100, n: 5, lapses: 0, first: 50, last: 90 };
  const keys = Array.from({ length: 60 }, (_, i) => `w${i}|r${i}#r`);
  const goods = keys.map((k) => grade(review, 3, 100, k).card.ivl);
  assert.ok(goods.every((g) => g >= 22 && g <= 28), goods.join());
  assert.ok(new Set(goods).size >= 4, goods.join());
  for (const k of keys) assert.deepEqual(preview(review, 100, k), [1, 2, 3, 4].map((g) => { const r = grade(review, g, 100, k); return r.again ? 0 : r.card.ivl; }));
  assert.equal(grade(review, 3, 100).card.ivl, 25);
  assert.ok(keys.every((k) => grade({}, 3, 100, k).card.ivl === 1));
});

test("with fuzz, Easy still beats Good and Good still beats Hard", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 3000 }), fc.integer({ min: 130, max: 400 }), fc.integer({ min: 0, max: 60 }), fc.string(), (ivl, e, late, key) => {
    const c = { st: "review", ivl, ease: e / 100, due: 1000 - late, n: 3, lapses: 0, first: 1, last: 1 };
    const [h, g, ez] = [2, 3, 4].map((x) => grade(c, x, 1000, key).card.ivl);
    return h > ivl && g > h && ez > g && ez <= 36500;
  }), { examples: [[1, 130, 0, "a"], [3, 130, 0, "a"]] });
});

// Words follow the kanji: one with kanji waits until each has a card, while a word already met keeps going [学生 opens once 学 and 生 have one].
test("only words the ready rule passes are offered new, while a met word keeps its reviews and gets its English side", () => {
  const ready = (w) => !["w0|r0", "w2|r2"].includes(w.k);
  assert.deepEqual(queue({ words: deck, cards: {}, today: 100, newPerDay: 3, ready }).map((c) => c.word.k), ["w1|r1", "w3|r3", "w4|r4"]);
  const cards = { "w0|r0#r": { st: "review", ivl: 1, ease: 2.5, due: 100, n: 1, lapses: 0, first: 99, last: 99 } };
  const q = queue({ words: deck, cards, today: 100, newPerDay: 3, ready });
  assert.deepEqual(q.filter((c) => c.word.k === "w0|r0").map((c) => c.dir), ["r", "p"]);
  assert.equal(q.some((c) => c.word.k === "w2|r2"), false);
});

test("a card left in learning by a closed tab is offered again", () => {
  const cards = { "w0|r0#r": { st: "learn", ivl: 0, ease: 2.5, due: 100, n: 1, lapses: 0, first: 100, last: 100 } };
  assert.ok(queue({ words: deck, cards, today: 100, newPerDay: 20 }).some((c) => c.key === "w0|r0#r"));
});

const side = (cards, settings, savedAt = 1) => ({ cards, settings, savedAt });
test("two devices' decks merge card by card, the one with more answers winning", () => {
  const few = { st: "review", ivl: 4, ease: 2.5, due: 104, n: 2, lapses: 0, first: 90, last: 100 };
  const many = { st: "review", ivl: 2, ease: 2.3, due: 102, n: 6, lapses: 1, first: 90, last: 99 };
  const m = mergeStudy(side({ "a#r": few, "b#r": few }, { newPerDay: 20, at: 5 }), side({ "a#r": many }, { newPerDay: 10, at: 9 }, 7));
  assert.deepEqual(m.cards["a#r"], many);
  assert.deepEqual(m.cards["b#r"], few);
  assert.deepEqual(m.settings, { newPerDay: 10, at: 9 });
  assert.equal(m.savedAt, 7);
});

test("a device with no study data yet doesn't empty the other's deck", () => {
  const card = { st: "review", ivl: 4, ease: 2.5, due: 104, n: 2, lapses: 0, first: 90, last: 100 };
  assert.deepEqual(mergeStudy(null, side({ "a#r": card }, { newPerDay: 20, at: 1 })).cards, { "a#r": card });
  assert.deepEqual(mergeStudy({}, side({ "a#r": card }, { newPerDay: 20, at: 1 })).cards, { "a#r": card });
});

// A later section stores its own key under `study`; a tab on this version must carry it through, not strip it [study.shadowing].
test("keys the merge doesn't know survive it, taken from the newer side", () => {
  const m = mergeStudy({ cards: {}, reading: { a: 1 }, savedAt: 5 }, { cards: {}, reading: { a: 2 }, shadowing: [1], savedAt: 9 });
  assert.deepEqual([m.reading, m.shadowing], [{ a: 2 }, [1]]);
  assert.deepEqual(mergeStudy({ cards: {}, reading: { a: 1 }, savedAt: 5 }, null).reading, { a: 1 });
});

// Kanji cards ride in `study.kanji`; taken whole from the newer side, one device's reviews would wipe the other's.
test("kanji cards merge card by card and their settings by the later change", () => {
  const few = { st: "review", ivl: 4, ease: 2.5, due: 104, n: 2, lapses: 0, first: 90, last: 100 };
  const many = { ...few, n: 5, last: 101 };
  const phone = { cards: {}, savedAt: 9, kanji: { cards: { 学: few, 生: few }, settings: { newPerDay: 5, at: 3 } } };
  const pc = { cards: {}, savedAt: 4, kanji: { cards: { 学: many, 大: few }, settings: { newPerDay: 20, at: 8 }, note: "pc" } };
  for (const m of [mergeStudy(phone, pc), mergeStudy(pc, phone)]) {
    assert.deepEqual(m.kanji.cards, { 学: many, 生: few, 大: few });
    assert.deepEqual(m.kanji.settings, { newPerDay: 20, at: 8 });
    assert.equal(m.kanji.note, "pc", "a field the merge doesn't know is carried");
  }
  assert.deepEqual(mergeStudy({ cards: {}, savedAt: 1 }, pc).kanji.cards, { 学: many, 大: few });
  assert.equal(mergeStudy({ cards: {}, savedAt: 1 }, null).kanji, undefined, "a deck that never studied kanji gets no kanji key");
});

test("two copies of a card with the same answers and day settle on the same one whichever side merges", () => {
  const a = { st: "review", ivl: 3, ease: 2.5, due: 103, n: 4, lapses: 0, first: 90, last: 100 };
  const b = { ...a, ivl: 1, ease: 2.3, due: 101, lapses: 1 };
  const ab = mergeStudy({ cards: { k: a } }, { cards: { k: b } }).cards.k;
  const ba = mergeStudy({ cards: { k: b } }, { cards: { k: a } }).cards.k;
  assert.deepEqual(ab, ba);
});

test("English sides met today count against the day's words too", () => {
  const cards = {};
  for (let i = 0; i < 30; i++) cards[`w${i}|r${i}#r`] = { st: "review", ivl: 5, ease: 2.5, due: 110, n: 1, lapses: 0, first: 90, last: 90 };
  for (let i = 0; i < 15; i++) cards[`w${i}|r${i}#p`] = { st: "review", ivl: 1, ease: 2.5, due: 101, n: 1, lapses: 0, first: 100, last: 100 };
  assert.equal(queue({ words: deck, cards, today: 100, newPerDay: 20 }).filter((c) => c.dir === "p").length, 5);
});

test("Hard follows current Anki, the interval times 1.2 whatever the delay [10 days, 8 late = 12]", () => {
  const card = { st: "review", ivl: 10, ease: 2.5, due: 92, n: 5, lapses: 0, first: 50, last: 82 };
  assert.equal(grade(card, 2, 100).card.ivl, 12);
});

test("Easy on a relearning card gives a day more than Good", () => {
  const lapsed = { st: "relearn", ivl: 1, ease: 1.9, due: 100, n: 8, lapses: 2, first: 10, last: 100 };
  assert.deepEqual([grade(lapsed, 3, 100).card.ivl, grade(lapsed, 4, 100).card.ivl], [1, 2]);
});

test("two copies differing anywhere settle on one, not just in the ranked fields [Again vs Hard on a new word: only miss differs]", () => {
  const a = { st: "learn", ivl: 0, ease: 2.5, due: 100, n: 1, lapses: 0, first: 100, last: 100, miss: 100 };
  const b = { st: "learn", ivl: 0, ease: 2.5, due: 100, n: 1, lapses: 0, first: 100, last: 100 };
  assert.deepEqual(mergeStudy({ cards: { k: a } }, { cards: { k: b } }).cards.k, mergeStudy({ cards: { k: b } }, { cards: { k: a } }).cards.k);
});

// Writing progress rides in the deck, so the deck's merge-the-newer-side-whole would let one device's writing overwrite the other's.
test("writing progress merges kana by kana with the kana rules, and its own reset drops an older copy", () => {
  const phone = { cards: {}, savedAt: 9, write: { kana: { か: { box: 2, right: 9, wrong: 3 } }, best: { "a/1": { ms: 9000, acc: 100 } }, resetAt: 0 } };
  const pc = { cards: {}, savedAt: 5, write: { kana: { か: { box: 4, right: 3, wrong: 0 }, き: { box: 1, right: 0, wrong: 1 } }, best: { "a/1": { ms: 5000, acc: 100 } }, resetAt: 0 } };
  const m = mergeStudy(phone, pc);
  assert.deepEqual(m.write.kana, { か: { box: 2, right: 9, wrong: 3 }, き: { box: 1, right: 0, wrong: 1 } });
  assert.deepEqual(m.write.best, { "a/1": { ms: 5000, acc: 100 } });
  const reset = { cards: {}, savedAt: 3, write: { kana: {}, best: {}, resetAt: 7 } };
  assert.deepEqual(mergeStudy(phone, reset).write, { kana: {}, best: {}, resetAt: 7 });
  assert.equal(mergeStudy({ cards: {}, savedAt: 1 }, null).write, undefined, "a deck that never wrote gets no write key");
});

// Verb drill bests and per-form answers sit under `study.verbs`, merged like the writing quiz's rather than taken whole from the newer side.
test("verb drill scores from two devices are both kept, the better best winning", () => {
  const a = { cards: {}, savedAt: 5, verbs: { kana: { masu: { box: 2, right: 3, wrong: 0 } }, best: { "masu|verb": { ms: 9000, acc: 90 } }, resetAt: 0 } };
  const b = { cards: {}, savedAt: 9, verbs: { kana: { te: { box: 1, right: 1, wrong: 2 } }, best: { "masu|verb": { ms: 7000, acc: 100 }, "te|verb": { ms: 5000, acc: 80 } }, resetAt: 0 } };
  const m = mergeStudy(b, a).verbs;
  assert.deepEqual(Object.keys(m.kana).sort(), ["masu", "te"]);
  assert.deepEqual(m.best["masu|verb"], { ms: 7000, acc: 100 });
  assert.deepEqual(Object.keys(m.best).sort(), ["masu|verb", "te|verb"]);
});

// Particle drill bests sit under `study.particles`; taken whole from the newer side, a slower newer run would undo a faster older one.
test("particle drill bests from two devices are both kept, the better best winning even from the older side", () => {
  const older = { cards: {}, savedAt: 5, particles: { kana: {}, best: { 10: { ms: 30000, acc: 100 }, 40: { ms: 99000, acc: 90 } }, resetAt: 0 } };
  const newer = { cards: {}, savedAt: 9, particles: { kana: {}, best: { 10: { ms: 50000, acc: 90 }, 20: { ms: 60000, acc: 95 } }, resetAt: 0 } };
  const m = mergeStudy(newer, older).particles;
  assert.deepEqual(m.best[10], { ms: 30000, acc: 100 });
  assert.deepEqual(Object.keys(m.best).sort(), ["10", "20", "40"]);
  assert.equal(mergeStudy({ cards: {}, savedAt: 1 }, null).particles, undefined, "a deck that never drilled particles gets no key");
});

// Grammar drill bests sit under `study.grammar`, merged like the particle drill's for the same reason.
test("grammar drill bests from two devices are both kept, the better best winning even from the older side", () => {
  const older = { cards: {}, savedAt: 5, grammar: { kana: {}, best: { "tai,tekudasai|10": { ms: 30000, acc: 100 }, "node|20": { ms: 99000, acc: 90 } }, resetAt: 0 } };
  const newer = { cards: {}, savedAt: 9, grammar: { kana: {}, best: { "tai,tekudasai|10": { ms: 50000, acc: 90 }, "teiru|10": { ms: 60000, acc: 95 } }, resetAt: 0 } };
  const m = mergeStudy(newer, older).grammar;
  assert.deepEqual(m.best["tai,tekudasai|10"], { ms: 30000, acc: 100 });
  assert.deepEqual(Object.keys(m.best).sort(), ["node|20", "tai,tekudasai|10", "teiru|10"]);
  assert.equal(mergeStudy({ cards: {}, savedAt: 1 }, null).grammar, undefined, "a deck that never drilled grammar gets no key");
});
