// The hubs' search, pure: English at a word's start, romaji or kana by reading [eat: 食べる 召し上がる 頂く, never 肉 meat].
(function (root) {
  const node = typeof module !== "undefined";
  const { hira } = node ? require("./sync.js") : root.HiraSync;
  const { toKana } = node ? require("./conj.js") : root.HiraConj;
  const { keywordOf } = node ? require("./keywords.js") : root.HiraKeywords;
  const fold = (s) => hira(s.toLowerCase().replace(/～/g, ""));
  const JAPANESE = /[぀-ヿ㐀-鿿々]/;
  // A query as typed, trimmed with its spaces squeezed [" to  eat " = "to eat"].
  const tidy = (q) => q.trim().replace(/\s+/g, " ");
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The query where a word starts, the character before it captured apart [eat: in "to eat", not in meat or theater].
  const atStart = (q) => new RegExp(`(^|[^a-z0-9])(${escRe(q)})`, "gi");
  const bare = (s) => s.replace(/^to /, "");
  // 0 an exact sense, 1 a sense starting with it, 2 a word start anywhere [fall: 秋 "fall (season)" 0, 眠る "to fall asleep" 1].
  function englishRank(text, q) {
    q = tidy(q).toLowerCase();
    if (!atStart(q).test(text)) return null;
    const senses = text.toLowerCase().replace(/\([^)]*\)/g, "").split(/[;,]/).map((s) => bare(tidy(s)));
    return senses.includes(bare(q)) ? 0 : senses.some((s) => s.startsWith(bare(q))) ? 1 : 2;
  }
  const KANA = /^[ぁ-ゖー]+$/;
  // A query as the kana it spells whole, "" for anything that isn't whole kana [taberu: たべる; tab: "" till tabe; eat: えあt so ""; 食べる: ""].
  const kanaOf = (q) => {
    const k = JAPANESE.test(q) ? fold(q) : /^[a-z' -]+$/i.test(q) ? toKana(q.replace(/\s+/g, ""), true) : "";
    return KANA.test(k) ? k : "";
  };
  // English first, then the reading or spelling: 3 exact, 4 starting, 5 inside, the last for typed Japanese only [me: 下さい, then 目 め, then 眼鏡 めがね].
  function words(list, q) {
    q = tidy(q);
    if (!q) return [];
    const typed = JAPANESE.test(q);
    const kana = typed ? fold(q) : kanaOf(q);
    const rankOf = (w) => {
      const e = typed ? null : englishRank(w.m, q);
      if (e !== null || !kana) return e;
      const forms = [fold(w.w), fold(w.r)];
      return forms.includes(kana) ? 3 : forms.some((f) => f.startsWith(kana)) ? 4 : typed && forms.some((f) => f.includes(kana)) ? 5 : null;
    };
    return list.map((w, i) => ({ w, i, r: rankOf(w) })).filter((x) => x.r !== null)
      .sort((a, b) => a.r - b.r || a.w.f - b.w.f || a.i - b.i).map((x) => x.w);
  }
  // A kanji's English: the keyword shown, Heisig's, KANJIDIC's meanings [旦: dawn, nightbreak, daybreak, dawn].
  const names = (c, info, koohii) => [keywordOf(c, koohii, info), koohii[c]?.kw, info[c]?.m];
  // The kanji answering to a query, English hits by their best rank then reading hits, ties in `cs` order; a typed kanji is itself [old: 古 before 老 old man; ten: 十, then 天 てん].
  function kanji(cs, info, q, koohii = {}) {
    q = tidy(q);
    if (!q) return [];
    const kana = kanaOf(q);
    const best = (c) => Math.min(...names(c, info, koohii).filter(Boolean).map((t) => englishRank(t, q) ?? 9));
    const said = JAPANESE.test(q) ? cs.filter((c) => q.includes(c))
      : cs.map((c) => [c, best(c)]).filter(([, r]) => r < 9).sort((a, b) => a[1] - b[1]).map(([c]) => c);
    const reads = (c) => !!kana && [...(info[c]?.on || []), ...(info[c]?.kun || [])].some((r) => fold(r.replace(/[.-]/g, "")).startsWith(kana));
    return [...said, ...cs.filter((c) => !said.includes(c) && reads(c))];
  }
  // A text cut where the query starts a word, for marking [to eat or drink: "to ", "eat" marked, " or drink"].
  function mark(text, q) {
    q = tidy(q);
    const out = [];
    let at = 0;
    if (q) for (const m of text.matchAll(atStart(q))) {
      const start = m.index + m[1].length;
      if (start > at) out.push([text.slice(at, start), false]);
      out.push([m[2], true]);
      at = start + m[2].length;
    }
    if (at < text.length) out.push([text.slice(at), false]);
    return out;
  }
  const api = { englishRank, words, kanji, mark };
  if (node) module.exports = api;
  else root.HiraSearch = api;
})(this);
