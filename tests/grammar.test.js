// A grammar card hides which pattern it drills, so the English has to decide it and the typed answer has to be the one
// the sentence holds. A hand-copied answer that drifted from its hint word [話す shown, 言ってください in the gap] or a
// kanji left without a reading would mark a right learner wrong, and nothing on screen would say why.
const test = require("node:test");
const assert = require("node:assert/strict");
const { conjugate } = require("../conj.js");
const { CHOICES, SENTENCES: PARTICLE_SENTENCES } = require("../particles.js");
const { VARIANTS } = require("../tools/grammar-points.js");
const { points, sentences } = require("../data/grammar.json");
const vocab = new Map(require("../data/vocab.json").map((w) => [w.k, w]));

const GROUPS = ["Particles and です", "ます stem", "て form", "ない form", "た form", "Dictionary form", "Adjectives and stems", "Sentence patterns"];
const text = (fu) => fu.map(([t]) => t).join("");

test("the 40 N5 points come grouped by what they attach to, each drilled by its own sentences or by Particles", () => {
  assert.equal(points.length, 40);
  assert.equal(new Set(points.map((p) => p.id)).size, 40);
  assert.deepEqual([...new Set(points.map((p) => p.group))], GROUPS);
  for (const p of points) {
    assert.ok(p.title && p.explain && p.attach, p.id);
    if (p.particles) {
      assert.ok(p.particles.every((x) => CHOICES.includes(x)), p.id);
      // A particle drill names its point by its particles, so the title has to be them [に／へ].
      assert.equal(p.particles.join("／"), p.title, p.id);
      assert.ok(PARTICLE_SENTENCES.filter((c) => c.ok.some((x) => p.particles.includes(x))).length >= 5, p.id);
      assert.equal(sentences.filter((s) => s.p === p.id).length, 0, p.id);
    } else assert.ok(sentences.filter((s) => s.p === p.id).length >= 8, `${p.id} has ${sentences.filter((s) => s.p === p.id).length}`);
  }
});

test("every sentence has one gap, a reading over each kanji with its level, and English no other sentence shares", () => {
  const ids = new Set(points.map((p) => p.id));
  for (const s of sentences) {
    assert.ok(ids.has(s.p), s.p);
    assert.equal(s.fu.filter((x) => x === null).length, 1, text(s.fu.filter(Boolean)));
    for (const run of [...s.fu.filter(Boolean), ...s.gap.fu]) {
      if (/[一-鿿々]/.test(run[0])) assert.ok(run[1] && Number.isInteger(run[2]), `${run[0]} in ${s.en}`);
      else assert.equal(run.length, 1, `${run[0]} in ${s.en}`);
    }
    assert.equal(s.gap.w, text(s.gap.fu));
    assert.ok(s.gap.r && !/[一-鿿々]/.test(s.gap.r), s.en);
    assert.ok(s.en && s.ok.every((o) => o.w && o.r), s.en);
  }
  assert.equal(new Set(sentences.map((s) => s.en)).size, sentences.length);
  assert.equal(new Set(sentences.map((s) => text(s.fu.map((x) => x || [s.gap.w])))).size, sentences.length);
});

test("a gap on a word is that word in its point's pattern [話す + ～てください = 話してください]", () => {
  let checked = 0;
  for (const s of sentences.filter((x) => x.hint)) {
    const word = vocab.get(s.hint.k);
    assert.ok(word, s.hint.k);
    const forms = VARIANTS[s.p];
    assert.ok(forms, `${s.p} has a hint but no variants`);
    const made = forms((form) => conjugate(word, form), word);
    assert.ok(made.some((m) => m.r === s.gap.r && [m.w, m.r].includes(s.gap.w)), `${s.gap.w} (${s.gap.r}) is not ${s.p} of ${word.w}: ${made.map((m) => m.w).join(", ")}`);
    checked++;
  }
  assert.ok(checked > 150, `only ${checked} sentences checked`);
});

test("an accepted answer keeps the gap's tense and polarity [拾ったの takes 拾ったん, never 拾わないん]", () => {
  const ENDS = { ndesu: /(なん|なの|ん|の)$/, node: /(なので|だから|ので|から)$/, deshou: /(でしょう|だろう)$/ };
  let checked = 0;
  for (const s of sentences.filter((x) => ENDS[x.p])) {
    const stem = (a) => a.r.replace(ENDS[s.p], "");
    // Only the ones built from the pattern; a listed answer in another pattern is the hand check's call [来ます for 来るでしょう].
    for (const o of s.ok.filter((x) => ENDS[s.p].test(x.r))) {
      assert.equal(stem(o), stem(s.gap), `${o.w} for ${s.gap.w} [${s.en}]`);
      checked++;
    }
  }
  assert.ok(checked > 20, `only ${checked} answers checked`);
});

