// A listening card is only fair when the sound decides it. はな is both 花 flower and 鼻 nose, so offering both marks a
// learner wrong for hearing right; and "to eat" among three nouns is picked by its "to", not by ear. These check the
// choices against the whole word list, and that a round only asks words the learner has met and can hear.
const test = require("node:test");
const assert = require("node:assert/strict");
const fc = require("fast-check");
const WORDS = require("../data/vocab.json");
const { sound, pool, candidates, options } = require("../listen.js");

// A choice as Listening shows it, its descriptor in brackets [召し上がる: to eat or drink (honorific)].
const label = (w) => (w.d ? `${w.m} (${w.d})` : w.m);
const first = require("../sync.js").firstSense;
const byLabel = new Map(WORDS.map((w) => [label(w), w]));
const word = (k) => WORDS.find((w) => w.k === k);
const rands = fc.infiniteStream(fc.double({ min: 0, max: 0.9999, noNaN: true }));
const anyWord = fc.integer({ min: 0, max: WORDS.length - 1 }).map((i) => WORDS[i]);

test("a card offers four different meanings from the list, the word's own among them", () => {
  fc.assert(fc.property(anyWord, rands, (w, s) => {
    const o = options(w, WORDS, () => s.next().value);
    assert.equal(new Set(o).size, 4);
    assert.ok(o.includes(label(w)));
    assert.ok(o.every((m) => byLabel.has(m)));
  }));
});

// 男 and 男の人 both mean "man", so offering both marks a learner wrong for hearing right; every word of a shared first
// sense is checked, as random cards reach a given pair too rarely.
test("no two choices share a first sense, the answer's included [男 heard: never 男の人's man]", () => {
  const groups = new Map();
  for (const w of WORDS) groups.set(first(w.m), [...(groups.get(first(w.m)) || []), w]);
  const grouped = [...groups.values()].filter((ws) => ws.length > 1).flat();
  assert.ok(grouped.length > 800, `${grouped.length} words share a first sense`);
  for (const w of grouped) assert.deepEqual(candidates(w, WORDS).filter((x) => first(x.m) === first(w.m)).map((x) => x.k), [], w.k);
  fc.assert(fc.property(fc.integer({ min: 0, max: grouped.length - 1 }).map((i) => grouped[i]), rands, (w, s) => {
    const senses = options(w, WORDS, () => s.next().value).map((o) => first(byLabel.get(o).m));
    assert.equal(new Set(senses).size, 4, senses.join(" | "));
  }));
});

// 召し上がる was "to eat or drink (honorific)"; with the note moved to its descriptor, "to eat or drink" beside 食べる's
// "to eat" read as right for たべる too.
test("a choice shows its descriptor in brackets after the meaning [召し上がる: to eat or drink (honorific)]", () => {
  const w = word("召し上がる|めしあがる");
  assert.equal(w.m, "to eat or drink");
  assert.ok(options(w, WORDS, () => 0).includes(`to eat or drink (${w.d})`));
  assert.ok(candidates(word("食べる|たべる"), WORDS).some((x) => x.k === w.k));
});

test("a wrong choice never sounds like the word [はな: 鼻 nose never beside 花 flower]", () => {
  assert.equal(sound("はな"), sound(word("鼻|はな").r));
  assert.equal(sound("～だい"), sound("だい"));
  assert.equal(sound("ペン"), sound("ぺん"));
  const shared = WORDS.filter((w) => WORDS.some((x) => x !== w && sound(x.r) === sound(w.r)));
  assert.ok(shared.length >= 98);
  // Every candidate of every same-sounding word, since random picks hit 鼻 among 804 nouns too rarely to notice.
  for (const w of shared) assert.deepEqual(candidates(w, WORDS).filter((x) => sound(x.r) === sound(w.r)).map((x) => x.k), [], w.k);
  fc.assert(fc.property(anyWord, rands, (w, s) => {
    const allowed = new Set(candidates(w, WORDS).map(label));
    assert.ok(options(w, WORDS, () => s.next().value).every((m) => m === label(w) || allowed.has(m)));
  }));
});

// Every candidate rather than random draws: fast-check's doubles lean to 0 and the top, so draws kept to a few list places.
test("the wrong choices are the same kind of word [食べる: verbs; 赤い: adjectives; 花: nouns; 時々: adverbs]", () => {
  const kinds = (k) => new Set(candidates(word(k), WORDS).map((x) => x.t));
  assert.ok([...kinds("食べる|たべる")].every((t) => t.endsWith(" verb")));
  assert.ok([...kinds("赤い|あかい")].every((t) => t.endsWith("adjective")));
  assert.ok([...kinds("花|はな")].every((t) => ["noun", "pronoun", "number"].includes(t)));
  assert.deepEqual([...kinds("時々|ときどき")], ["adverb"]);
});

// 嬉しい's "to be happy" was the only "to" line among adjectives, so it was picked 98% of the time without listening.
test("a wrong choice has the answer's English shape, so the wording never gives it away [嬉しい: only 'to' lines]", () => {
  const shape = (m) => (/^to /.test(m) ? "to" : /^--/.test(m) ? "--" : "plain");
  for (const w of WORDS) {
    const c = candidates(w, WORDS);
    assert.ok(new Set(c.map((x) => first(x.m))).size >= 3, w.k);
    assert.deepEqual(c.filter((x) => shape(x.m) !== shape(w.m)).map((x) => x.k), [], w.k);
  }
  assert.ok(candidates(word("嬉しい|うれしい"), WORDS).some((x) => x.k === "欲しい|ほしい"));
});

// 召し上がる's line was "-- honorific form of 食べる (たべる) …", so hearing たべる and passing it over was marked wrong.
test("a wrong choice never names the word heard [どう never gets なぜ's 'same as どうして']", () => {
  for (const w of WORDS) {
    const named = candidates(w, WORDS).filter((x) => x.m.includes(w.w) || (w.r.length > 1 && x.m.includes(w.r)));
    assert.deepEqual(named.map((x) => x.k), [], w.k);
  }
  assert.ok(!candidates(word("どう|どう"), WORDS).some((x) => x.k === "なぜ|なぜ"));
});

// 伺う was "humble form of 行く, 聞く and 来る" and 参る "humble expression for 行く and 来る", so on 43% of 伺う's cards a line
// just as true of it was the wrong choice; a line that only points at another word can't be told apart by ear.
test("a word that can be asked says what it means, never only which word it stands for [伺う: to visit or ask (humble)]", () => {
  assert.deepEqual(WORDS.filter((w) => w.au && /^--|expression for|form (of|for)/.test(w.m)).map((w) => `${w.k}: ${w.m}`), []);
});

test("a round asks only met words that have a recording [後 read あと has none; 鼻 unmet]", () => {
  const met = new Set(["花|はな", "食べる|たべる", "後|あと"]);
  assert.equal(word("後|あと").au, undefined);
  assert.equal(word("鼻|はな").au, 1);
  assert.deepEqual(pool(WORDS, (k) => met.has(k)).map((w) => w.k).sort(), ["花|はな", "食べる|たべる"].sort());
});
