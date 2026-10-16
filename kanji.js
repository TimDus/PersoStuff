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

  // A kanji's parts that are deck kanji, a radical form as its full kanji [海 = 水 毎; 学's ⺍ and 冖 aren't kanji, so 子].
  const partsOf = (c, info) => [...new Set((info[c]?.c || []).map((p) => info[c].v?.[p] || p))].filter((p) => p !== c && info[p]);
  // The deck in study order: Heisig's frames, stroke count where a kanji has none, each kanji's parts pulled in front of it
  // [会 814 holds 人 1023, so 人 goes first; without Koohii's file 一 and 乙 lead on 1 stroke].
  function order(info, frames) {
    const rank = (c) => [frames[c] ?? Infinity, info[c].sc || 99, c.codePointAt(0)];
    const by = (a, b) => { const [x, y] = [rank(a), rank(b)]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
    const out = [], placed = new Set();
    const place = (c) => {
      if (placed.has(c)) return;
      placed.add(c);
      partsOf(c, info).sort(by).forEach(place);
      out.push(c);
    };
    Object.keys(info).sort(by).forEach(place);
    return out;
  }
  // The radical forms of a kanji, with the kanji using each [水: 氵 in 海 池 泳…; 大 has none].
  function forms(c, info) {
    const by = new Map();
    for (const [d, x] of Object.entries(info)) for (const [f, full] of Object.entries(x.v || {})) if (full === c) by.set(f, [...(by.get(f) || []), d]);
    return [...by].map(([f, cs]) => ({ f, cs }));
  }
  // Today's kanji: due reviews most overdue first and shuffled within a day, learning ones, then the next in order without a card up to newPerDay less today's [3 started this morning of 10 = 7 more].
  function kanjiQueue({ order: seq, cards, today, newPerDay, rand = Math.random }) {
    const all = Object.entries(cards);
    const due = all.filter(([, k]) => k.st === "review" && k.due <= today).map((e) => [...e, rand()]).sort((a, b) => a[1].due - b[1].due || a[2] - b[2]);
    const learning = all.filter(([, k]) => k.st !== "review" && k.due <= today);
    const intros = all.filter(([, k]) => k.first === today).length;
    const fresh = seq.filter((c) => !cards[c]).slice(0, Math.max(0, newPerDay - intros));
    return [...due, ...learning].map(([c]) => c).concat(fresh);
  }
  // A kanji card on a three-week interval, Anki's mature [ivl 21 yes, 20 not yet].
  const mature = (card) => card?.ivl >= 21;
  // A word can be new once each of its kanji has a card [学生 with only 学 started waits; これ never does].
  const ready = (word, kcards) => kanjiOf(word).every((c) => kcards[c]);
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
  // A kanji's main reading and the rest, each with up to 3 list words using it, met ones first and newest first [学: ガク 大学 科学 医学, then まな.ぶ with none].
  function byReading(c, words, cards, info) {
    const all = wordsWith(c, words, cards).map((w) => [w, readingIn(c, w, info)]);
    const rows = [...(info[c]?.on || []), ...(info[c]?.kun || [])].map((r) => ({
      r, words: all.filter(([, x]) => x === r).slice(0, 3).map(([w]) => ({ w, met: !!cards[`${w.k}#r`] })),
    }));
    return { top: rows.find((x) => x.r === info[c]?.top) || null, rest: rows.filter((x) => x.r !== info[c]?.top) };
  }
  // Only the readings met words use, with only those words, the first in kanji.json's order large when the main one isn't met [四 read よん met: よん, no シ].
  function metReadings(c, words, cards, info) {
    const { top, rest } = byReading(c, words, cards, info);
    const met = [top, ...rest].filter(Boolean).map((x) => ({ ...x, words: x.words.filter((w) => w.met) })).filter((x) => x.words.length);
    return { top: met[0] || null, rest: met.slice(1) };
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

  const api = { kanjiOf, wordsWith, note, partsOf, order, forms, kanjiQueue, mature, ready, learned, readingIn, byReading, metReadings, family };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraKanji = api;
})(this);
