// The Particles steps answer by choice, so a step drill of one particle's sentences gives its answer away every card
// [a を-only drill: press を ten times]; each step mixes in earlier steps' sentences, and the review keeps to what was taught.
const test = require("node:test");
const assert = require("node:assert/strict");
const { STEPS, own, stepQueue, reviewQueue } = require("../particle-lessons.js");
const { CHOICES } = require("../particles.js");

// A seeded rand, so a failing draw can be replayed [seed 7 always draws the same 10].
const seeded = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const meets = (c, list) => c.ok.some((p) => list.includes(p));
const taughtBy = (i) => STEPS.slice(0, i).flatMap((s) => s.particles);

test("every particle the drill offers is taught by exactly one step", () => {
  assert.deepEqual([...STEPS.flatMap((s) => s.particles)].sort(), [...CHOICES].sort());
});

test("each step has at least 5 sentences of its own", () => {
  for (const s of STEPS) assert.ok(own(s).length >= 5, `${s.id}: ${own(s).length}`);
});

test("a step drill is 10 different sentences, at least half its own and the rest from earlier steps", () => {
  STEPS.forEach((step, i) => {
    for (let seed = 1; seed <= 30; seed++) {
      const q = stepQueue(step, seeded(seed));
      assert.equal(q.length, 10, step.id);
      assert.equal(new Set(q).size, 10, step.id);
      const mine = q.filter((c) => meets(c, step.particles)).length;
      assert.ok(mine >= 5, `${step.id} seed ${seed}: ${mine} own`);
      assert.deepEqual(q.filter((c) => !meets(c, taughtBy(i + 1))).map((c) => c.s), [], step.id);
    }
  });
});

// 公園＿散歩します takes を or で; Step 2's drill offered で より や の, its only right answer a particle Step 4 teaches.
test("a step or review card never offers an untaught particle as its right answer", () => {
  const { options } = require("../particles.js");
  STEPS.forEach((step, i) => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const c of stepQueue(step, seeded(seed))) {
        for (let r = 0; r < 5; r++) {
          const right = options(c, seeded(seed * 7 + r)).filter((p) => c.ok.includes(p));
          assert.deepEqual(right.filter((p) => !taughtBy(i + 1).includes(p)), [], `${step.id} #${c.id}`);
        }
      }
    }
  });
  for (const c of reviewQueue([STEPS[0], STEPS[1]], seeded(5))) assert.ok(c.ok.every((p) => ["は", "が", "を"].includes(p)), `#${c.id}`);
});

test("after Step 1 a step drill always mixes in earlier sentences, so its answer isn't the same every card", () => {
  STEPS.slice(1).forEach((step) => {
    for (let seed = 1; seed <= 30; seed++) {
      const q = stepQueue(step, seeded(seed));
      assert.ok(q.some((c) => !meets(c, step.particles)), `${step.id} seed ${seed}`);
    }
  });
});

test("the review asks only the finished steps' sentences, at most 20 [Steps 1 and 6: never a を-only card]", () => {
  const done = [STEPS[0], STEPS[5]];
  const q = reviewQueue(done, seeded(3));
  assert.equal(q.length, 19);
  assert.equal(new Set(q).size, 19);
  assert.equal(reviewQueue(STEPS, seeded(3)).length, 20);
  assert.deepEqual(q.filter((c) => !meets(c, ["は", "が", "も"])).map((c) => c.s), []);
  const small = reviewQueue([STEPS[5]], seeded(3));
  assert.equal(small.length, own(STEPS[5]).length);
});
