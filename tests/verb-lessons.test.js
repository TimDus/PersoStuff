// The Verbs lessons teach each form on real words before the drill asks it, so a form no step teaches is asked untaught
// [the tab drilled 15 forms with no lesson at all], and an example the lesson shows has to be the drill's own answer.
const test = require("node:test");
const assert = require("node:assert/strict");
const { STEPS, examples } = require("../verb-lessons.js");
const { FORMS } = require("../conj.js");
const WORDS = require("../data/vocab.json");

test("every form the drill asks is taught by a step on verbs", () => {
  const taught = new Set(STEPS.filter((s) => s.kinds.includes("verb")).flatMap((s) => s.forms));
  assert.deepEqual(FORMS.map((f) => f.id).filter((id) => !taught.has(id)), []);
});

test("a verb step shows a う-verb and a る-verb, met ones first, then する and 来る", () => {
  const met = new Set(["飲む|のむ", "食べる|たべる"]);
  const ex = examples(WORDS, STEPS.find((s) => s.id === "masu"), (k) => met.has(k));
  assert.deepEqual(ex.map((e) => e.word.w), ["飲む", "食べる", "する", "来る"]);
  assert.deepEqual(ex.map((e) => e.group), ["う-verb", "る-verb", "irregular", "irregular"]);
  assert.deepEqual(ex[0].forms.map((f) => f.w), ["飲みます"]);
  assert.deepEqual(ex[3].forms.map((f) => f.r), ["きます"]);
});

test("with no met words a step falls back to the list's first word of each group", () => {
  const ex = examples(WORDS, STEPS.find((s) => s.id === "masu"), () => false);
  assert.deepEqual(ex.map((e) => e.word.k), ["言う|いう", "浴びる|あびる", "する|する", "来る|くる"]);
});

test("an adjective step shows its own kind with each of its forms", () => {
  const ex = examples(WORDS, STEPS.find((s) => s.id === "adj-i"), (k) => k === "高い|たかい");
  assert.deepEqual(ex.map((e) => e.word.w), ["高い"]);
  assert.deepEqual(ex[0].forms.map((f) => f.w), ["高くない", "高かった", "高くなかった", "高くて"]);
});
