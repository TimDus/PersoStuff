// Pure helpers shared by the browser and node: clip names and the progress merge.
(function (root) {
  // Storage key for a kana's clip, ASCII because the bucket rejects kana names [かっこ = audio/304b-3063-3053.mp3].
  const hex = (text) => [...text].map((c) => c.codePointAt(0).toString(16)).join("-");
  const clipPath = (text) => `audio/${hex(text)}.mp3`;
  // Mnemonic illustration, png or jpg, typed at upload so the key needs no extension [か = img/304b].
  const imagePath = (kana) => `img/${hex(kana)}`;

  const better = (a, b) => (a.acc !== b.acc ? (a.acc > b.acc ? a : b) : a.ms <= b.ms ? a : b);
  const seen = (p) => (p ? p.right + p.wrong : -1);

  // Two devices' snapshots into one, nothing lost [phone knows か, PC knows き = both know both].
  // A side that hasn't seen the newest reset is dropped, answers since included [phone on reset 0 meets PC's reset 1000 = phone's copy ignored].
  function merge(a, b) {
    const resetAt = Math.max(a?.resetAt || 0, b?.resetAt || 0);
    const sides = [a, b].filter((s) => s && (s.resetAt || 0) >= resetAt);
    const out = { progress: {}, "quiz.best": {}, "sheets.done": {}, "reading.done": [], resetAt,
      savedAt: Math.max(0, ...sides.map((s) => s.savedAt || 0)) };
    const reading = new Set();
    for (const s of sides) {
      for (const [kana, p] of Object.entries(s.progress || {})) {
        const cur = out.progress[kana];
        // More history wins, then the higher box [12 answers at box 2 beats 3 answers at box 4].
        if (!cur || seen(p) > seen(cur) || (seen(p) === seen(cur) && p.box > cur.box)) out.progress[kana] = p;
      }
      for (const [key, best] of Object.entries(s["quiz.best"] || {})) {
        const cur = out["quiz.best"][key];
        out["quiz.best"][key] = cur ? better(cur, best) : best;
      }
      for (const [id, pct] of Object.entries(s["sheets.done"] || {})) {
        out["sheets.done"][id] = Math.max(out["sheets.done"][id] || 0, pct);
      }
      (s["reading.done"] || []).forEach((r) => reading.add(r));
    }
    out["reading.done"] = [...reading].sort();
    return out;
  }

  // Same content whatever the key order [jsonb hands a row back with its keys sorted].
  const canon = (v) => (Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

  const api = { clipPath, imagePath, merge, same };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraSync = api;
})(this);
