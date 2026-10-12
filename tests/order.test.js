// The quiz asked the same kana twice in a row where one round ended and the next began, and a miss came back once, 3 to 6 later.
// These pin the order rules: 5 others between two of the same kana (fewer only when the quiz is too small), and a miss back
// twice [6–8 and 15–20 on], or once at the farthest fit when the quiz is nearly over.
const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const { gapFor, spaced, requeue, slowest, shareKana } = require("../order.js");

// A repeatable Math.random stand-in [seed 1 always gives the same order].
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const kana = (n) => Array.from({ length: n }, (_, i) => "k" + i);
// Every pair of the same item that sits closer than `gap` others [k1 k2 k1 with gap 2 = one pair].
const tooClose = (q, gap) => q.flatMap((k, i) => q.slice(i + 1, i + 1 + gap).includes(k) ? [i] : []);

test("the gap is 5 from 7 kana up and shrinks below that without ever allowing a repeat", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 46].map(gapFor), [0, 1, 1, 2, 3, 4, 5, 5]);
});

test("a quiz asks each kana once a round and never two of one within the gap", () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 30 }), fc.integer({ min: 1, max: 5 }), fc.integer(), (n, rounds, seed) => {
    const q = spaced(kana(n), rounds, seeded(seed));
    assert.equal(q.length, n * rounds);
    kana(n).forEach((k) => assert.equal(q.filter((x) => x === k).length, rounds));
    assert.deepEqual(tooClose(q, gapFor(n)), []);
  }));
});

test("a small quiz still shuffles each round", () => {
  const runs = Array.from({ length: 20 }, (_, s) => spaced(kana(5), 5, seeded(s)));
  assert.ok(runs.some((q) => q.slice(5, 10).join() !== q.slice(0, 5).join()), "the vowels come in a new order after round 1");
});

test("a miss with room left comes back twice, 6–8 and 15–20 on", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 19 }), fc.integer(), (idx, seed) => {
    const q = kana(40);
    assert.equal(requeue(q, idx, 5, seeded(seed)), 2);
    const at = q.flatMap((k, i) => (k === q[idx] && i > idx ? [i - idx] : []));
    assert.ok(at[0] >= 6 && at[0] <= 8 && at[1] >= 15 && at[1] <= 20, `back at +${at}`);
  }));
});

test("near the end a miss comes back twice while two fit, then once and last", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const ten = kana(33);
    assert.equal(requeue(ten, 22, 5, seeded(seed)), 2, "10 left fits +6 and +12");
    assert.deepEqual(tooClose(ten, 5), []);
    const nine = kana(33);
    assert.equal(requeue(nine, 23, 5, seeded(seed)), 1);
    assert.equal(nine.at(-1), "k23");
  }
  // The last kana missed isn't asked twice in a row; it waits in the Missed list instead [user's call, 2026-10-12].
  const last = kana(33);
  assert.equal(requeue(last, 32, 5), 0);
  assert.deepEqual(last, kana(33));
});

test("misses anywhere in a real quiz keep the gap, short of the very end", () => {
  fc.assert(fc.property(fc.integer({ min: 7, max: 20 }), fc.integer({ min: 1, max: 4 }), fc.integer(), fc.array(fc.boolean(), { maxLength: 80 }),
    (n, rounds, seed, missed) => {
      const rand = seeded(seed);
      const q = spaced(kana(n), rounds, rand);
      const before = q.length;
      let added = 0;
      for (let i = 0; i < q.length && i < missed.length; i++) {
        if (!missed[i]) continue;
        const k = q[i];
        added += requeue(q, i, 5, rand);
        assert.equal(q.length, before + added);
        // Only a copy with nowhere to fit lands closer, and it goes last [k3 missed with 2 left = k3 … k3 at the end].
        if (tooClose(q, 5).length) { assert.equal(q.at(-1), k, `too close at ${tooClose(q, 5)} of ${q.length}`); break; }
      }
    }));
});

// Drilling on time: the missed kana plus the slowest quarter, half or three quarters of the rest.
const timed = (ms) => new Map(ms.map((t, i) => ["k" + i, t]));

test("each share rounds up, and the missed come first in every drill", () => {
  const times = timed([100, 1000, 200, 900, 300, 800, 400, 700, 500, 600, 1500]);
  const drills = slowest(times, ["k10"]);
  assert.deepEqual(drills.map((d) => d.slow), [3, 5, 8], "10 clean kana: 2.5, 5 and 7.5 round up");
  assert.deepEqual(drills[0].items, ["k10", "k1", "k3", "k5"]);
  assert.ok(drills.every((d) => d.items[0] === "k10"));
});

