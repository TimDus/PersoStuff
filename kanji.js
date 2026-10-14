// Kanji rules, pure so node can test them: which met words share a word's kanji, and the kanji deck's order [学生's 学 is also in 大学 and 学校].
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

  // Each kanji of the met words with the day its first word was met, oldest first, then by first place in the list [大学 met day 10 = 学, 大].
  function unlocks(words, cards) {
    const day = new Map(), place = new Map();
    for (const w of words) {
      const first = cards[`${w.k}#r`]?.first;
      for (const c of kanjiOf(w)) {
        if (!place.has(c)) place.set(c, place.size);
        if (first !== undefined && !(day.get(c) <= first)) day.set(c, first);
      }
    }
    return [...day].map(([c, d]) => ({ c, day: d })).sort((a, b) => a.day - b.day || place.get(a.c) - place.get(b.c));
  }
  // Today's kanji: due reviews most overdue first, learning ones, then unlocked ones without a card up to newPerDay less today's [3 met this morning of 10 = 7 more].
  function kanjiQueue({ unlocked, cards, today, newPerDay }) {
    const all = Object.entries(cards);
    const due = all.filter(([, k]) => k.st === "review" && k.due <= today).sort((a, b) => a[1].due - b[1].due);
    const learning = all.filter(([, k]) => k.st !== "review" && k.due <= today);
    const intros = all.filter(([, k]) => k.first === today).length;
    const fresh = unlocked.filter(({ c }) => !cards[c]).slice(0, Math.max(0, newPerDay - intros));
    return [...due, ...learning].map(([c]) => c).concat(fresh.map(({ c }) => c));
  }
  // A kanji card on a three-week interval, Anki's mature [ivl 21 yes, 20 not yet].
  const mature = (card) => card?.ivl >= 21;
  // A word reads as known once every kanji in it is mature [学生 with 学 at 21 days and 生 at 20: not yet].
  const learned = (word, kcards) => kanjiOf(word).length > 0 && kanjiOf(word).every((c) => mature(kcards[c]));

  const api = { kanjiOf, wordsWith, note, unlocks, kanjiQueue, mature, learned };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraKanji = api;
})(this);
