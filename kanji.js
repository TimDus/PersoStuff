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
  // Today's kanji: due reviews most overdue first and shuffled within a day, learning ones, then unlocked ones without a card up to newPerDay less today's [3 met this morning of 10 = 7 more].
  function kanjiQueue({ unlocked, cards, today, newPerDay, rand = Math.random }) {
    const all = Object.entries(cards);
    const due = all.filter(([, k]) => k.st === "review" && k.due <= today).map((e) => [...e, rand()]).sort((a, b) => a[1].due - b[1].due || a[2] - b[2]);
    const learning = all.filter(([, k]) => k.st !== "review" && k.due <= today);
    const intros = all.filter(([, k]) => k.first === today).length;
    const fresh = unlocked.filter(({ c }) => !cards[c]).slice(0, Math.max(0, newPerDay - intros));
    return [...due, ...learning].map(([c]) => c).concat(fresh.map(({ c }) => c));
  }
  // A kanji card on a three-week interval, Anki's mature [ivl 21 yes, 20 not yet].
  const mature = (card) => card?.ivl >= 21;
  // A word reads as known once every kanji in it is mature [学生 with 学 at 21 days and 生 at 20: not yet].
  const learned = (word, kcards) => kanjiOf(word).length > 0 && kanjiOf(word).every((c) => mature(kcards[c]));

  const hira = (s) => s.replace(/[ァ-ヶ]/g, (k) => String.fromCharCode(k.charCodeAt(0) - 0x60));
  const VOICED = { か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご", さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ", た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど", は: "ばぱ", ひ: "びぴ", ふ: "ぶぷ", へ: "べぺ", ほ: "ぼぽ" };
  // The shapes a reading takes inside a word: as written, voiced, then cut short by a small っ [がく; かみ, がみ; がっ].
  function shapes(s) {
    const voiced = [...(VOICED[s[0]] || "")].map((v) => v + s.slice(1));
    return [[s], voiced, [s, ...voiced].filter((f) => f.length > 1 && "くつちき".includes(f.at(-1))).map((f) => f.slice(0, -1) + "っ")];
  }
  // A kanji's readings as furigana, a kun by its stem, every one as written before any voiced or cut one, a kun with okurigana first when kana follow a lone kanji [神社 = ジン, not シン voiced; 死ぬ = し.ぬ, not シ].
  function tries(c, info, okuri) {
    const all = [...(info[c]?.on || []), ...(info[c]?.kun || [])];
    const rs = okuri ? [...all.filter((r) => r.includes(".")), ...all.filter((r) => !r.includes("."))] : all;
    return [0, 1, 2].flatMap((t) => rs.flatMap((r) => shapes(hira(r.split(".")[0]))[t].map((f) => [r, f])));
  }
  // The reading a kanji has in a word, giving each kanji of its furigana run one reading and 々 the one before it, null for a whole-word reading [学校 がっこう = ガク; 時々 = とき; 今日 = null].
  function readingIn(c, word, info) {
    for (const [j, [text, rt]] of word.fu.entries()) {
      const ks = [...text];
      if (!ks.includes(c)) continue;
      const okuri = ks.length === 1 && word.fu[j + 1] && !word.fu[j + 1][1];
      const fit = (i, rest) => {
        if (i === ks.length) return rest ? null : [];
        for (const [r, f] of tries(ks[i] === "々" ? ks[i - 1] : ks[i], info, okuri)) {
          const tail = rest.startsWith(f) && fit(i + 1, rest.slice(f.length));
          if (tail) return [r, ...tail];
        }
        return null;
      };
      const got = fit(0, rt);
      if (got) return got[ks.indexOf(c)];
    }
    return null;
  }
  // A kanji's readings with up to 3 met words each, newest first, then the readings no met word uses [学: ガク from 大学, 科学, 医学; まな.ぶ].
  function byReading(c, words, cards, info) {
    const met = wordsWith(c, words, cards).filter((w) => cards[`${w.k}#r`]).map((w) => [w, readingIn(c, w, info)]);
    const rows = [...(info[c]?.on || []), ...(info[c]?.kun || [])].map((r) => ({ r, words: met.filter(([, x]) => x === r).slice(0, 3).map(([w]) => w) }));
    return { used: rows.filter((x) => x.words.length), rest: rows.filter((x) => !x.words.length).map((x) => x.r) };
  }
  // The list's kanji sharing a sound part with c, being its part or having c as theirs, grouped by the on'yomi they still share [晴: セイ 青 静; 青: セイ 晴 静; 活 and 話 share 舌, not a reading].
  function family(c, info) {
    const mine = info[c]?.p || [], on = info[c]?.on || [], groups = new Map();
    for (const [d, x] of Object.entries(info)) {
      const kin = d !== c && (mine.includes(d) || (x.p || []).some((p) => p === c || mine.includes(p)));
      const r = kin ? on.filter((o) => x.on?.includes(o)) : [];
      if (r.length) groups.set(r.join(" "), { r, cs: [...(groups.get(r.join(" "))?.cs || []), d] });
    }
    return [...groups.values()];
  }

  const api = { kanjiOf, wordsWith, note, unlocks, kanjiQueue, mature, learned, readingIn, byReading, family };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraKanji = api;
})(this);
