// The Verbs tab: conjugation drills on the list's verbs and adjectives, met words first [食べる → polite past = 食べました].
(function () {
  const { FORMS, conjugate, classOf, toKana, accepts } = window.HiraConj;
  const { spaced, requeue, gapFor } = window.HiraOrder;
  const study = window.HiraStudy;
  // A drill draws on at least this many words, topped up from the most common [3 verbs met = 12 more from the top of N5].
  const POOL = 15;
  const KINDS = { verb: "Verbs", "adj-i": "い-adjectives", "adj-na": "な-adjectives" };
  const kindOf = (w) => {
    const c = classOf(w);
    return !c ? null : c === "adj-na" ? "adj-na" : c.startsWith("adj") ? "adj-i" : "verb";
  };
  const SEL = "hira.verbs.sel";
  const loadSel = () => {
    try { return { forms: ["masu", "masen", "mashita", "masendeshita"], kinds: ["verb"], count: 20, ...JSON.parse(localStorage.getItem(SEL)) }; }
    catch { return { forms: ["masu", "masen", "mashita", "masendeshita"], kinds: ["verb"], count: 20 }; }
  };
  // The best a selection has scored is kept per forms and word kinds [masu,te|verb].
  const selKey = (sel) => `${[...sel.forms].sort().join(",")}|${[...sel.kinds].sort().join(",")}`;
  const fmt = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sameWord = (a, b) => a.word === b.word;

  // Questions for a selection: met words' forms first, then the most common others, never the same word back to back.
  function questions(words, sel) {
    const usable = words.filter((w) => sel.kinds.includes(kindOf(w)) && sel.forms.some((f) => conjugate(w, f)));
    const met = usable.filter((w) => study.met(w.k));
    const pool = [...met, ...usable.filter((w) => !study.met(w.k)).slice(0, Math.max(0, POOL - met.length))];
    const items = (list) => shuffle(list.flatMap((word) => sel.forms.map((form) => ({ word, form, want: conjugate(word, form) })).filter((q) => q.want)));
    const chosen = [...items(pool.filter((w) => study.met(w.k))), ...items(pool.filter((w) => !study.met(w.k)))].slice(0, sel.count);
    return spaced(chosen, 1, Math.random, sameWord);
  }

  const esc = (s) => study.shell().esc(s);
  const ruby = (w) => w.fu.map(([text, rt]) => (rt ? `<ruby>${esc(text)}<rt>${esc(rt)}</rt></ruby>` : esc(text))).join("");
  const label = (id) => FORMS.find((f) => f.id === id).label;

  async function viewVerbs([mode]) {
    const { app } = study.shell();
    let words;
    const here = location.hash;
    try { words = await study.words(); } catch {
      if (location.hash !== here) return;
      app.innerHTML = `<div class="panel" style="text-align:center;max-width:520px;margin:2rem auto"><h1>Can't load the words</h1>
        <p class="muted">The word list comes with the site and needs a connection the first time.</p><button id="retry">Try again</button></div>`;
      return app.querySelector("#retry").addEventListener("click", () => viewVerbs([mode]));
    }
    if (location.hash !== here) return;
    const sel = loadSel();
    if (mode === "run") return run(words, sel);
    picker(words, sel);
  }

  function picker(words, sel) {
    const { app } = study.shell();
    const best = study.verbs.best(selKey(sel));
    const chip = (f) => `<span class="chip ${sel.forms.includes(f.id) ? "on" : ""}" role="button" data-form="${f.id}">${esc(f.label)}</span>`;
    const set = (n) => FORMS.filter((f) => f.set === n);
    app.innerHTML = `
      <h1>Verbs</h1>
      <p class="lead">Change a word into the form asked. Type the answer in romaji and it turns into kana as you go,
        or use a Japanese keyboard; the kanji spelling counts too. Words you've met in Words come first.</p>
      <div class="panel">
        ${[[5, "N5 forms"], [4, "N4 forms"]].map(([n, title]) => `
          <div class="picker-head"><strong>${title}</strong>
            <button class="linkish" data-all="${n}">all</button><button class="linkish" data-none="${n}">none</button></div>
          <div class="picker">${set(n).map(chip).join("")}</div>`).join("")}
        <div class="picker-head"><strong>Words</strong></div>
        <div class="picker">${Object.entries(KINDS).map(([k, name]) => `<span class="chip ${sel.kinds.includes(k) ? "on" : ""}" role="button" data-kind="${k}">${name}</span>`).join("")}</div>
        <div class="row" style="margin-top:1.2rem">
          <label>Questions <select id="count">${[10, 20, 40].map((n) => `<option ${n === sel.count ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <span class="muted" id="best">${best ? `Best: ${fmt(best.ms)} at ${best.acc}%` : ""}</span>
          <span class="spacer"></span><span class="muted" id="avail"></span>
          <a class="btn" id="go" href="#verbs/run">Start</a>
        </div>
      </div>`;
    const avail = questions(words, sel).length;
    app.querySelector("#avail").textContent = `${avail} questions`;
    app.querySelector("#go").classList.toggle("disabled", !avail);
    const save = (next) => { localStorage.setItem(SEL, JSON.stringify(next)); picker(words, next); };
    const toggle = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
    app.querySelector(".panel").addEventListener("click", (e) => {
      const f = e.target.closest("[data-form]"), k = e.target.closest("[data-kind]");
      const all = e.target.closest("[data-all]"), none = e.target.closest("[data-none]");
      if (f) save({ ...sel, forms: toggle(sel.forms, f.dataset.form) });
      else if (k) save({ ...sel, kinds: toggle(sel.kinds, k.dataset.kind) });
      else if (all) save({ ...sel, forms: [...new Set([...sel.forms, ...set(+all.dataset.all).map((x) => x.id)])] });
      else if (none) save({ ...sel, forms: sel.forms.filter((x) => !set(+none.dataset.none).some((y) => y.id === x)) });
    });
    app.querySelector("#count").addEventListener("change", (e) => save({ ...sel, count: +e.target.value }));
  }

  function run(words, sel, given) {
    const { app, onKey, cleanup } = study.shell();
    cleanup();
    const queue = given ? spaced(given, 1, Math.random, sameWord) : questions(words, sel);
    if (!queue.length) { location.hash = "#verbs"; return; }
    const gap = gapFor(new Set(queue.map((q) => q.word)).size);
    const missed = [];
    // The box is never read-only, which would drop a phone keyboard: `settling` covers the beat after a right answer, `waiting` a miss.
    let idx = 0, right = 0, wrong = 0, waiting = false, settling = false, composing = false;
    const start = Date.now();
    app.innerHTML = `
      <div class="row"><a href="#verbs">← Choose forms</a><span class="spacer"></span><span class="progress-line" id="prog"></span></div>
      <div class="stage">
        <div class="verb-q"><div class="word jp" id="word"></div><div class="muted" id="type"></div><div class="muted small" id="meaning"></div><div class="form" id="form"></div></div>
        <input class="quiz-input jp" id="in" lang="ja" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" placeholder="romaji or kana">
        <div class="feedback" id="fb"></div>
        <div class="stats"><span>✓ <b id="ok">0</b></span><span>✗ <b id="bad">0</b></span></div>
      </div>`;
    const input = app.querySelector("#in"), fb = app.querySelector("#fb");
    function show() {
      if (idx >= queue.length) return finish();
      const q = queue[idx];
      app.querySelector("#word").innerHTML = ruby(q.word);
      app.querySelector("#type").textContent = q.word.t;
      // The meaning says which word is meant where the kana alone doesn't [はく: to put on, not to vomit].
      app.querySelector("#meaning").textContent = q.word.m;
      app.querySelector("#form").textContent = label(q.form);
      app.querySelector("#prog").textContent = `${idx + 1} / ${queue.length}`;
      app.querySelector(".verb-q").dataset.k = q.word.k;
      app.querySelector(".verb-q").dataset.form = q.form;
      input.value = ""; input.className = "quiz-input jp"; input.focus();
      fb.innerHTML = "";
      waiting = false; settling = false;
    }
    function submit() {
      const q = queue[idx];
      if (accepts(q.want, input.value)) {
        study.verbs.record(q.form, true);
        right++;
        app.querySelector("#ok").textContent = right;
        input.value = toKana(input.value, true);
        input.classList.add("right");
        settling = true;
        idx++;
        // Only while this run is still on screen [left for Words in the 350 ms = nothing drawn there].
        setTimeout(() => { if (settling && input.isConnected) show(); }, 350);
        return;
      }
      study.verbs.record(q.form, false);
      wrong++;
      missed.push(q);
      app.querySelector("#bad").textContent = wrong;
      input.classList.add("wrong");
      fb.innerHTML = `<div class="ans jp">${esc(q.want.w)}${q.want.w !== q.want.r ? ` <small>${esc(q.want.r)}</small>` : ""}</div>
        <button class="ghost" id="next" style="margin-top:.5rem">Continue <span class="kbd">Enter</span></button>`;
      fb.querySelector("#next").addEventListener("click", show);
      requeue(queue, idx, gap, Math.random, sameWord);
      idx++;
      waiting = true;
    }
    // Romaji turns into kana as it's typed, except while a Japanese keyboard is composing [tabe = たべ].
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => { composing = false; });
    input.addEventListener("beforeinput", (e) => { if (waiting || settling) e.preventDefault(); });
    input.addEventListener("input", () => {
      if (composing) return;
      const kana = toKana(input.value);
      if (kana !== input.value) input.value = kana;
    });
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing) return;
      e.preventDefault();
      if (waiting) return show();
      if (!settling && input.value.trim()) submit();
    });
    fb.addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
    onKey((e) => { if (waiting && e.key === "Enter" && e.target !== input && !e.target.closest("button")) show(); });
    function finish() {
      const ms = Date.now() - start;
      const acc = Math.round((right / (right + wrong)) * 100);
      let note = "";
      if (!given) {
        const key = selKey(sel), prev = study.verbs.best(key);
        if (!prev || acc > prev.acc || (acc === prev.acc && ms < prev.ms)) {
          study.verbs.setBest(key, { ms, acc });
          note = prev ? `New best! Previous ${fmt(prev.ms)} at ${prev.acc}%` : "First run — now beat it.";
        } else note = `Best: ${fmt(prev.ms)} at ${prev.acc}%`;
      }
      // A finished drill uploads at once, like a finished review [the best and the per-form answers].
      study.flush();
      app.innerHTML = `
        <div class="panel" style="text-align:center;max-width:560px;margin:2rem auto">
          <h1>Done!</h1>
          <div class="stats" style="margin:1rem 0"><div><div class="big-number">${fmt(ms)}</div>time</div><div><div class="big-number">${acc}%</div>accuracy</div></div>
          <p class="muted">${note}</p>
          ${missed.length ? `<h2>Missed</h2><div class="verb-misses">${missed.map((q) => `<div><span class="jp">${ruby(q.word)}</span> · ${esc(label(q.form))} → <b class="jp">${esc(q.want.w)}</b></div>`).join("")}</div>` : ""}
          <div class="row" style="justify-content:center;margin-top:1.2rem">
            <button id="re">Again</button>
            ${missed.length ? `<button class="ghost" id="miss">Drill the missed ones</button>` : ""}
            <a class="btn ghost" href="#verbs">Choose forms</a>
          </div>
        </div>`;
      app.querySelector("#re").addEventListener("click", () => run(words, sel, given));
      app.querySelector("#miss")?.addEventListener("click", () => run(words, sel, [...new Set(missed)]));
    }
    show();
  }

  study.routes.verbs = viewVerbs;
})();
