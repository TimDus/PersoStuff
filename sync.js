// Pure helpers shared by the browser and node: clip names and the progress merge.
(function (root) {
  // Storage key for a kana's clip, ASCII because the bucket rejects kana names [かっこ = audio/304b-3063-3053.mp3].
  const hex = (text) => [...text].map((c) => c.codePointAt(0).toString(16)).join("-");
  const clipPath = (text) => `audio/${hex(text)}.mp3`;
  // Mnemonic illustration, png or jpg, typed at upload so the key needs no extension [か = img/304b].
  const imagePath = (kana) => `img/${hex(kana)}`;

  // A kana's history after one answer, box 0 unseen to 5 mastered [a miss drops any box to 1, a first right lands on 2].
  const bump = (p, ok) => {
    if (ok) { p.right++; p.box = Math.min(5, Math.max(2, p.box + 1)); } else { p.wrong++; p.box = 1; }
    return p;
  };
  const better = (a, b) => (a.acc !== b.acc ? (a.acc > b.acc ? a : b) : a.ms <= b.ms ? a : b);
  const seen = (p) => (p ? p.right + p.wrong : -1);

  // Quiz keys that cover whole categories, the only ones kept a best time [all of hiragana main = kept, a,k,s = dropped].
  const wholeCategories = (groups) => (key) => {
    const gids = key.split("/")[0].split(",").filter(Boolean);
    const cat = new Map(groups.map((g) => [g.id, g]));
    return gids.length > 0 && gids.every((id) => cat.has(id)
      && groups.every((g) => g.script !== cat.get(id).script || g.kind !== cat.get(id).kind || gids.includes(g.id)));
  };

  // More history wins, then the higher box [12 answers at box 2 beats 3 answers at box 4].
  const addProgress = (out, from) => {
    for (const [kana, p] of Object.entries(from || {})) {
      const cur = out[kana];
      if (!cur || seen(p) > seen(cur) || (seen(p) === seen(cur) && p.box > cur.box)) out[kana] = p;
    }
  };
  const addBests = (out, from, keep = () => true) => {
    for (const [key, best] of Object.entries(from || {})) if (keep(key)) out[key] = out[key] ? better(out[key], best) : best;
  };

  // Two devices' snapshots into one, nothing lost [phone knows か, PC knows き = both know both].
  // A side that hasn't seen the newest reset is dropped, answers since included [phone on reset 0 meets PC's reset 1000 = phone's copy ignored].
  function merge(a, b, keepBest = () => true) {
    const resetAt = Math.max(a?.resetAt || 0, b?.resetAt || 0);
    const sides = [a, b].filter((s) => s && (s.resetAt || 0) >= resetAt);
    const out = { progress: {}, "quiz.best": {}, "sheets.done": {}, "reading.done": [], resetAt,
      savedAt: Math.max(0, ...sides.map((s) => s.savedAt || 0)) };
    const reading = new Set();
    for (const s of sides) {
      addProgress(out.progress, s.progress);
      addBests(out["quiz.best"], s["quiz.best"], keepBest);
      for (const [id, pct] of Object.entries(s["sheets.done"] || {})) {
        out["sheets.done"][id] = Math.max(out["sheets.done"][id] || 0, pct);
      }
      (s["reading.done"] || []).forEach((r) => reading.add(r));
    }
    out["reading.done"] = [...reading].sort();
    return out;
  }

  // Writing progress from two decks by the kana rules, behind its own reset [a writing reset on the PC drops the phone's older copy].
  function mergeWrite(a, b) {
    if (!a && !b) return undefined;
    const resetAt = Math.max(a?.resetAt || 0, b?.resetAt || 0);
    const out = { kana: {}, best: {}, resetAt };
    for (const w of [a, b].filter((w) => w && (w.resetAt || 0) >= resetAt)) {
      addProgress(out.kana, w.kana);
      addBests(out.best, w.best);
    }
    return out;
  }

  // Same content whatever the key order [jsonb hands a row back with its keys sorted].
  const canon = (v) => (Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

  const api = { clipPath, imagePath, bump, better, merge, mergeWrite, same, wholeCategories };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraSync = api;
})(this);
