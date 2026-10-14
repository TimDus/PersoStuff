// Kanji rules, pure so node can test them: which met words share a word's kanji [学生's 学 is also in 大学 and 学校].
(function (root) {
  const KANJI = /[一-鿿]/;
  // A word's distinct kanji in reading order, 々 left out as it repeats the one before [時々 = 時].
  const kanjiOf = (w) => [...new Set([...w.w].filter((c) => KANJI.test(c)))];

  // Every word with the kanji, the met ones first and most recently met first, then the rest in list order [学: 科学 met day 13, 学校 11, then 学生, 大学…].
  function wordsWith(c, words, cards) {
    const first = (w) => cards[`${w.k}#r`]?.first;
    const all = words.filter((w) => w.w.includes(c));
    return [...all.filter((w) => first(w) !== undefined).sort((a, b) => first(b) - first(a)), ...all.filter((w) => first(w) === undefined)];
  }
  // One line per kanji: up to 3 other met words with it, a word spelled like the card's own left out [明日 read あす on the card for あした].
  const note = (word, words, cards) => kanjiOf(word).map((c) => ({
    c, also: wordsWith(c, words, cards).filter((w) => w.w !== word.w && cards[`${w.k}#r`]).slice(0, 3),
  }));

  const api = { kanjiOf, wordsWith, note };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraKanji = api;
})(this);