test("a plain answer stands in for a polite one only at the end of a sentence or before ね and よ [がいますか never takes がいる; エアコン＿よ takes がある]", () => {
  const PLAIN = { desu: /^だ$/, "ga-arimasu": /が(ある|ない|あった)$/, "ga-imasu": /が(いる|いない|いた)$/, teiru: /(いる|いた)$/ };
  let checked = 0;
  for (const s of sentences.filter((x) => PLAIN[x.p])) {
    const after = s.fu.slice(s.fu.indexOf(null) + 1).map(([t]) => t).join("");
    if (/^(よね|ね|よ)?[。！？!?」]*$/.test(after)) continue;
    assert.ok(!s.ok.some((o) => PLAIN[s.p].test(o.r)), `${s.gap.w} + ${after} takes ${s.ok.map((o) => o.w)}`);
    checked++;
  }
  assert.ok(checked >= 5, `only ${checked} sentences checked`);
  const takes = (src) => sentences.find((s) => s.src === src).ok.map((o) => o.w);
  assert.ok(takes(220032).includes("がある"), "この部屋にはエアコン＿よ");
  assert.ok(takes(177571).includes("洗っていない"), "君はまだ手を＿ね");
});

// うまい is an い-adjective, yet the のが上手 cards took 歌うのがうまいだ and 話すのがうまいではありません.
test("an い-adjective answer never comes before だ, である or では", () => {
  const before = sentences.filter((s) => /^(だ|である|では|じゃ)/.test(s.fu.slice(s.fu.indexOf(null) + 1).map(([t]) => t).join("")));
  assert.ok(before.length >= 8);
  for (const s of before) assert.ok(!s.ok.some((o) => /(うまい|上手い)$/.test(o.w)), `#${s.id} takes ${s.ok.map((o) => o.w)}`);
  const desu = sentences.find((s) => s.p === "noga-jouzu" && s.fu[s.fu.indexOf(null) + 1]?.[0].startsWith("です"));
  assert.ok(desu.ok.some((o) => /うまい$/.test(o.w)), "still taken before です");
});

// より and よりも say the same, but every より card refused よりも [あちらよりも値段が高い].
test("よりも counts wherever より does, unless も already follows the gap", () => {
  for (const s of sentences.filter((x) => x.p === "nohouga-yori")) {
    const also = s.fu[s.fu.indexOf(null) + 1]?.[0].startsWith("も");
    assert.equal(s.ok.some((o) => o.w === "よりも"), !also, `#${s.id} ${text(s.fu.filter(Boolean))}`);
  }
});

// The page teaches the casual ちゃいけない and じゃいけない, and the cards refused them.
test("a てはいけません card takes the casual ちゃ and じゃ", () => {
  const { accepts } = require("../conj.js");
  const cards = sentences.filter((s) => s.p === "tewaikemasen");
  const casual = (s) => [s.gap, ...s.ok].some((a) => accepts(a, a.r.replace(/ては/, "ちゃ").replace(/では/, "じゃ")));
  assert.ok(cards.length >= 10);
  for (const s of cards) assert.ok(casual(s), `#${s.id} ${s.gap.w}`);
});

test("a listed answer carries its readings, so it fills the gap like the sentence's own [行きましょうか over いきましょうか]", () => {
  let checked = 0;
  for (const s of sentences) {
    for (const o of s.ok.filter((x) => /[一-鿿々]/.test(x.w))) {
      assert.ok(Array.isArray(o.fu), `${o.w} in ${s.en}`);
      assert.equal(text(o.fu), o.w);
      assert.equal(o.fu.map(([t, rt]) => rt || t).join(""), o.r, `${o.w} reads ${o.r}`);
      checked++;
    }
  }
  assert.ok(checked > 100, `only ${checked} answers checked`);
});

test("a word usually written in kana is hinted in kana [かける, not 掛ける]", () => {
  const uk = sentences.filter((s) => s.hint && vocab.get(s.hint.k).uk);
  assert.ok(uk.length, "no usually-kana hint word");
  for (const s of uk) assert.equal(text(s.hint.fu), vocab.get(s.hint.k).r, s.en);
});

test("a point's own drill never asks the same answer every time [です drills with あります and います]", () => {
  const ids = new Set(points.map((p) => p.id));
  for (const p of points.filter((x) => !x.particles)) {
    for (const id of p.with || []) assert.ok(ids.has(id) && !points.find((x) => x.id === id).particles, `${p.id} with ${id}`);
    const answers = new Set(sentences.filter((s) => [p.id, ...(p.with || [])].includes(s.p)).map((s) => s.gap.r));
    assert.ok(answers.size > 1, `${p.id} only ever asks ${[...answers]}`);
  }
});
