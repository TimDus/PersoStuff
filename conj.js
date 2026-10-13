// Conjugation for the drills, pure so node can test it [書く → polite past = 書きました / かきました; kakimashita = かきました].
(function (root) {
  // The drill's forms, N5 first [set 5 = ます forms, て, plain negative and past].
  const FORMS = [
    ["masu", "polite", 5], ["masen", "polite negative", 5], ["mashita", "polite past", 5], ["masendeshita", "polite past negative", 5],
    ["te", "て-form", 5], ["nai", "plain negative", 5], ["ta", "plain past", 5], ["nakatta", "plain past negative", 5],
    ["potential", "potential", 4], ["volitional", "volitional", 4], ["ba", "ば conditional", 4], ["tara", "たら conditional", 4],
    ["passive", "passive", 4], ["causative", "causative", 4], ["imperative", "imperative", 4],
  ].map(([id, label, set]) => ({ id, label, set }));

  // A godan verb's last kana by row, a-i-u-e-o [く: か き く け こ; う's a-row is わ].
  const ROWS = { う: "わいうえお", く: "かきくけこ", ぐ: "がぎぐげご", す: "さしすせそ", つ: "たちつてと", ぬ: "なにぬねの", ぶ: "ばびぶべぼ", む: "まみむめも", る: "らりるれろ" };
  const TE = { う: "って", つ: "って", る: "って", く: "いて", ぐ: "いで", す: "して", ぬ: "んで", ぶ: "んで", む: "んで" };
  const past = (te) => te.replace(/て$/, "た").replace(/で$/, "だ");

  // What replaces a godan verb's last kana, per form [む: みます, まない, んで, めば].
  function godan(k, cls) {
    const [a, i, , e, o] = ROWS[k];
    // ございます-type verbs take い where others take り [いらっしゃる: いらっしゃいます, いらっしゃい].
    const stem = cls === "v5aru" ? "い" : i;
    const te = cls === "v5k-s" ? "って" : TE[k];
    return {
      masu: stem + "ます", masen: stem + "ません", mashita: stem + "ました", masendeshita: stem + "ませんでした",
      te, ta: past(te), nai: a + "ない", nakatta: a + "なかった",
      potential: e + "る", volitional: o + "う", ba: e + "ば", tara: past(te) + "ら",
      passive: a + "れる", causative: a + "せる", imperative: cls === "v5aru" ? "い" : e,
    };
  }
  const ICHIDAN = {
    masu: "ます", masen: "ません", mashita: "ました", masendeshita: "ませんでした", te: "て", ta: "た", nai: "ない", nakatta: "なかった",
    potential: "られる", volitional: "よう", ba: "れば", tara: "たら", passive: "られる", causative: "させる", imperative: "ろ",
  };
  const SURU = {
    masu: "します", masen: "しません", mashita: "しました", masendeshita: "しませんでした", te: "して", ta: "した", nai: "しない", nakatta: "しなかった",
    potential: "できる", volitional: "しよう", ba: "すれば", tara: "したら", passive: "される", causative: "させる", imperative: "しろ",
  };
  const KURU = {
    masu: "きます", masen: "きません", mashita: "きました", masendeshita: "きませんでした", te: "きて", ta: "きた", nai: "こない", nakatta: "こなかった",
    potential: "こられる", volitional: "こよう", ba: "くれば", tara: "きたら", passive: "こられる", causative: "こさせる", imperative: "こい",
  };
  const ADJ_I = { nai: "くない", ta: "かった", nakatta: "くなかった", te: "くて", ba: "ければ", tara: "かったら" };
  const ADJ_NA = { nai: "じゃない", ta: "だった", nakatta: "じゃなかった", te: "で", tara: "だったら" };

  // The word's conjugation class, the first part-of-speech code that has one [勉強する: vs; 有る: v5r-i].
  const classOf = (word) => word.pos.find((p) => /^(v1|v5|vk|vs-i|vs$|adj-i|adj-ix|adj-na)/.test(p));

  // The form a word is asked in, with the する a bare noun leaves off [電話 → 電話する; 勉強する stays].
  const base = (word) => (/^vs/.test(classOf(word) || "") && !word.r.endsWith("する") ? { w: word.w + "する", r: word.r + "する" } : { w: word.w, r: word.r });

  // One form in kana and in the word's own spelling, or null where the word has none [高い has no ます form; ある no potential].
  function conjugate(word, form) {
    const cls = classOf(word);
    if (!cls || !FORMS.some((f) => f.id === form)) return null;
    // A word part or a spelling without its kana ending has nothing to type or to change [～だす; the list's old 堅 read かたい gave 堅くない].
    if (/^[～〜]/.test(word.w) || (/^(v1|v5|adj-i)/.test(cls) && word.w.slice(-1) !== word.r.slice(-1))) return null;
    const { w, r } = base(word);
    const swap = (cut, add) => ({ w: w.slice(0, w.length - cut) + add, r: r.slice(0, r.length - cut) + add });
    if (cls === "v1") return swap(1, ICHIDAN[form]);
    if (cls === "vk") return { w: w.slice(0, 1) + KURU[form].slice(1), r: KURU[form] };
    if (cls === "vs-i" || cls === "vs") return swap(2, SURU[form]);
    if (cls === "v5r-i") {
      if (form === "nai" || form === "nakatta") return { w: form === "nai" ? "ない" : "なかった", r: form === "nai" ? "ない" : "なかった" };
      if (["potential", "volitional", "passive", "causative", "imperative"].includes(form)) return null;
    }
    // Honorific verbs aren't said in these forms [くださられる, いらっしゃれる].
    if (cls === "v5aru" && ["potential", "volitional", "passive", "causative"].includes(form)) return null;
    if (cls.startsWith("v5")) return swap(1, godan(word.r.slice(-1), cls)[form]);
    if (cls === "adj-i" || cls === "adj-ix") {
      if (!ADJ_I[form]) return null;
      // いい borrows よい's stem [いい: よくない, よかった].
      if (cls === "adj-ix") return { w: (w === "いい" ? "よ" : w.slice(0, -1)) + ADJ_I[form], r: "よ" + ADJ_I[form] };
      return swap(1, ADJ_I[form]);
    }
    if (cls === "adj-na") return ADJ_NA[form] ? swap(0, ADJ_NA[form]) : null;
    return null;
  }

  // Romaji syllables to hiragana, Hepburn plus the spellings a keyboard learner reaches for [si, ti, tu, hu].
  const SYL = {};
  const add = (cons, kana) => "aiueo".split("").forEach((v, i) => { if (kana[i] !== "_") SYL[cons + v] = kana[i]; });
  add("", "あいうえお"); add("k", "かきくけこ"); add("s", "さしすせそ"); add("t", "たちつてと"); add("n", "なにぬねの");
  add("h", "はひふへほ"); add("m", "まみむめも"); add("y", "や_ゆ_よ"); add("r", "らりるれろ"); add("w", "わ___を");
  add("g", "がぎぐげご"); add("z", "ざじずぜぞ"); add("d", "だぢづでど"); add("b", "ばびぶべぼ"); add("p", "ぱぴぷぺぽ");
  Object.assign(SYL, { shi: "し", chi: "ち", tsu: "つ", fu: "ふ", ji: "じ", wo: "を" });
  for (const [cons, base] of [["ky", "き"], ["sh", "し"], ["sy", "し"], ["ch", "ち"], ["ty", "ち"], ["ny", "に"], ["hy", "ひ"], ["my", "み"],
    ["ry", "り"], ["gy", "ぎ"], ["j", "じ"], ["zy", "じ"], ["jy", "じ"], ["by", "び"], ["py", "ぴ"]]) {
    SYL[cons + "a"] = base + "ゃ"; SYL[cons + "u"] = base + "ゅ"; SYL[cons + "o"] = base + "ょ";
  }
  SYL.je = "じぇ"; SYL.she = "しぇ"; SYL.che = "ちぇ";
  // The small vowels katakana loanwords need [fakkusu = ふぁっくす, xa or la = ぁ].
  Object.assign(SYL, { fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ" });
  add("x", "ぁぃぅぇぉ"); add("l", "ぁぃぅぇぉ");
  const VOWEL = /[aiueoy]/;
  // Typed romaji into kana, leaving what isn't a syllable yet; `done` settles any n left waiting [tan = たn while typing, たん once sent].
  function toKana(s, done = false) {
    s = s.toLowerCase();
    let out = "";
    for (let i = 0; i < s.length;) {
      const c = s[i], next = s[i + 1];
      if (c === "n") {
        if (next === "'") { out += "ん"; i += 2; continue; }
        // nn is one ん unless a vowel follows the second [konnichi = こんにち, onna = おんな, kinnbe = きんべ].
        if (next === "n") {
          // A last nn waits for the key that decides it [onn + a = おんな, not おんあ].
          if (!done && i + 2 === s.length) { out += "nn"; i += 2; continue; }
          out += "ん"; i += VOWEL.test(s[i + 2] || "") ? 1 : 2; continue;
        }
        if (next && !VOWEL.test(next) && /[a-z]/.test(next)) { out += "ん"; i++; continue; }
        // Sent, an n before anything but a letter is ん too [うんてnします = うんてんします].
        if (!next || (done && !/[a-z]/.test(next))) { out += done ? "ん" : "n"; i++; continue; }
      }
      // A doubled consonant is a small っ [itte = いって; tch as in matcha = っち].
      if (/[bcdfghjkmpqrstvwxyz]/.test(c) && (next === c || (c === "t" && next === "c"))) { out += "っ"; i++; continue; }
      if (c === "-") { out += "ー"; i++; continue; }
      const hit = [3, 2, 1].map((n) => s.slice(i, i + n)).find((p) => SYL[p]);
      if (hit) { out += SYL[hit]; i += hit.length; continue; }
      out += c;
      i++;
    }
    return out;
  }

  // Katakana as hiragana, for answers romaji can only give in hiragana [テストします = てすとします].
  const hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // A typed answer against a form, in kana, romaji or the kanji spelling [書きます, かきます and kakimasu all count].
  const accepts = (want, typed) => {
    const t = typed.trim();
    if (!t) return false;
    const kana = toKana(t, true);
    return [want.r, want.w, hira(want.r), hira(want.w)].includes(kana);
  };

  const api = { FORMS, base, conjugate, classOf, toKana, accepts };
  if (typeof module !== "undefined") module.exports = api;
  else root.HiraConj = api;
})(this);
