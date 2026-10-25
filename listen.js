// The Listening round: a met word's recording, its meaning picked from four [はな → flower, with no nose beside it].
(function (root) {
  const { hira } = typeof module !== "undefined" ? require("./sync.js") : root.HiraSync;
  // A reading as it sounds, katakana as hiragana and a suffix's ～ dropped [ペン = ぺん, ～だい = だい].
  const sound = (r) => hira(r.replace(/～/g, ""));
  // The group a word's wrong choices come from [suru verb = verb, pre-noun adjective = adjective, number = noun, adverb alone].
  const kindOf = (w) => (w.t.endsWith(" verb") ? "verb" : w.t.endsWith("adjective") ? "adjective"
    : ["noun", "pronoun", "number"].includes(w.t) ? "noun" : w.t === "adverb" ? "adverb" : "other");
  // The words a round can ask: met and recorded [後 read あと has no recording].
  const pool = (words, met) => words.filter((w) => w.au && met(w.k));

  // A meaning line's English shape [to eat = to, -- humble expression for する -- = --, flower = plain].
  const shape = (m) => (/^to /.test(m) ? "to" : /^--/.test(m) ? "--" : "plain");
  // Whether a line names the word heard [なぜ's "why (same as どうして)" names どう].
  const names = (m, w) => m.includes(w.w);
  // The words a wrong choice may come from: its shape and kind, topped up from its shape in any kind, never sounding like it or naming it [花: 804 nouns; 嬉しい: 304 "to" lines, 欲しい the one adjective].
  function candidates(word, words) {
    const fair = words.filter((w) => shape(w.m) === shape(word.m) && sound(w.r) !== sound(word.r) && !names(w.m, word));
    const kin = fair.filter((w) => kindOf(w) === kindOf(word));
    return kin.length >= 3 ? kin : fair;
  }

  // The word's meaning and three candidates', shuffled [学生: student, hot water, village, ~ day of the month].
  function options(word, words, rand = Math.random) {
    const wrong = candidates(word, words);
    const out = [word.m];
    while (out.length < 4) {
      const left = wrong.filter((w) => !out.includes(w.m));
      out.push(left[Math.floor(rand() * left.length)].m);
    }
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }

  const api = { sound, kindOf, pool, candidates, options };
  if (typeof module !== "undefined") { module.exports = api; return; }

  const study = window.HiraStudy;
  const { spaced, gapFor } = window.HiraOrder;
  const { wordClip } = window.HiraSync;
  const COUNTS = [10, 20, 40];
  const SEL = "hira.listening.count";
  const loadCount = () => { const n = +localStorage.getItem(SEL); return COUNTS.includes(n) ? n : 10; };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // #words/listen is the picker, #words/listen/run a round; with nothing to hear the round opens the picker.
  function view(mode) {
    const words = study.wordList(), list = pool(words, study.met), count = loadCount();
    if (mode === "run" && list.length) return run(words, list, count);
    if (mode === "run") window.history.replaceState(null, "", "#words/listen");
    picker(list, count);
  }

  function picker(list, count) {
    const { app, fmtTime: fmt } = study.shell();
    const best = study.listening.best(String(Math.min(count, list.length)));
    app.innerHTML = `
      <div class="row"><a href="#words">← Words</a></div>
      <h1>Listening</h1>
      <p class="lead">Hear a word you've met and pick what it means. The other choices are the same kind of word, and
        never one that sounds the same.</p>
      <div class="panel">
        <div class="row">
          <label>Questions <select id="count">${COUNTS.map((n) => `<option ${n === count ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <span class="muted" id="best">${best ? `Best: ${fmt(best.ms)} at ${best.acc}%` : ""}</span>
          <span class="spacer"></span>
          <span class="muted">${list.length ? `${list.length} word${list.length > 1 ? "s" : ""} to hear` : "No word you've met has a recording yet"}</span>
          <a class="btn ${list.length ? "" : "disabled"}" id="go" href="#words/listen/run">Start</a>
        </div>
      </div>`;
    app.querySelector("#count").addEventListener("change", (e) => { localStorage.setItem(SEL, e.target.value); picker(list, +e.target.value); });
  }

  // `given` is the missed ones, asked as they are and keeping no best [3 missed of 10 = a round of 3].
  function run(words, list, count, given) {
    const { app, esc, say, onKey } = study.shell();
    const queue = given ? spaced(given, 1) : shuffle([...list]).slice(0, count);
    let now = null;
    const play = () => say(now.r, wordClip(now.k));
    const reveal = () => { app.querySelector("#word").hidden = false; };
    HiraDrill.run({
      queue, gap: gapFor(queue.length), latin: true,
      back: { href: "#words/listen", label: "← Listening" }, done: { href: "#words", label: "Words" },
      card: `<div class="listen-q"><button class="speak rec listen-play" id="play" title="Listen again">🔊 <span class="kbd">space</span></button>
        <div class="word jp" id="word" hidden></div></div>`,
      show(w) {
        now = w;
        app.querySelector(".listen-q").dataset.k = w.k;
        Object.assign(app.querySelector("#play").dataset, { say: w.r, rec: wordClip(w.k) });
        const word = app.querySelector("#word");
        word.innerHTML = study.ruby(w);
        word.hidden = true;
        play();
      },
      options: (w) => options(w, words),
      judge: (w, m) => (m === w.m ? m : null),
      right() { reveal(); return 1000; },
      wrong() { reveal(); return ""; },
      missLine: (w) => `<span class="jp">${study.ruby(w)}</span> · ${esc(w.m)}`,
      best: given ? null : { key: String(queue.length), store: study.listening },
      again: () => run(words, list, count, given),
      drillMissed: (misses) => run(words, list, count, misses),
    });
    // Space plays it again, once per press, unless the drill took the key or a focused control has its own [Space on a miss = Continue].
    onKey((e) => {
      if (e.key !== " " || e.repeat || e.defaultPrevented || !app.querySelector(".listen-q") || e.target.closest("button, a, input, select")) return;
      e.preventDefault();
      play();
    });
  }

  root.HiraListen = { ...api, view };
})(this);
