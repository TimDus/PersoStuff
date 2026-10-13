// A gap card is only fair with one right choice on screen. KanjiMemorize's particle deck offered から as wrong for
// 九時＿始まります and に for アメリカ＿来ました, both good Japanese, so a learner was marked down for being right. These
// check the sentences' own lists and that the choices never cross them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const { CHOICES, SENTENCES, options, pieces } = require("../particles.js");

test("every sentence has one gap, readings over all its kanji, and lists only real particles, none both right and near", () => {
  for (const c of SENTENCES) {
    const parts = pieces(c.s);
    assert.equal(parts.filter((p) => p.gap).length, 1, c.s);
    assert.equal(parts.map((p) => (p.gap ? "＿" : p.kanji ? `{${p.kanji}|${p.rt}}` : p.text)).join(""), c.s);
    assert.deepEqual(parts.filter((p) => p.text && /[一-鿿々]/.test(p.text)).map((p) => p.text), [], c.s);
    assert.ok(c.ok.length && [...c.ok, ...c.near].every((p) => CHOICES.includes(p)), c.s);
    assert.deepEqual(c.ok.filter((p) => c.near.includes(p)), [], c.s);
  }
  assert.equal(new Set(SENTENCES.map((c) => c.s)).size, SENTENCES.length);
  assert.equal(new Set(SENTENCES.map((c) => c.en)).size, SENTENCES.length);
});

test("a card offers four different particles, exactly one right and none that fits another reading [バス＿行きます never offers が]", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: SENTENCES.length - 1 }), fc.infiniteStream(fc.double({ min: 0, max: 0.9999, noNaN: true })), (i, stream) => {
    const c = SENTENCES[i], rand = () => stream.next().value;
    const o = options(c, rand);
    assert.equal(new Set(o).size, 4);
    assert.equal(o.filter((p) => c.ok.includes(p)).length, 1);
    assert.deepEqual(o.filter((p) => c.near.includes(p) || !CHOICES.includes(p)), []);
  }));
  const bus = SENTENCES.find((c) => c.en === "I go by bus.");
  for (let n = 0; n < 200; n++) assert.ok(!options(bus).includes("が"));
});
