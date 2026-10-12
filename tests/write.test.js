// The writing quiz judges a finger's stroke against KanjiVG's, so it can fail two ways: a fair stroke turned away, or a
// wrong one let through. Before any tolerance was picked, every one of the 451 strokes was drawn against itself shifted,
// scaled and jittered, and against every other stroke of its kana: 12 units off still matched, 16 off matched none, and
// the only strokes taken for one another were the two dakuten ticks, which sit 8 units apart.
const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const { pathPoints, strokeMatches, grade, written } = require("../write.js");
const STROKES = require("../data/strokes.json");

const all = Object.entries(STROKES).flatMap(([c, { d }]) => d.map((p, i) => ({ c, i, pts: pathPoints(p) })));
const move = (pts, dx, dy, k = 1) => pts.map(([x, y]) => [54.5 + (x - 54.5) * k + dx, 54.5 + (y - 54.5) * k + dy]);

test("every KanjiVG stroke is one M and relative curves, the only shape pathPoints reads", () => {
  const odd = Object.entries(STROKES).filter(([, { d }]) => !d.every((p) => /^M[^A-Za-z]+(c[^A-Za-z]+)+$/.test(p)));
  assert.deepEqual(odd.map(([c]) => c), []);
});

// Each sloppiness alone held to 12 units, so together they stay under it [5 off plus 10% small is about 10 at the edge].
test("a stroke drawn a little off, a little small or big, or shaky still counts", () => {
  fc.assert(fc.property(
    fc.integer({ min: 0, max: all.length - 1 }), fc.double({ min: -5, max: 5, noNaN: true }), fc.double({ min: -5, max: 5, noNaN: true }),
    fc.double({ min: 0.9, max: 1.1, noNaN: true }), fc.array(fc.double({ min: -2.5, max: 2.5, noNaN: true }), { minLength: 80, maxLength: 80 }),
    (n, dx, dy, k, shake) => {
      const drawn = move(all[n].pts, dx, dy, k).map(([x, y], j) => [x + shake[j % 80], y + shake[(j + 40) % 80]]);
      return strokeMatches(drawn, all[n].pts);
    },
  ), { numRuns: 2000 });
});

test("a stroke far off its place, drawn backwards, or another of the kana's strokes is refused", () => {
  const circle = (s) => /[ぱぴぷぺぽパピプペポ]/.test(s.c) && s.i === STROKES[s.c].d.length - 1;
  assert.deepEqual(all.filter((s) => strokeMatches(move(s.pts, 0, 16), s.pts)).map((s) => s.c + (s.i + 1)), []);
  // A handakuten ring ends where it starts, so it has no backwards [ぱ's 4th stroke].
  assert.deepEqual(all.filter((s) => !circle(s) && strokeMatches([...s.pts].reverse(), s.pts)).map((s) => s.c + (s.i + 1)), []);
  // The two dakuten ticks may stand in for each other, nothing else may [が's 4th and 5th].
  const dakuten = (c) => c.normalize("NFD").codePointAt(1) === 0x3099;
  const ticks = (c, i, j) => dakuten(c) && Math.min(i, j) >= STROKES[c].d.length - 2;
  const mixed = all.flatMap((s) => all.filter((o) => o.c === s.c && o.i !== s.i && strokeMatches(o.pts, s.pts) && !ticks(s.c, s.i, o.i))
    .map((o) => `${s.c}${o.i + 1} for ${s.i + 1}`));
  assert.deepEqual(mixed, []);
});

test("a whole kana grades stroke by stroke, and a missing or extra stroke is wrong", () => {
  const [one, two, three] = STROKES["あ"].d.map((p) => pathPoints(p));
  assert.deepEqual(grade([one, two, three], [one, two, three]), [true, true, true]);
  assert.deepEqual(grade([two, one, three], [one, two, three]), [false, false, true]);
  assert.deepEqual(grade([one, two], [one, two, three]), [true, true, false]);
  assert.deepEqual(grade([[[50, 50]]], [one]), [false], "a tap is no stroke");
  assert.equal(written([one, two, three], [one, two, three]), true);
  assert.equal(written([one, two, three, three], [one, two, three]), false, "an extra stroke");
  assert.equal(written([one, two], [one, two, three]), false, "a missing stroke");
});