test("a tie at the cut is taken whole, to the tenth of a second", () => {
  const times = timed([2000, 1240, 1160, 1210, 500, 400, 300, 200]);
  assert.deepEqual(slowest(times, [], [0.25])[0].items, ["k0", "k1", "k2", "k3"], "1.24, 1.16 and 1.21 all read 1.2s");
});

test("a share that adds nothing over the last one is left out", () => {
  assert.deepEqual(slowest(timed([300, 200]), []).map((d) => [d.share, d.slow]), [[0.25, 1], [0.75, 2]]);
  assert.deepEqual(slowest(timed([300]), ["k0"]), [], "nothing clean to add to the missed");
});

test("a drill never skips a slower kana for a faster one", () => {
  fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 46 }), fc.array(fc.boolean()), (ms, miss) => {
    const times = timed(ms);
    const missed = [...times.keys()].filter((_, i) => miss[i]);
    const clean = [...times.keys()].filter((k) => !missed.includes(k));
    for (const d of slowest(times, missed)) {
      assert.deepEqual(d.items.slice(0, missed.length), missed);
      const picked = d.items.slice(missed.length);
      assert.ok(picked.length >= Math.ceil(d.share * clean.length));
      const left = clean.filter((k) => !picked.includes(k));
      const tenth = (k) => Math.round(times.get(k) / 100);
      assert.ok(left.every((k) => picked.every((p) => tenth(p) > tenth(k))), `${picked} against ${left}`);
    }
  }));
});

// Two kana in a row that share a character read as the same card twice [や then きゃ, き then きゃ, しゃ then しょ].
global.window = {};
require("../data.js");
const { KANA, ids } = window.HIRAGANA;
const pick = (...groups) => KANA.filter((k) => groups.flat().includes(k.group));

test("kana that share a character count as the same, small kana as their big ones, scripts apart", () => {
  const share = (a, b) => shareKana({ kana: a }, { kana: b });
  assert.deepEqual([share("や", "きゃ"), share("き", "きゃ"), share("しゃ", "しょ"), share("きゃ", "きゃ")], [true, true, true, true]);
  assert.deepEqual([share("や", "ヤ"), share("か", "が"), share("や", "ゆ"), share("きゃ", "しゅ")], [false, false, false, false]);
});

test("a quiz never puts two kana that share a character back to back when it can avoid it", () => {
  const list = pick("y", "k", ids("youon"));
  fc.assert(fc.property(fc.integer({ min: 1, max: 3 }), fc.integer(), (rounds, seed) => {
    const q = spaced(list, rounds, seeded(seed), shareKana);
    assert.equal(q.length, list.length * rounds);
    const pairs = q.slice(1).flatMap((k, i) => (shareKana(q[i], k) ? [q[i].kana + k.kana] : []));
    assert.deepEqual(pairs, []);
  }), { numRuns: 50 });
});

// や ゆ よ with しゃ しゅ しょ has only 30 clash-free orders, and 30 tries missed them in 1 quiz of 20 [しょ then しゃ].
test("even a tight set gets a clash-free order when one exists", () => {
  const list = pick("y", "y-sh");
  for (let seed = 0; seed < 300; seed++) {
    const q = spaced(list, 2, seeded(seed), shareKana);
    assert.deepEqual(q.slice(1).flatMap((k, i) => (shareKana(q[i], k) ? [q[i].kana + k.kana] : [])), [], "seed " + seed);
  }
});

test("a missed kana comes back away from any kana it shares a character with", () => {
  const list = pick("y", "k", ids("youon"));
  fc.assert(fc.property(fc.integer({ min: 0, max: 30 }), fc.integer(), (idx, seed) => {
    const q = spaced(list, 2, seeded(seed), shareKana);
    requeue(q, idx, gapFor(list.length), seeded(seed + 1), shareKana);
    const pairs = q.slice(1).flatMap((k, i) => (shareKana(q[i], k) ? [q[i].kana + k.kana] : []));
    assert.deepEqual(pairs, []);
  }), { numRuns: 50 });
});

// The shared-kana rule ranked above the round and gap rules, so a mix with no clean order ended on five ヴ kana [ヴェ ヴェ].
test("the round and gap rules outrank the shared-kana rule on mixes with no clean order", () => {
  for (const groups of [["k-x-v", "k-w"], ["k-x-v", "w"], ["k-x-v", "y-ky"], ["k-x-v", "k-x-w"]]) {
    const list = pick(groups);
    for (let seed = 0; seed < 40; seed++) {
      const q = spaced(list, 5, seeded(seed), shareKana);
      assert.deepEqual(tooClose(q, gapFor(list.length)), [], `${groups} seed ${seed}: ${q.map((k) => k.kana).join(" ")}`);
    }
  }
});

