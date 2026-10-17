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

// near held particles no English allows, so the classic slip was never offered [図書館に勉強します], while へ, fine for 友だち＿あげました, could be drawn as wrong.
test("the classic wrong particle can be offered, and one the English also allows never is", () => {
  const by = (en) => SENTENCES.find((c) => c.en === en);
  const wrong = (c) => CHOICES.filter((p) => !c.ok.includes(p) && !c.near.includes(p));
  assert.ok(wrong(by("I study at the library.")).includes("に"));
  assert.ok(wrong(by("I had dinner at a restaurant.")).includes("に"));
  assert.ok(wrong(by("I get on the train.")).includes("で"));
  assert.ok(wrong(by("I go into the room.")).includes("で"));
  for (const en of ["I gave a present to a friend.", "I phoned my mother."]) assert.ok(!wrong(by(en)).includes("へ"), en);
  assert.ok(!wrong(by("Japanese cars are good.")).includes("と"));
  assert.ok(!wrong(by("I walk as far as the station.")).includes("を"));
});
