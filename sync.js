// Pure helpers shared by the browser and node: clip names and the progress merge.
(function (root) {
  // Storage key for a kana's clip, ASCII because the bucket rejects kana names [かっこ = audio/304b-3063-3053.mp3].
  const clipPath = (text) => `audio/${[...text].map((c) => c.codePointAt(0).toString(16)).join("-")}.mp3`;

  const better = (a, b) => (a.acc !== b.acc ? (a.acc > b.acc ? a : b) : a.ms <= b.ms ? a : b);
  const seen = (p) => (p ? p.right + p.wrong : -1);

  // Two devices' snapshots into one, nothing lost [phone knows か, PC knows き = both know both].
  // A side last saved before the newest reset is dropped [reset on PC at 10:00, phone idle since 9:00 = phone's copy ignored].
  function merge(a, b) {
    const resetAt = Math.max(a?.resetAt || 0, b?.resetAt || 0);
    const sides = [a, b].filter((s) => s && (s.savedAt || 0) >= resetAt);
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

  const api = { clipPath, merge };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraSync = api;
})(this);
