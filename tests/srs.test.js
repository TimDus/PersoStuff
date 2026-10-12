// The vocabulary scheduler decides when a word comes back, and a wrong rule only shows weeks later as a pile of forgotten words
// or a review count that never shrinks. These pin Anki's SM-2 numbers, the 4 am day, the new-word limit with both card
// directions, and the merge that lets a phone and a PC study the same deck without losing either's answers.
const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const { dayOf, grade, queue, mergeStudy } = require("../srs.js");

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

test("due reviews come before new words, most overdue first", () => {
  const cards = {
    "w5|r5#r": { st: "review", ivl: 3, ease: 2.5, due: 99, n: 2, lapses: 0, first: 90, last: 96 },
    "w6|r6#r": { st: "review", ivl: 3, ease: 2.5, due: 97, n: 2, lapses: 0, first: 90, last: 94 },
    "w7|r7#r": { st: "review", ivl: 3, ease: 2.5, due: 105, n: 2, lapses: 0, first: 90, last: 99 },
  };
  const q = queue({ words: deck, cards, today: 100, newPerDay: 20 });
  assert.deepEqual(q.slice(0, 2).map((c) => c.key), ["w6|r6#r", "w5|r5#r"]);
  assert.ok(!q.some((c) => c.key === "w7|r7#r"));
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

// A later section stores its own key under `study`; a tab on this version must carry it through, not strip it [study.kanji].
test("keys the merge doesn't know survive it, taken from the newer side", () => {
  const m = mergeStudy({ cards: {}, kanji: { a: 1 }, savedAt: 5 }, { cards: {}, kanji: { a: 2 }, verbs: [1], savedAt: 9 });
  assert.deepEqual([m.kanji, m.verbs], [{ a: 2 }, [1]]);
  assert.deepEqual(mergeStudy({ cards: {}, kanji: { a: 1 }, savedAt: 5 }, null).kanji, { a: 1 });
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
