// The Verbs tab: conjugation drills on the list's verbs and adjectives, met words first [食べる → polite past = 食べました].
(function () {
  const { FORMS, base, conjugate, classOf, toKana, accepts } = window.HiraConj;
  const { spaced, gapFor } = window.HiraOrder;
  const study = window.HiraStudy;
  // A drill draws on at least this many words, topped up from the most common [3 verbs met = 12 more from the top of N5].
  const POOL = 15;
  const KINDS = { verb: "Verbs", "adj-i": "い-adjectives", "adj-na": "な-adjectives" };
  const kindOf = (w) => {
    const c = classOf(w);
    return !c ? null : c === "adj-na" ? "adj-na" : c.startsWith("adj") ? "adj-i" : "verb";
  };
  const SEL = "hira.verbs.sel";
  // The saved choice, keeping only the forms, kinds and counts on offer [none removed yet; an unknown form id crashed the drill].
  const loadSel = () => {
    let sel = {};
    try { sel = JSON.parse(localStorage.getItem(SEL)) || {}; } catch {}
    const known = (list, ok, fallback) => (Array.isArray(list) ? list.filter(ok) : fallback);
    return {
      forms: known(sel.forms, (id) => FORMS.some((f) => f.id === id), ["masu", "masen", "mashita", "masendeshita"]),
      kinds: known(sel.kinds, (k) => k in KINDS, ["verb"]),
      count: [10, 20, 40].includes(sel.count) ? sel.count : 20,
    };
  };
  // The best a selection has scored is kept per forms, word kinds and question count [masu,te|verb|20].
  const selKey = (sel) => `${[...sel.forms].sort().join(",")}|${[...sel.kinds].sort().join(",")}|${sel.count}`;
  const fmt = (ms) => study.shell().fmtTime(ms);
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
  // The word as asked, a bare する noun with its する [電話 → 電話する].
  const shown = (w) => study.ruby(w) + esc(base(w).w.slice(w.w.length));
  const label = (id) => FORMS.find((f) => f.id === id).label;

  async function viewVerbs([mode]) {
    const { app } = study.shell();
    let words;
    const here = location.hash;
    app.innerHTML = `<p class="muted">Loading words…</p>`;
    try { words = await study.words(); } catch {
      if (location.hash !== here) return;
      return study.needWords(() => viewVerbs([mode]));
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
    const queue = given ? spaced(given, 1, Math.random, sameWord) : questions(words, sel);
    if (!queue.length) { location.hash = "#verbs"; return; }
    const { app } = study.shell();
    HiraDrill.run({
      queue, gap: gapFor(new Set(queue.map((q) => q.word)).size), clash: sameWord, typed: true,
      back: { href: "#verbs", label: "← Choose forms" }, done: { href: "#verbs", label: "Choose forms" },
      card: `<div class="verb-q"><div class="word jp" id="word"></div><div class="muted" id="type"></div><div class="muted small" id="meaning"></div><div class="form" id="form"></div></div>`,
      show(q) {
        app.querySelector("#word").innerHTML = shown(q.word);
        app.querySelector("#type").textContent = q.word.t + (base(q.word).w !== q.word.w ? " + する" : "");
        // The meaning says which word is meant where the kana alone doesn't [はく: to put on, not to vomit].
        app.querySelector("#meaning").textContent = q.word.m;
        app.querySelector("#form").textContent = label(q.form);
        app.querySelector(".verb-q").dataset.k = q.word.k;
        app.querySelector(".verb-q").dataset.form = q.form;
      },
      judge: (q, typed) => (accepts(q.want, typed) ? q.want : null),
      right(q, want, typed, { input }) {
        // Shown back in the spelling typed [電話します stays; denwashimasu → でんわします, tesutoshimasu → テストします].
        input.value = toKana(typed.trim(), true) === want.w ? want.w : want.r;
        input.classList.add("right");
        return 350;
      },
      wrong(q, typed, { input }) {
        input.classList.add("wrong");
        return `<div class="ans jp">${esc(q.want.w)}${q.want.w !== q.want.r ? ` <small>${esc(q.want.r)}</small>` : ""}</div>`;
      },
      missLine: (q) => `<span class="jp">${shown(q.word)}</span> · ${esc(label(q.form))} → <b class="jp">${esc(q.want.w)}</b>`,
      best: given ? null : { key: selKey(sel), store: study.verbs },
      again: () => run(words, sel, given),
      drillMissed: (misses) => run(words, sel, misses),
    });
  }

  study.routes.verbs = viewVerbs;
})();
