// Progress from two devices has to combine without losing answers, and a reset has to stay reset.
// Without these, the first sign-in on a second device would overwrite a week of phone practice with an empty PC copy,
// and "Reset my progress" would come straight back from whichever device synced next.
const test = require("node:test");
const assert = require("node:assert/strict");
const { merge, mergeWrite, clipPath, same, wholeCategories } = require("../sync.js");

const side = (over) => ({ progress: {}, "quiz.best": {}, "sheets.done": {}, "reading.done": [], savedAt: 100, resetAt: 0, ...over });

test("kana known on either device end up on both", () => {
  const m = merge(side({ progress: { か: { box: 3, right: 4, wrong: 0 } } }), side({ progress: { き: { box: 2, right: 1, wrong: 1 } } }));
  assert.deepEqual(Object.keys(m.progress).sort(), ["か", "き"]);
});

test("the copy with more answers wins over a higher box", () => {
  const lots = { box: 2, right: 9, wrong: 3 };
  const few = { box: 4, right: 3, wrong: 0 };
  assert.deepEqual(merge(side({ progress: { か: few } }), side({ progress: { か: lots } })).progress.か, lots);
  assert.deepEqual(merge(side({ progress: { か: lots } }), side({ progress: { か: few } })).progress.か, lots);
});

test("quiz bests keep higher accuracy, then the faster time", () => {
  const m = merge(
    side({ "quiz.best": { "a/1": { ms: 9000, acc: 100 }, "k/1": { ms: 5000, acc: 90 } } }),
    side({ "quiz.best": { "a/1": { ms: 4000, acc: 80 }, "k/1": { ms: 4000, acc: 90 } } }),
  );
  assert.deepEqual(m["quiz.best"]["a/1"], { ms: 9000, acc: 100 });
  assert.deepEqual(m["quiz.best"]["k/1"], { ms: 4000, acc: 90 });
});

test("only quizzes of whole categories keep a best time, from either side", () => {
  globalThis.window = globalThis;
  require("../data.js");
  const keep = wholeCategories(window.HIRAGANA.groups);
  const t = { ms: 9000, acc: 100 };
  const hiraMain = "a,k,s,t,n,h,m,y,r,w";
  const withExtended = `${hiraMain},k-x-v,k-x-w,k-x-f,k-x-ts,k-x-e,k-x-t,k-x-dh/1`;
  const m = merge(
    side({ "quiz.best": { [`${hiraMain}/2`]: t, "a,k,s/2": t, "g,z,d,b/1": t } }),
    side({ "quiz.best": { [withExtended]: t, [`${hiraMain},k-x-v/1`]: t, "zz/1": t } }),
    keep,
  );
  assert.deepEqual(Object.keys(m["quiz.best"]).sort(), [`${hiraMain}/2`, withExtended].sort());
  assert.ok(keep(`g,z,d,b,p,${hiraMain}/1`), "key order doesn't matter");
  assert.ok(!keep("/1"), "an empty selection is no category");
});

test("worksheet scores keep the best and read sentences add up", () => {
  const m = merge(side({ "sheets.done": { k: 95 }, "reading.done": ["0-1"] }), side({ "sheets.done": { k: 80, s: 50 }, "reading.done": ["0-1", "1-4"] }));
  assert.deepEqual(m["sheets.done"], { k: 95, s: 50 });
  assert.deepEqual(m["reading.done"], ["0-1", "1-4"]);
});

test("a first sync against an empty account keeps everything local", () => {
  const local = side({ progress: { か: { box: 3, right: 4, wrong: 0 } }, savedAt: 500 });
  assert.deepEqual(merge(local, null), local);
});

test("a device that hasn't seen a reset can't bring old progress back", () => {
  const resetPc = side({ savedAt: 1000, resetAt: 1000 });
  const stalePhone = side({ progress: { か: { box: 5, right: 20, wrong: 0 } }, savedAt: 900 });
  assert.deepEqual(merge(resetPc, stalePhone).progress, {});
  const answeredSince = side({ progress: { か: { box: 5, right: 21, wrong: 0 } }, "quiz.best": { "a/1": { ms: 9000, acc: 100 } }, savedAt: 1100 });
  const m = merge(resetPc, answeredSince);
  assert.deepEqual([m.progress, m["quiz.best"]], [{}, {}]);
  const slowClockAfter = side({ progress: { き: { box: 2, right: 1, wrong: 0 } }, savedAt: 990, resetAt: 1000 });
  assert.deepEqual(Object.keys(merge(resetPc, slowClockAfter).progress), ["き"]);
});

test("a row read back with its keys reordered still counts as the same", () => {
  assert.ok(same({ b: 1, a: { d: [1, 2], c: 2 } }, { a: { c: 2, d: [1, 2] }, b: 1 }));
  assert.ok(!same({ a: [1, 2] }, { a: [2, 1] }));
});

test("clip names are the kana's code points in hex", () => {
  assert.equal(clipPath("あ"), "audio/3042.mp3");
  assert.equal(clipPath("かっこ"), "audio/304b-3063-3053.mp3");
});

// Two devices with a tie each kept their own copy, so the row was rewritten on every sync [か 2 right 2 wrong beside 3 right 1 wrong, both box 2].
test("a tie in answers and box settles on the same copy whichever side merges first", () => {
  const phone = side({ progress: { か: { box: 2, right: 3, wrong: 1 } } }), pc = side({ progress: { か: { box: 2, right: 2, wrong: 2 } } });
  assert.deepEqual(merge(phone, pc).progress.か, { box: 2, right: 3, wrong: 1 });
  assert.deepEqual(merge(pc, phone).progress.か, { box: 2, right: 3, wrong: 1 });
});

// The writing merge rebuilt the drill from kana, best and resetAt, so a key a later version adds would vanish on an older tab's save.
test("the writing merge carries keys it doesn't know", () => {
  const m = mergeWrite({ kana: {}, best: {}, resetAt: 0, picked: ["a"] }, { kana: {}, best: {}, resetAt: 0 });
  assert.deepEqual(m.picked, ["a"]);
});