test("any two columns at any rounds keep the gap with the shared-kana rule on", () => {
  const all = window.HIRAGANA.groups.map((g) => g.id);
  fc.assert(fc.property(fc.constantFrom(...all), fc.constantFrom(...all), fc.integer({ min: 1, max: 5 }), fc.integer(), (a, b, rounds, seed) => {
    const list = pick([...new Set([a, b])]);
    const q = spaced(list, rounds, seeded(seed), shareKana);
    assert.deepEqual(tooClose(q, gapFor(list.length)), []);
  }), { numRuns: 300 });
});

// A miss goes unasked only while a later copy of it is still ahead [しゃ+しょ drill once dropped 3,031 of 3,628 misses].
test("a miss always comes back while no copy of it is still ahead, never right after itself", () => {
  for (const groups of [["y-sh"], ["k", "y-ky"], ["y", "k", "y-ky", "y-sh"]]) {
    const list = pick(groups);
    fc.assert(fc.property(fc.integer(), fc.nat(), (seed, at) => {
      const q = spaced(list, 3, seeded(seed), shareKana);
      const idx = at % (q.length - 1);
      const k = q[idx];
      assert.ok(requeue(q, idx, gapFor(list.length), seeded(seed + 1), shareKana) >= 1, `${groups} idx ${idx}`);
      assert.notEqual(q[idx + 1], k);
    }), { numRuns: 100 });
  }
});

// A whole quiz with random misses, since one requeue on a fresh queue missed the end-append pair [… しょ しょ].
// Each miss: never beside itself; outside the gap whenever any spot outside it was free [びゅ landed inside with 79–103 open].
// Where requeue put things: the positions in the new queue that the old one didn't have [old a b, new a k b = [1]].
const inserted = (before, after) => {
  const at = [];
  for (let i = 0, j = 0; i < after.length; i++) if (after[i] === before[j]) j++; else at.push(i);
  return at;
};
function missLoop(list, rounds, seed, rate) {
  const rand = seeded(seed), gap = gapFor(list.length);
  const q = spaced(list, rounds, rand, shareKana);
  const clear = (queue, p, k) => queue[p - 1] !== k && queue[p] !== k && !queue.slice(Math.max(0, p - gap), p + gap).includes(k);
  for (let idx = 0; idx < q.length; idx++) {
    if (rand() >= rate) continue;
    const k = q[idx], before = [...q];
    let free = false;
    for (let p = idx + 2; p <= before.length; p++) if (clear(before, p, k)) free = true;
    const back = requeue(q, idx, gap, rand, shareKana);
    if (idx < before.length - 1 && !before.slice(idx + 1).includes(k)) assert.ok(back >= 1, `${k.kana} dropped at ${idx} with no copy ahead`);
    for (const i of inserted(before, q)) {
      const near = q.slice(Math.max(0, i - gap), i + gap + 1).filter((x) => x === k).length;
      if (free) assert.equal(near, 1, `${list.map((x) => x.kana).join("")} seed ${seed}: ${k.kana} put inside the gap at ${i} with room outside`);
    }
  }
  return q;
}

test("a quiz full of misses never shows a kana twice in a row", () => {
  for (const [groups, rounds] of [[["a", "k"], 3], [["k-x-t"], 3], [["y-sh"], 3], [["k", "y-ky"], 3], [["k-x-v", "k-w"], 5], [ids("youon"), 2], [["y", "k", "y-ky", "y-sh"], 2]]) {
    const list = pick(groups);
    for (let seed = 0; seed < 60; seed++) {
      const q = missLoop(list, rounds, seed, 0.4);
      const twice = q.slice(1).flatMap((k, i) => (q[i] === k ? [i] : []));
      assert.deepEqual(twice, [], `${groups} seed ${seed}: ${q.map((k) => k.kana).join(" ")}`);
    }
  }
});

test("a mid-quiz miss is placed outside the gap whenever a spot outside it is free", () => {
  for (const [groups, rounds] of [[ids("youon"), 2], [["y", "k", "y-ky", "y-sh"], 2], [["k-x-v", "k-w"], 5]]) {
    for (let seed = 0; seed < 60; seed++) missLoop(pick(groups), rounds, seed, 0.3);
  }
});
