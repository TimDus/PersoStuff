// A kanji's history is a hand-written note and story in data/history.json, read on the page, the popup and a review card's back.
// The note sits on one line under the parts and the story behind a fold that costs one line on a phone, so both have a length
// the layout was built for [the 38 drift notes ran 26 to 88 characters]. The drift notes once lived in radicals.js; moving
// them here is how 漢 could have lost "the Han river" with every other test still green.
const test = require("node:test");
const assert = require("node:assert/strict");
const kanji = require("../data/kanji.json");
const history = require("../data/history.json");

const entries = Object.entries(history);

test("every history entry is on a deck kanji and has a note of at most 100 characters", () => {
  assert.ok(entries.length >= 100 && entries.length <= 250, `${entries.length} entries`);
  assert.deepEqual(entries.filter(([c]) => !kanji[c]).map(([c]) => c), []);
  assert.deepEqual(entries.filter(([, h]) => typeof h.note !== "string" || !h.note || [...h.note].length > 100).map(([c]) => c), []);
});

test("a story is at most 600 characters", () => {
  assert.deepEqual(entries.filter(([, h]) => h.history !== undefined && (typeof h.history !== "string" || !h.history || [...h.history].length > 600)).map(([c]) => c), []);
});

// The page reads only note and history, so a misspelt key is a story nobody ever sees ["story" for "history"].
test("an entry holds only a note and a story", () => {
  assert.deepEqual(entries.filter(([, h]) => Object.keys(h).some((k) => k !== "note" && k !== "history")).map(([c]) => c), []);
});

// A note filed under the wrong kanji reads as true on that kanji's page [来's wheat under 米].
test("every note names its kanji or one of its parts", () => {
  assert.deepEqual(entries.filter(([c, h]) => !h.note.includes(c) && !(kanji[c].c || []).some((p) => h.note.includes(p))).map(([c]) => c), []);
});

test("every drift note from radicals.js came across", () => {
  assert.deepEqual([..."漢法決治活済準漫泊注洋存何才帰利制為将愛無然点魚鳥馬社英荷員約経練絵終服腹腕"].filter((c) => !history[c]?.note), []);
  assert.match(history["漢"].note, /Han river/);
});
