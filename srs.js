// Vocabulary scheduling after Anki's SM-2, pure so node can test it [a new word on Good is due tomorrow, on Easy in four days].
(function (root) {
  const { mergeWrite } = typeof module !== "undefined" ? require("./sync.js") : root.HiraSync;
  const DAY = 86400e3;
  // Days since the epoch in local time, starting at 4 am so a late-night session counts as the same day [03:59 is still yesterday].
  const dayOf = (ms, tzOffsetMin = new Date(ms).getTimezoneOffset()) => Math.floor((ms - tzOffsetMin * 60e3 - 4 * 3600e3) / DAY);

  const MAX_IVL = 36500;
  const round2 = (x) => Math.round(x * 100) / 100;
  // Anki's fuzz, so cards met together drift apart over the days [10 days lands on 8 to 12; under 3 stays as it is].
  const FUZZ = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]];
  function fuzz(ivl, r) {
    if (r == null || ivl < 2.5) return ivl;
    const d = FUZZ.reduce((sum, [from, to, f]) => sum + f * Math.max(0, Math.min(ivl, to) - from), 1);
    const lo = Math.max(2, Math.round(ivl - d)), hi = Math.round(ivl + d);
    return lo + Math.floor(r * (hi - lo + 1));
  }
  // A number in [0, 1) fixed by a card's key and answer count, so a button shows what pressing it gives [会う|あう#r on its 3rd answer, every time].
  const seed = (key, n) => {
    let h = 2166136261;
    for (const ch of `${key}/${n}`) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
    return (h >>> 0) / 2 ** 32;
  };
  // One answer on a card [g: 1 Again, 2 Hard, 3 Good, 4 Easy]; `again` keeps it in today's session [a new card on Again comes back in a few cards].
  // A `key` fuzzes the interval, none keeps it exact [会う|あう#r on Good at 10 days: 22 to 28; without: 25].
  function grade(card, g, today, key) {
    const c = { st: "learn", ivl: 0, ease: 2.5, due: today, n: 0, lapses: 0, first: today, ...card };
    c.n++;
    c.last = today;
    const r = key == null ? null : seed(key, c.n);
    if (c.st === "review") {
      const late = Math.max(0, today - c.due);
      if (g === 1) return { card: { ...c, st: "relearn", lapses: c.lapses + 1, ease: Math.max(1.3, round2(c.ease - 0.2)), ivl: 1, due: today }, again: true };
      // Hard ignores the delay, as current Anki does [10 days, 8 late: 12, where Anki's old rule gave 14].
      const hard = Math.max(c.ivl + 1, fuzz(Math.round(c.ivl * 1.2), r));
      const good = Math.max(hard + 1, fuzz(Math.round((c.ivl + late / 2) * c.ease), r));
      const easy = Math.max(good + 1, fuzz(Math.round((c.ivl + late) * c.ease * 1.3), r));
      const ivl = Math.min(MAX_IVL, [hard, good, easy][g - 2]);
      const ease = g === 2 ? Math.max(1.3, round2(c.ease - 0.15)) : g === 4 ? round2(c.ease + 0.15) : c.ease;
      return { card: { ...c, ivl, ease, due: today + ivl }, again: false };
    }
    // Learning and relearning: Again and Hard repeat it today, Good and Easy send it out [new: 1 and 4 days; a lapse: 1 and 2].
    if (g <= 2) return { card: { ...c, due: today }, again: true };
    const ivl = fuzz(c.st === "relearn" ? (g === 3 ? c.ivl : c.ivl + 1) : g === 3 ? 1 : 4, r);
    return { card: { ...c, st: "review", ivl, due: today + ivl }, again: false };
  }

  // What each button would give, in days [a fresh card: Again 0, Hard 0, Good 1, Easy 4].
  const preview = (card, today, key) => [1, 2, 3, 4].map((g) => {
    const r = grade(card, g, today, key);
    return r.again ? 0 : r.card.ivl;
  });

  // Cards of one word or one spelling, both sides and every reading [会う#r and 会う#p; 外 read そと and 外 read ほか].
  const kin = (a, b) => a.key !== b.key && !!a.word && !!b.word && (a.word.k === b.word.k || (!!a.word.w && a.word.w === b.word.w));
  const GAP = 10;
  // Where `it` goes in `list`, `shown` being the cards just before it: at `from` or the first spot after it with GAP others between it and any kin,
  // then before `from` where `before` allows, else the spot within `reach` of `from` farthest from its nearest kin [会う#p 2 cards after 会う#r: 11 on, or last in a short run;
  // an Again with reach 10 whose other side is 11th of the 20 left comes back 4th, not last].
  function place(list, it, from, { shown = [], before = false, reach = Infinity } = {}) {
    from = Math.min(from, list.length);
    const near = (p) => {
      let d = Infinity;
      shown.forEach((x, i) => { if (kin(x, it)) d = Math.min(d, shown.length - i + p); });
      list.forEach((x, q) => { if (kin(x, it)) d = Math.min(d, q < p ? p - q : q + 1 - p); });
      return d;
    };
    const spots = [];
    for (let p = from; p <= list.length; p++) spots.push(p);
    if (before) for (let p = from - 1; p >= 0; p--) spots.push(p);
    let best = spots[0];
    for (const p of spots) {
      if (near(p) > GAP) return p;
      if (Math.abs(p - from) <= reach && near(p) > near(best)) best = p;
    }
    return best;
  }
  // Cards in one shuffled run, each group of kin at least `need` apart, a `late` card after its kin [60 cards: 会う#r and 会う#p 20 or more apart; 3 cards: first and last].
  function mix(items, { rand = Math.random, late = new Set() } = {}) {
    const n = items.length, pick = (xs) => xs[Math.floor(rand() * xs.length)];
    const groups = [];
    for (const it of items) {
      const own = groups.filter((g) => g.some((x) => kin(x, it)));
      groups.push([...own.flat(), it]);
      for (const g of own) groups.splice(groups.indexOf(g), 1);
    }
    const shuffle = (xs) => xs.map((it) => [rand(), it]).sort((a, b) => a[0] - b[0]).map(([, it]) => it);
    const need = (m) => Math.min(Math.max(GAP + 1, Math.ceil(n / (m + 1))), Math.floor((n - 1) / (m - 1)));
    // A random free slot for each card of a group, all `need` apart; null when the run has painted itself in [20 pairs in 40 cards].
    const tryLayout = () => {
      const slots = Array(n).fill(null);
      for (const g of groups.filter((g) => g.length > 1).sort((a, b) => b.length - a.length)) {
        const at = [];
        for (let j = 0; j < g.length; j++) {
          const free = slots.map((x, p) => p).filter((p) => !slots[p] && !at.includes(p) && at.every((q) => Math.abs(p - q) >= need(g.length)));
          if (!free.length) return null;
          at.push(pick(free));
        }
        at.sort((a, b) => a - b).forEach((p, j) => { slots[p] = g[j]; });
      }
      return slots;
    };
    // Evenly spaced when random slots don't fit, which always fits pairs [40 cards: slots s and s + 20].
    const evenLayout = () => {
      const slots = Array(n).fill(null);
      for (const g of groups.filter((g) => g.length > 1).sort((a, b) => b.length - a.length)) {
        const at = (s) => g.map((x, j) => s + Math.round((j * n) / g.length));
        const starts = slots.map((x, s) => s).filter((s) => at(s).every((p) => p < n && !slots[p]));
        const ps = starts.length ? at(pick(starts)) : [];
        if (!starts.length) for (const x of g) {
          const gapTo = (p) => Math.min(Infinity, ...ps.map((q) => Math.abs(p - q)));
          const free = slots.map((x, p) => p).filter((p) => !slots[p] && !ps.includes(p));
          ps.push(free.reduce((best, p) => (gapTo(p) > gapTo(best) ? p : best)));
        }
        ps.sort((a, b) => a - b).forEach((p, j) => { slots[p] = g[j]; });
      }
      return slots;
    };
    groups.forEach((g, i) => { groups[i] = shuffle(g).sort((a, b) => late.has(a) - late.has(b)); });
    let slots = null;
    for (let t = 0; t < 20 && !slots; t++) slots = tryLayout();
    slots = slots || evenLayout();
    const singles = shuffle(groups.filter((g) => g.length === 1).flat());
    return slots.map((x) => x || singles.shift());
  }

  // Today's cards in one `mix`: due reviews whatever their day, learning cards a closed tab left behind, and new ones, a new English side after its Japanese side.
  // New: the English side of words whose Japanese side was first seen before today, and the next words in deck order,
  // each kind up to newPerDay less what today already introduced [15 met this morning = 5 more tonight]; a word meets `ready` to be new [学生 once 学 and 生 have kanji cards], and a word that `waits` sits today out [秋 once its kanji card is answered today].
  function queue({ words, cards, today, newPerDay, rand = Math.random, ready = () => true, waits = () => false }) {
    const item = (word, dir) => ({ key: `${word.k}#${dir}`, word, dir });
    const due = [], learning = [], prod = [], rec = [];
    let recToday = 0, prodToday = 0;
    for (const word of words) {
      if (waits(word)) continue;
      const r = cards[`${word.k}#r`], p = cards[`${word.k}#p`];
      for (const [c, dir] of [[r, "r"], [p, "p"]]) {
        if (!c) continue;
        if (c.first === today) dir === "r" ? recToday++ : prodToday++;
        if (c.st === "review" && c.due <= today) due.push(item(word, dir));
        else if (c.st !== "review" && c.due <= today) learning.push(item(word, dir));
      }
      if (!r) { if (ready(word)) rec.push(item(word, "r")); }
      else if (!p && r.first < today) prod.push(item(word, "p"));
    }
    const fresh = prod.slice(0, Math.max(0, newPerDay - prodToday));
    return mix([...due, ...learning, ...fresh, ...rec.slice(0, Math.max(0, newPerDay - recToday))], { rand, late: new Set(fresh) });
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
  const DRILLS = ["write", "verbs", "particles", "grammar", "listening"];
  // Cards by `wins` over sides oldest first [a card on one side only is kept].
  const mergeCards = (sides) => {
    const cards = {};
    for (const s of sides) {
      for (const [key, c] of Object.entries(s.cards || {})) if (!cards[key] || wins(c, cards[key])) cards[key] = c;
    }
    return cards;
  };
  // The settings changed last [newPerDay 10 at 9 beats 20 at 5].
  const latest = (sides, fallback) => sides.map((s) => s.settings).filter(Boolean).sort((x, y) => (y.at || 0) - (x.at || 0))[0] || fallback;
  // Two devices' decks into one: word and kanji cards by `wins`, settings from the later change, writing and the drills by `mergeWrite`, any other key whole
  // from the newer side so a later section's data outlives a tab that predates it [a shadowing key written by the next version].
  function mergeStudy(a, b) {
    const sides = [a, b].filter((s) => s && typeof s === "object").sort((x, y) => (x.savedAt || 0) - (y.savedAt || 0));
    const out = Object.assign({}, ...sides);
    // Every drill keeps the same shape as writing [best keyed by selection and count: masu|verb|20, 20, tai,tekudasai|10; kana stays {}].
    const drills = Object.fromEntries(DRILLS.map((name) => [name, mergeWrite(a?.[name], b?.[name])]).filter(([, d]) => d));
    const ks = sides.map((s) => s.kanji).filter((k) => k && typeof k === "object");
    const kanji = ks.length ? { kanji: { ...Object.assign({}, ...ks), cards: mergeCards(ks), settings: latest(ks, { newPerDay: 10, at: 0 }) } } : {};
    return { ...out, cards: mergeCards(sides), settings: latest(sides, { newPerDay: 20, at: 0 }), ...drills, ...kanji, savedAt: Math.max(0, ...sides.map((s) => s.savedAt || 0)) };
  }

  const api = { dayOf, grade, preview, queue, place, mix, GAP, mergeStudy, DRILLS };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraSRS = api;
})(this);
