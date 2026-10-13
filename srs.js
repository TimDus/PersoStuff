// Vocabulary scheduling after Anki's SM-2, pure so node can test it [a new word on Good is due tomorrow, on Easy in four days].
(function (root) {
  const { mergeWrite } = typeof module !== "undefined" ? require("./sync.js") : root.HiraSync;
  const DAY = 86400e3;
  // Days since the epoch in local time, starting at 4 am so a late-night session counts as the same day [03:59 is still yesterday].
  const dayOf = (ms, tzOffsetMin = new Date(ms).getTimezoneOffset()) => Math.floor((ms - tzOffsetMin * 60e3 - 4 * 3600e3) / DAY);

  const MAX_IVL = 36500;
  const round2 = (x) => Math.round(x * 100) / 100;
  // One answer on a card [g: 1 Again, 2 Hard, 3 Good, 4 Easy]; `again` keeps it in today's session [a new card on Again comes back in a few cards].
  function grade(card, g, today) {
    const c = { st: "learn", ivl: 0, ease: 2.5, due: today, n: 0, lapses: 0, first: today, ...card };
    c.n++;
    c.last = today;
    if (c.st === "review") {
      const late = Math.max(0, today - c.due);
      if (g === 1) return { card: { ...c, st: "relearn", lapses: c.lapses + 1, ease: Math.max(1.3, round2(c.ease - 0.2)), ivl: 1, due: today }, again: true };
      // Hard ignores the delay, as current Anki does [10 days, 8 late: 12, where Anki's old rule gave 14].
      const hard = Math.max(c.ivl + 1, Math.round(c.ivl * 1.2));
      const good = Math.max(hard + 1, Math.round((c.ivl + late / 2) * c.ease));
      const easy = Math.max(good + 1, Math.round((c.ivl + late) * c.ease * 1.3));
      const ivl = Math.min(MAX_IVL, [hard, good, easy][g - 2]);
      const ease = g === 2 ? Math.max(1.3, round2(c.ease - 0.15)) : g === 4 ? round2(c.ease + 0.15) : c.ease;
      return { card: { ...c, ivl, ease, due: today + ivl }, again: false };
    }
    // Learning and relearning: Again and Hard repeat it today, Good and Easy send it out [new: 1 and 4 days; a lapse: 1 and 2].
    if (g <= 2) return { card: { ...c, due: today }, again: true };
    const ivl = c.st === "relearn" ? (g === 3 ? c.ivl : c.ivl + 1) : g === 3 ? 1 : 4;
    return { card: { ...c, st: "review", ivl, due: today + ivl }, again: false };
  }

  // What each button would give, in days [a fresh card: Again 0, Hard 0, Good 1, Easy 4].
  const preview = (card, today) => [1, 2, 3, 4].map((g) => {
    const r = grade(card, g, today);
    return r.again ? 0 : r.card.ivl;
  });

  // Today's cards: due reviews most overdue first, learning cards a closed tab left behind, then new ones.
  // New: the English side of words whose Japanese side was first seen before today, and the next words in deck order,
  // each kind up to newPerDay less what today already introduced [15 met this morning = 5 more tonight].
  function queue({ words, cards, today, newPerDay }) {
    const out = [];
    const item = (word, dir) => ({ key: `${word.k}#${dir}`, word, dir });
    const due = [], learning = [], prod = [], rec = [];
    let recToday = 0, prodToday = 0;
    for (const word of words) {
      const r = cards[`${word.k}#r`], p = cards[`${word.k}#p`];
      for (const [c, dir] of [[r, "r"], [p, "p"]]) {
        if (!c) continue;
        if (c.first === today) dir === "r" ? recToday++ : prodToday++;
        if (c.st === "review" && c.due <= today) due.push([c.due, item(word, dir)]);
        else if (c.st !== "review" && c.due <= today) learning.push(item(word, dir));
      }
      if (!r) rec.push(item(word, "r"));
      else if (!p && r.first < today) prod.push(item(word, "p"));
    }
    out.push(...due.sort((a, b) => a[0] - b[0]).map(([, it]) => it), ...learning);
    // A word's two sides on the same day are its new English card and its Japanese review [w0 Monday: r, Tuesday: r then p].
    out.push(...prod.slice(0, Math.max(0, newPerDay - prodToday)), ...rec.slice(0, Math.max(0, newPerDay - recToday)));
    return out;
  }

  // The copy of a card to keep: more answers, then the later day, then a fixed order both devices agree on [n 4 on day 100 each: the lower due].
  const ORDER = ["n", "last", "lapses", "due", "ivl", "ease"];
  const wins = (c, cur) => {
    for (const f of ORDER) if ((c[f] ?? 0) !== (cur[f] ?? 0)) return f === "n" || f === "last" ? (c[f] ?? 0) > (cur[f] ?? 0) : (c[f] ?? 0) < (cur[f] ?? 0);
    // Any other difference is settled by the text of the card, the same answer on every device [a `miss` on one copy only].
    const text = (x) => JSON.stringify(Object.keys(x).sort().map((f) => [f, x[f]]));
    return text(c) > text(cur);
  };
  // The deck keys that hold a drill's progress and bests, merged best by best; study.js makes one store per name [grammar = study.grammar].
  const DRILLS = ["write", "verbs", "particles", "grammar"];
  // Two devices' decks into one: cards by `wins`, settings from the later change, writing and the drills by `mergeWrite`, any other key whole from the newer side
  // so a later section's data outlives a tab that predates it [a kanji key written by the next version].
  function mergeStudy(a, b) {
    const sides = [a, b].filter((s) => s && typeof s === "object").sort((x, y) => (x.savedAt || 0) - (y.savedAt || 0));
    const out = Object.assign({}, ...sides);
    const cards = {};
    for (const s of sides) {
      for (const [key, c] of Object.entries(s.cards || {})) if (!cards[key] || wins(c, cards[key])) cards[key] = c;
    }
    const settings = sides.map((s) => s.settings).filter(Boolean).sort((x, y) => (y.at || 0) - (x.at || 0))[0] || { newPerDay: 20, at: 0 };
    // Every drill keeps the same shape as writing [best keyed by selection and count: masu|verb|20, 20, tai,tekudasai|10; kana stays {}].
    const drills = Object.fromEntries(DRILLS.map((name) => [name, mergeWrite(a?.[name], b?.[name])]).filter(([, d]) => d));
    return { ...out, cards, settings, ...drills, savedAt: Math.max(0, ...sides.map((s) => s.savedAt || 0)) };
  }

  const api = { dayOf, grade, preview, queue, mergeStudy, DRILLS };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraSRS = api;
})(this);
